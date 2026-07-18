/**
 * 機器カテゴリマスタ（正典）
 *
 * カテゴリの追加・変更はこのファイルと以下を同時に更新すること:
 * - supabase/seed/categories.sql（＋本番反映用のマイグレーション）
 * - src/content/categories/<slug>.md（カテゴリ紹介ページ）
 * - src/content/config.ts の casesCollection.category enum
 *
 * 分類ルール:
 * - 「ピコレーザー」はピコ秒発振機のみ（PicoWay等は媒質がNd:YAGでもピコ扱い）。
 * - ナノ秒Qスイッチ機（トライビーム、アセット等）は「YAG・Qスイッチレーザー」。
 */

export type MarketCategory = {
  slug: string;
  /** 正式名称（フィルタ・フォーム・ナビで使用） */
  name: string;
  /** トップページ等で使う短いラベル */
  shortLabel: string;
  icon: string;
  sortOrder: number;
};

export const MARKET_CATEGORIES: MarketCategory[] = [
  { slug: 'hair-removal', name: '脱毛', shortLabel: '脱毛', icon: '⚡', sortOrder: 1 },
  { slug: 'pico-laser', name: 'ピコレーザー', shortLabel: 'ピコレーザー', icon: '✦', sortOrder: 2 },
  { slug: 'yag', name: 'YAG・Qスイッチレーザー', shortLabel: 'YAG・Qスイッチ', icon: '✧', sortOrder: 3 },
  { slug: 'co2', name: 'CO2レーザー', shortLabel: 'CO2レーザー', icon: '✺', sortOrder: 4 },
  { slug: 'ipl', name: 'IPL・光治療', shortLabel: 'IPL', icon: '◎', sortOrder: 5 },
  { slug: 'hifu', name: 'HIFU', shortLabel: 'HIFU', icon: '▲', sortOrder: 6 },
  { slug: 'rf', name: 'RF・高周波', shortLabel: 'RF', icon: '◉', sortOrder: 7 },
  { slug: 'body', name: '痩身・ボディ', shortLabel: '痩身', icon: '●', sortOrder: 8 },
  { slug: 'facial-care', name: 'ピーリング・導入', shortLabel: 'ピーリング・導入', icon: '✿', sortOrder: 9 },
  { slug: 'diagnostics', name: '診断・測定機器', shortLabel: '診断・測定', icon: '⊙', sortOrder: 10 },
  { slug: 'others', name: 'その他', shortLabel: 'その他', icon: '◆', sortOrder: 11 },
];

export const CATEGORY_SLUGS = MARKET_CATEGORIES.map((c) => c.slug);

export function categoryName(slug: string): string {
  return MARKET_CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;
}

export function categoryIconOf(slug: string): string {
  return MARKET_CATEGORIES.find((c) => c.slug === slug)?.icon ?? '◆';
}
