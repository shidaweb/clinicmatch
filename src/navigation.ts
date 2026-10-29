import { getBlogPermalink } from './utils/permalinks';
import { MARKET_CATEGORIES } from './lib/categories';

export const headerData = {
  links: [
    { text: '在庫をさがす', href: '/cases?view=active' },
    { text: '消耗品', href: '/cases?view=active&listingKind=consumable' },
    { text: '成約事例', href: '/cases?view=done' },
    { text: '読み物', href: getBlogPermalink() },
  ],
  actions: [
    {
      text: 'マイページ',
      href: '/account',
      variant: 'tertiary' as const,
      class: 'max-[479px]:hidden border border-line rounded-pill px-4 py-2 text-sm font-medium text-plum hover:bg-cream',
    },
    {
      text: '相談する',
      href: '/contact',
      variant: 'primary' as const,
      class: 'text-sm',
    },
  ],
  showConsult: false,
  accountHref: '/account',
  loginHref: '/auth/login',
};

export const footerData = {
  links: [
    {
      title: 'サービス',
      links: [
        { text: '在庫をさがす', href: '/cases?view=active' },
        { text: '消耗品をさがす', href: '/cases?view=active&listingKind=consumable' },
        { text: '売りたいを出す', href: '/contact/sell' },
        { text: '買いたいを出す', href: '/contact/buy' },
        { text: '出品・購入を相談する', href: '/contact' },
        { text: '成約事例', href: '/cases?view=done' },
      ],
    },
    {
      title: '取扱機器',
      links: MARKET_CATEGORIES.map((c) => ({
        text: c.slug === 'hair-removal' ? '脱毛機' : c.name,
        href: `/categories/${c.slug}`,
      })),
    },
    {
      title: 'お問い合わせ',
      links: [
        { text: '相談フォーム', href: '/contact' },
        { text: 'LINEで相談', href: 'https://lin.ee/vepVhWc', target: '_blank' },
        { text: 'ブログ', href: getBlogPermalink() },
      ],
    },
    {
      title: '会社概要',
      links: [
        { text: '運営会社について', href: '/about' },
        { text: '利用規約', href: '/terms' },
        { text: 'プライバシーポリシー', href: '/privacy' },
      ],
    },
  ],
  secondaryLinks: [
    { text: '利用規約', href: '/terms' },
    { text: 'プライバシーポリシー', href: '/privacy' },
  ],
  footNote: '© 2026 あるそら株式会社 all rights reserved.',
  operator: { text: 'あるそら株式会社（ALSOLA Inc.）', href: 'https://alsola.co.jp' },
  sisterSites: [
  {
    "text": "ウレシニア Webサポート",
    "description": "電話で話しながら、Webの閲覧や操作をお手伝いします。",
    "href": "https://uresenior.com/"
  },
  {
    "text": "トラックマッチ",
    "description": "中古トラックの購入と売却をお手伝いします。",
    "href": "https://www.truckmatch.jp/"
  },
  {
    "text": "Tenbin.link",
    "description": "専門家への相談を予約し、日程を調整できます。",
    "href": "https://tenbin.link/"
  },
  {
    "text": "Sonae",
    "description": "クリニックの薬やサプリの在庫を管理できます。",
    "href": "https://sonae.clinic/"
  }
],
  showConsult: false,
};
