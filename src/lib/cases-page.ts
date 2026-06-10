import { createSupabaseServerClient } from '~/lib/supabase/server';
import {
  PUBLIC_LISTING_SELECT,
  PUBLIC_WANTED_SELECT,
  type PublicListing,
  type PublicWanted,
} from '~/lib/marketplace';

export type CasesView = 'active' | 'done' | 'all';
export type MarketType = 'all' | 'listing' | 'wanted';

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function parseCasesView(value: string | null | undefined): CasesView {
  if (value === 'done' || value === 'all') return value;
  return 'active';
}

export function parseMarketType(value: string | null | undefined): MarketType {
  if (value === 'listing' || value === 'wanted') return value;
  return 'all';
}

export const CASES_PER_PAGE = 20;

export type CasesFilterParams = {
  view: CasesView;
  type: MarketType;
  category: string;
  prefecture: string;
  city: string;
  minPrice: string;
  maxPrice: string;
  sort: string;
  q: string;
  listingKind: string;
  clinicalUse: string;
  validOnly: string;
  page: string;
};

export function parseCasesFilters(url: URL): CasesFilterParams {
  return {
    view: parseCasesView(url.searchParams.get('view')),
    type: parseMarketType(url.searchParams.get('type')),
    category: url.searchParams.get('category')?.trim() ?? '',
    prefecture: url.searchParams.get('prefecture')?.trim() ?? '',
    city: url.searchParams.get('city')?.trim() ?? '',
    minPrice: url.searchParams.get('minPrice')?.trim() ?? '',
    maxPrice: url.searchParams.get('maxPrice')?.trim() ?? '',
    sort: url.searchParams.get('sort')?.trim() ?? 'new',
    q: url.searchParams.get('q')?.trim() ?? '',
    listingKind: url.searchParams.get('listingKind')?.trim() ?? '',
    clinicalUse: url.searchParams.get('clinicalUse')?.trim() ?? '',
    validOnly: url.searchParams.get('validOnly')?.trim() ?? '',
    page: url.searchParams.get('page')?.trim() ?? '',
  };
}

export function buildCasesUrl(overrides: Partial<CasesFilterParams> = {}, base?: CasesFilterParams): string {
  const values = { ...(base ?? {}), ...overrides } as CasesFilterParams;
  const params = new URLSearchParams();
  if (values.view && values.view !== 'active') params.set('view', values.view);
  if (values.type && values.type !== 'all') params.set('type', values.type);
  if (values.category) params.set('category', values.category);
  if (values.prefecture) params.set('prefecture', values.prefecture);
  if (values.city) params.set('city', values.city);
  if (values.minPrice) params.set('minPrice', values.minPrice);
  if (values.maxPrice) params.set('maxPrice', values.maxPrice);
  if (values.sort && values.sort !== 'new') params.set('sort', values.sort);
  if (values.q) params.set('q', values.q);
  if (values.listingKind) params.set('listingKind', values.listingKind);
  if (values.clinicalUse) params.set('clinicalUse', values.clinicalUse);
  if (values.validOnly === '1') params.set('validOnly', '1');
  if (values.page && values.page !== '1') params.set('page', values.page);
  const qs = params.toString();
  return `/cases${qs ? `?${qs}` : ''}`;
}

export type MarketPost =
  | { kind: 'listing'; post: PublicListing; date: string }
  | { kind: 'wanted'; post: PublicWanted; date: string };

