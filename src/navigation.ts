import { getPermalink, getBlogPermalink, getHomePermalink } from './utils/permalinks';

export const headerData = {
  links: [
    {
      text: 'クリニックマッチとは',
      links: [
        { text: '強み', href: getHomePermalink() + '#features' },
        { text: '取引の考え方', href: getHomePermalink() + '#torihiki' },
      ],
    },
    {
      text: 'よくある質問',
      links: [
        { text: '相談例', href: getHomePermalink() + '#sodanrei' },
        { text: 'FAQ', href: getHomePermalink() + '#faq' },
      ],
    },
    { text: 'ブログ', href: getBlogPermalink() },
  ],
  actions: [{ text: 'LINEで売買を相談する', href: 'https://lin.ee/vepVhWc', variant: 'line', target: '_blank' }],
};

export const footerData = {
  links: [
    {
      title: 'サービス概要',
      links: [
        { text: 'クリニックマッチの強み', href: getHomePermalink() + '#features' },
        { text: '取引の考え方', href: getHomePermalink() + '#torihiki' },
      ],
    },
    {
      title: 'お問い合わせ',
      links: [
        { text: '購入希望のお問い合わせ', href: '#', dataFilloutOpen: 'afCsAehK2qus' },
        { text: '売却希望のお問い合わせ', href: '#' },
        { text: 'LINEで売買をご相談', href: 'https://lin.ee/vepVhWc', target: '_blank' },
      ],
    },
    {
      title: '会社概要',
      links: [
        { text: '株式会社キラックについて', href: getPermalink('/about') },
        { text: 'ブログ：美容医療の中古市場を整備する人', href: getBlogPermalink() },
      ],
    },
  ],
  secondaryLinks: [
    { text: '利用規約', href: getPermalink('/terms') },
    { text: 'プライバシーポリシー', href: getPermalink('/privacy') },
  ],
  socialLinks: [],
  footNote: '',
};
