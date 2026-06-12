import { getBlogPermalink } from './utils/permalinks';

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
      links: [
        { text: '脱毛機', href: '/categories/hair-removal' },
        { text: 'ピコレーザー', href: '/categories/pico-laser' },
        { text: 'IPL・光治療', href: '/categories/ipl' },
        { text: 'HIFU', href: '/categories/hifu' },
        { text: 'RF・高周波', href: '/categories/rf' },
        { text: '痩身・ボディ', href: '/categories/body' },
      ],
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
  footNote: '© 2026 株式会社キラック all rights reserved.',
  showConsult: false,
};
