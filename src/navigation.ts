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
      text: '取扱機器',
      href: getPermalink('categories'),
      links: [
        { text: 'カテゴリ一覧', href: getPermalink('categories') },
        { text: '脱毛機', href: getPermalink('categories/hair-removal') },
        { text: 'ピコレーザー', href: getPermalink('categories/pico-laser') },
        { text: 'IPL・光治療', href: getPermalink('categories/ipl') },
        { text: 'HIFU', href: getPermalink('categories/hifu') },
        { text: 'RF・高周波', href: getPermalink('categories/rf') },
        { text: '痩身・ボディ', href: getPermalink('categories/body') },
      ],
    },
    { text: '取引事例', href: getPermalink('cases') },
    { text: 'ブログ', href: getBlogPermalink() },
    {
      text: 'よくある質問',
      links: [
        { text: '相談例', href: getHomePermalink() + '#sodanrei' },
        { text: 'FAQ', href: getHomePermalink() + '#faq' },
      ],
    },
  ],
  actions: [{ text: 'LINEで相談する', href: 'https://lin.ee/vepVhWc', variant: 'line', target: '_blank' }],
};

export const footerData = {
  links: [
    {
      title: 'サービス概要',
      links: [
        { text: 'クリニックマッチの強み', href: getHomePermalink() + '#features' },
        { text: '取引の考え方', href: getHomePermalink() + '#torihiki' },
        { text: 'ご利用の流れ', href: '#' },
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
      title: 'お問い合わせ',
      links: [
        { text: '購入希望のお問い合わせ', href: 'https://form.fillout.com/t/afCsAehK2qus', dataOpenAsPopup: true },
        { text: '売却希望のお問い合わせ', href: 'https://form.fillout.com/t/bXT2fHZkgtus', dataOpenAsPopup: true },
        { text: 'LINEで売買をご相談', href: 'https://lin.ee/vepVhWc', target: '_blank' },
      ],
    },
    {
      title: '会社概要',
      links: [
        { text: '株式会社キラックについて', href: getPermalink('/about') },
        { text: 'ブログ', href: getBlogPermalink() },
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
