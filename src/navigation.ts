import { getBlogPermalink } from './utils/permalinks';

export const headerData = {
  links: [
    { text: 'さがす', href: '/cases?view=active' },
    { text: 'ブログ', href: getBlogPermalink() },
    { text: '成約事例', href: '/cases?view=done' },
  ],
  actions: [
    { text: '売りたい', href: '/account/listings/new', variant: 'primary' as const, class: 'btn-sell-header !rounded-full !py-2 !px-5 !text-sm' },
    { text: '買いたい', href: '/account/wanted/new', variant: 'secondary' as const, class: 'btn-buy-header !rounded-full !py-2 !px-5 !text-sm !text-white' },
  ],
  showConsult: true,
  accountHref: '/account',
  loginHref: '/auth/login',
};

export const footerData = {
  links: [
    {
      title: 'マーケット',
      links: [
        { text: '在庫をさがす', href: '/cases?view=active' },
        { text: '売りたいを出す', href: '/account/listings/new' },
        { text: '買いたいを出す', href: '/account/wanted/new' },
        { text: '出品・購入を相談する', href: '/contact' },
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
      title: 'サービス',
      links: [
        { text: '成約事例', href: '/cases?view=done' },
        { text: 'ブログ', href: getBlogPermalink() },
        { text: 'LINEで相談', href: 'https://lin.ee/vepVhWc', target: '_blank' },
      ],
    },
    {
      title: '会社概要',
      links: [
        { text: '運営会社', href: '/about' },
        { text: '利用規約', href: '/terms' },
        { text: 'プライバシーポリシー', href: '/privacy' },
      ],
    },
  ],
  secondaryLinks: [
    { text: '利用規約', href: '/terms' },
    { text: 'プライバシーポリシー', href: '/privacy' },
  ],
  socialLinks: [],
  footNote: '',
  showConsult: true,
};