export async function fetchMarketPosts(
  cookies: Parameters<typeof createSupabaseServerClient>[0],
  locals: Parameters<typeof createSupabaseServerClient>[1],
  filters: Pick<
    CasesFilterParams,
    'type' | 'category' | 'prefecture' | 'city' | 'minPrice' | 'maxPrice' | 'sort' | 'q' | 'listingKind' | 'clinicalUse'
    | 'validOnly'
  >
): Promise<{ listings: PublicListing[]; wanted: PublicWanted[] }> {
  const supabase = createSupabaseServerClient(cookies, locals);
  const { type, category, prefecture, city, minPrice, maxPrice, q, listingKind, clinicalUse, validOnly } = filters;

  let listings: PublicListing[] = [];
  let wanted: PublicWanted[] = [];

  if (type === 'all' || type === 'listing') {
    let query = supabase
      .from('listings')
      .select(PUBLIC_LISTING_SELECT)
      .eq('status', 'published')
      .order('published_at', { ascending: false });

    if (category) query = query.eq('category_slug', category);
    if (prefecture) query = query.eq('location_prefecture', prefecture);
    if (city) query = query.ilike('location_city', `%${city}%`);
    if (listingKind) query = query.eq('listing_kind', listingKind);
    if (clinicalUse) query = query.eq('clinical_use', clinicalUse);
    if (minPrice) query = query.gte('asking_price', Number(minPrice));
    if (maxPrice) query = query.lte('asking_price', Number(maxPrice));
    if (q) query = query.or(`maker.ilike.%${q}%,model.ilike.%${q}%`);

    const { data } = await query.limit(50);
    listings = (data ?? []) as unknown as PublicListing[];
    if (validOnly === '1') {
      const now = new Date();
      const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
      listings = listings.filter((item) => {
        if (item.listing_kind === 'device') return true;
        if (item.listing_kind !== 'consumable_valid') return false;
        return !item.expiry_date || item.expiry_date >= today;
      });
    }
  }

  if (type === 'all' || type === 'wanted') {
    let query = supabase
      .from('wanted_requests')
      .select(PUBLIC_WANTED_SELECT)
      .eq('status', 'published')
      .order('published_at', { ascending: false });

    if (category) query = query.eq('category_slug', category);
    if (prefecture) query = query.eq('area_prefecture', prefecture);
    if (city) query = query.ilike('area_city', `%${city}%`);
    if (minPrice) query = query.gte('budget', Number(minPrice));
    if (maxPrice) query = query.lte('budget', Number(maxPrice));
    if (q) query = query.or(`maker.ilike.%${q}%,model.ilike.%${q}%`);

    const { data } = await query.limit(50);
    wanted = (data ?? []) as unknown as PublicWanted[];
  }

  return { listings, wanted };
}

export function mergeMarketPosts(
  listings: PublicListing[],
  wanted: PublicWanted[],
  type: MarketType,
  sort: string
): MarketPost[] {
  const posts: MarketPost[] =
    type === 'listing'
      ? listings.map((post) => ({
          kind: 'listing' as const,
          post,
          date: post.published_at ?? post.created_at,
        }))
      : type === 'wanted'
        ? wanted.map((post) => ({
            kind: 'wanted' as const,
            post,
            date: post.published_at ?? post.created_at,
          }))
        : [
            ...listings.map((post) => ({
              kind: 'listing' as const,
              post,
              date: post.published_at ?? post.created_at,
            })),
            ...wanted.map((post) => ({
              kind: 'wanted' as const,
              post,
              date: post.published_at ?? post.created_at,
            })),
          ];

  if (sort === 'price') {
    return posts.sort((a, b) => {
      const priceA = a.kind === 'listing' ? a.post.asking_price ?? 0 : a.post.budget ?? 0;
      const priceB = b.kind === 'listing' ? b.post.asking_price ?? 0 : b.post.budget ?? 0;
      return priceB - priceA;
    });
  }

  if (sort === 'year') {
    return posts.sort((a, b) => {
      const yearA = a.kind === 'listing' ? a.post.manufacture_year ?? 0 : 0;
      const yearB = b.kind === 'listing' ? b.post.manufacture_year ?? 0 : 0;
      return yearB - yearA;
    });
  }

  return posts.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export function parseCasesPage(page: string | undefined): number {
  const n = parseInt(page ?? '1', 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function paginateList<T>(
  items: T[],
  page: number,
  perPage = CASES_PER_PAGE
): { slice: T[]; total: number; totalPages: number; currentPage: number; from: number; to: number } {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const from = (currentPage - 1) * perPage;
  const to = Math.min(from + perPage, total);
  return {
    slice: items.slice(from, to),
    total,
    totalPages,
    currentPage,
    from: total === 0 ? 0 : from + 1,
    to,
  };
}
