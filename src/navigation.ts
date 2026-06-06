import { getPermalink, getBlogPermalink, getHomePermalink } from './utils/permalinks';

export const headerData = {
  links: [
    { text: 'さがす', href: '/market' },
    { text: 'ブログ', href: getBlogPermalink() },
    { text: '取引事例', href: getPermalink('cases') },
  ],
  actions: [
    { text: '売りたいを出す', href: '/account/listings/new', variant: 'primary' as const, class: 'btn-sell-header hidden xl:inline-flex' },
    { text: '買いたいを出す', href: '/account/wanted/new', variant: 'secondary' as const, class: 'btn-buy-header hidden xl:inline-flex' },
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
        { text: 'さがす', href: '/market' },
        { text: '売りたいを出す', href: '/account/listings/new' },
        { text: '買いたいを出す', href: '/account/wanted/new' },
        { text: '出品・購入を相談する', href: '/consult' },
      ],
    },
    {
      title: '取扱機器',
      links: [
        { text: '脱毛機', href: getPermalink('categories/hair-removal') },
        { text: 'ピコレーザー', href: getPermalink('categories/pico-laser') },
        { text: 'IPL・光治療', href: getPermalink('categories/ipl') },
        { text: 'HIFU', href: getPermalink('categories/hifu') },
        { text: 'RF・高周波', href: getPermalink('categories/rf') },
        { text: '痩身・ボディ', href: getPermalink('categories/body') },
      ],
    },
    {
      title: 'サービス',
      links: [
        { text: '取引事例', href: getPermalink('cases') },
        { text: 'ブログ', href: getBlogPermalink() },
        { text: 'LINEで相談', href: 'https://lin.ee/vepVhWc', target: '_blank' },
      ],
    },
    {
      title: '会社概要',
      links: [
        { text: '運営会社', href: getPermalink('/about') },
        { text: '利用規約', href: getPermalink('/terms') },
        { text: 'プライバシーポリシー', href: getPermalink('/privacy') },
      ],
    },
  ],
  secondaryLinks: [
    { text: '利用規約', href: getPermalink('/terms') },
    { text: 'プライバシーポリシー', href: getPermalink('/privacy') },
  ],
  socialLinks: [],
  footNote: '',
  showConsult: true,
};

export const homePermalink = getHomePermalink();
