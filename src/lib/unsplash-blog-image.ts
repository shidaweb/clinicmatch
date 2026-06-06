import fs from 'node:fs';
import path from 'node:path';

type BlogImageInput = {
  id: string;
  slug: string;
  title: string;
  excerpt?: string;
  category?: { slug: string; title: string };
  tags?: Array<{ slug: string; title: string }>;
};

/** English search hints per blog category */
const CATEGORY_SEARCH: Record<string, string> = {
  'hair-removal': 'laser hair removal medical spa aesthetic clinic',
  pico: 'picosecond laser dermatology aesthetic medical device',
  ipl: 'ipl photofacial light therapy aesthetic clinic',
  hifu: 'hifu ultrasound skin lifting aesthetic clinic',
  rf: 'radiofrequency skin treatment aesthetic medical',
  body: 'body contouring aesthetic clinic medical spa',
  ops: 'medical equipment installation clinic interior',
  pricing: 'medical business clinic office professional',
};

/** Curated Unsplash fallbacks (landscape, clinic / medical aesthetic) */
const CATEGORY_FALLBACKS: Record<string, string[]> = {
  'hair-removal': [
    'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1519494026892-22704544e220?auto=format&fit=crop&w=1200&q=80',
  ],
  pico: [
    'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1538108149393-fbbd81890309?auto=format&fit=crop&w=1200&q=80',
  ],
  ipl: [
    'https://images.unsplash.com/photo-1515377901643-3387f5951a75?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1570172619644-dfd955f4575e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=1200&q=80',
  ],
  hifu: [
    'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1631217868264-e5b165bb1e52?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1666214280387-5d4db0212fa2?auto=format&fit=crop&w=1200&q=80',
  ],
  rf: [
    'https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1551076805-e1869033a561?auto=format&fit=crop&w=1200&q=80',
  ],
  body: [
    'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=80',
  ],
  ops: [
    'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1581595434005-057172177f53?auto=format&fit=crop&w=1200&q=80',
  ],
  pricing: [
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80',
  ],
  default: [
    'https://images.unsplash.com/photo-1519494026892-22704544e220?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1538108149393-fbbd81890309?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
  ],
};

const CACHE_PATH = path.join(process.cwd(), '.cache/unsplash-blog-images.json');

type CacheEntry = { query: string; url: string };

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function readCache(): Record<string, CacheEntry> {
  try {
    if (fs.existsSync(CACHE_PATH)) {
      return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) as Record<string, CacheEntry>;
    }
  } catch {
    /* ignore */
  }
  return {};
}

function writeCacheEntry(slug: string, entry: CacheEntry) {
  try {
    const dir = path.dirname(CACHE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const cache = readCache();
    cache[slug] = entry;
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  } catch {
    /* ignore */
  }
}

/** Build an Unsplash search query from post metadata */
export function buildBlogImageQuery(post: BlogImageInput): string {
  const parts: string[] = [];

  if (post.category?.slug) {
    parts.push(CATEGORY_SEARCH[post.category.slug] ?? `${post.category.title} aesthetic clinic`);
  }

  if (post.tags?.length) {
    parts.push(...post.tags.slice(0, 3).map((t) => t.title));
  }

  // Romanize common brand / device keywords found in Japanese titles
  const brandHints = [
    ['キャンデラ', 'candela laser'],
    ['ジェントル', 'gentlemax laser'],
    ['ピコ', 'pico laser'],
    ['脱毛', 'hair removal laser'],
    ['HIFU', 'hifu ultrasound'],
    ['保守', 'medical maintenance'],
    ['中古', 'used medical equipment'],
    ['相場', 'medical business pricing'],
    ['設置', 'medical equipment installation'],
    ['クリニック', 'aesthetic clinic'],
  ];
  for (const [jp, en] of brandHints) {
    if (post.title.includes(jp)) parts.push(en);
  }

  parts.push('medical aesthetic');
  return [...new Set(parts.join(' ').split(/\s+/))].join(' ').slice(0, 120);
}

function fallbackImage(post: BlogImageInput): string {
  const key = post.category?.slug ?? 'default';
  const pool = CATEGORY_FALLBACKS[key] ?? CATEGORY_FALLBACKS.default;
  return pool[hashString(post.slug || post.id) % pool.length];
}

async function fetchFromUnsplash(query: string, page: number, accessKey: string): Promise<string | null> {
  const url = new URL('https://api.unsplash.com/search/photos');
  url.searchParams.set('query', query);
  url.searchParams.set('per_page', '1');
  url.searchParams.set('page', String(page));
  url.searchParams.set('orientation', 'landscape');
  url.searchParams.set('content_filter', 'high');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Client-ID ${accessKey}`, 'Accept-Version': 'v1' },
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    results?: Array<{ urls?: { regular?: string } }>;
  };

  const regular = data.results?.[0]?.urls?.regular;
  if (!regular) return null;

  const imageUrl = new URL(regular);
  imageUrl.searchParams.set('w', '1200');
  imageUrl.searchParams.set('q', '80');
  imageUrl.searchParams.set('auto', 'format');
  imageUrl.searchParams.set('fit', 'crop');
  return imageUrl.toString();
}

/** Resolve header image URL — uses Sanity image when set, else Unsplash */
export async function resolveBlogHeaderImage(
  post: BlogImageInput,
  existingImage?: string
): Promise<string | undefined> {
  if (existingImage) return existingImage;

  const query = buildBlogImageQuery(post);
  const cache = readCache();
  const cached = cache[post.slug];
  if (cached?.query === query && cached.url) return cached.url;

  const accessKey =
    (typeof process !== 'undefined' && process.env?.UNSPLASH_ACCESS_KEY?.trim()) ||
    import.meta.env.UNSPLASH_ACCESS_KEY?.trim();

  if (accessKey) {
    const page = (hashString(post.slug) % 5) + 1;
    try {
      const url = await fetchFromUnsplash(query, page, accessKey);
      if (url) {
        writeCacheEntry(post.slug, { query, url });
        return url;
      }
    } catch (e) {
      console.warn(`[unsplash] search failed for "${post.slug}":`, e);
    }
  }

  const url = fallbackImage(post);
  writeCacheEntry(post.slug, { query, url });
  return url;
}
