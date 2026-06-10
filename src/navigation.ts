import { getBlogPermalink } from './utils/permalinks';

export const headerData = {
  links: [
    { text: 'さがす', href: '/cases?view=active' },
    { text: '売りたい', href: '/contact/sell' },
    { text: '買いたい', href: '/contact/buy' },
    { text: '相談', href: '/contact', highlight: true },
    { text: 'ブログ', href: getBlogPermalink() },
    { text: 'ログイン', href: '/auth/login' },
  ],
  actions: [] as Array<{ text: string; href: string; variant?: 'primary' | 'secondary'; class?: string }>,
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
