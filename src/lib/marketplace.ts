/** Anonymous display helpers — never expose org name or contact info on public pages */

export function anonymousOrgLabel(city: string): string {
  return `${city}の医療機関`;
}

export function formatPriceYen(amount: number | null | undefined): string {
  if (amount == null) return '応相談';
  return `${amount.toLocaleString('ja-JP')}円`;
}

export function formatLocation(prefecture: string, city: string): string {
  return `${prefecture}${city}`;
}

export const MAINTENANCE_LABELS: Record<string, string> = {
  yes: 'メーカー保守あり',
  no: 'メーカー保守なし',
  unknown: 'メーカー保守：不明',
};

export const TRANSFER_LABELS: Record<string, string> = {
  yes: '保守引継ぎ可',
  no: '保守引継ぎ不可',
  unknown: '保守引継ぎ：不明',
};

export const POST_STATUS_LABELS: Record<string, string> = {
  draft: '下書き',
  pending_review: '審査中',
  published: '公開中',
  reserved: '保留',
  closed: '終了',
};

export const PREFECTURES = [
  '北海道',
  '青森県',
  '岩手県',
  '宮城県',
  '秋田県',
  '山形県',
  '福島県',
  '茨城県',
  '栃木県',
  '群馬県',
  '埼玉県',
  '千葉県',
  '東京都',
  '神奈川県',
  '新潟県',
  '富山県',
  '石川県',
  '福井県',
  '山梨県',
  '長野県',
  '岐阜県',
  '静岡県',
  '愛知県',
  '三重県',
  '滋賀県',
  '京都府',
  '大阪府',
  '兵庫県',
  '奈良県',
  '和歌山県',
  '鳥取県',
  '島根県',
  '岡山県',
  '広島県',
  '山口県',
  '徳島県',
  '香川県',
  '愛媛県',
  '高知県',
  '福岡県',
  '佐賀県',
  '長崎県',
  '熊本県',
  '大分県',
  '宮崎県',
  '鹿児島県',
  '沖縄県',
] as const;

export type PublicListing = {
  id: string;
  category_slug: string;
  maker: string;
  model: string;
  manufacture_year: number | null;
  condition: string | null;
  asking_price: number | null;
  location_prefecture: string;
  location_city: string;
  has_accessories: boolean | null;
  accessories_detail: string | null;
  maker_maintenance: string | null;
  maintenance_transferable: string | null;
  maintenance_notes: string | null;
  description: string | null;
  published_at: string | null;
  created_at: string;
  categories?: { name: string } | null;
  listing_images?: Array<{ storage_path: string; is_cover: boolean }>;
};

export type PublicWanted = {
  id: string;
  category_slug: string;
  maker: string | null;
  model: string | null;
  condition_pref: string | null;
  budget: number | null;
  desired_timing: string | null;
  area_prefecture: string | null;
  area_city: string | null;
  requirements: string | null;
  reference_image_path: string | null;
  published_at: string | null;
  created_at: string;
  categories?: { name: string } | null;
};

/** Safe public select — excludes org private fields */
export const PUBLIC_LISTING_SELECT = `
  id, category_slug, maker, model, manufacture_year, condition,
  asking_price, location_prefecture, location_city,
  has_accessories, accessories_detail, maker_maintenance,
  maintenance_transferable, maintenance_notes, description,
  published_at, created_at,
  categories(name),
  listing_images(storage_path, is_cover, sort_order)
`;

export const PUBLIC_WANTED_SELECT = `
  id, category_slug, maker, model, condition_pref, budget,
  desired_timing, area_prefecture, area_city, requirements, reference_image_path,
  published_at, created_at,
  categories(name)
`;
