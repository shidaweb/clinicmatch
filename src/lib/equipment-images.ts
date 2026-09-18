/** User-supplied sample photographs. Never represent these as the listed unit. */
export type EquipmentImage = {
  key: string;
  name: string;
  maker: string;
  category: string;
  models: string[];
  makers: string[];
};
export const equipmentImages: EquipmentImage[] = [
  {
    key: 'gentlemax-pro',
    name: 'GentleMax Pro',
    maker: 'Candela',
    category: 'hair-removal',
    models: ['GentleMax Pro', 'ジェントルマックスプロ'],
    makers: ['candela', 'キャンデラ', 'シネロン'],
  },
  {
    key: 'mediostar-monolith',
    name: 'MeDioStar Monolith',
    maker: 'Asclepion',
    category: 'hair-removal',
    models: ['MeDioStar Monolith', 'メディオスターモノリス'],
    makers: ['asclepion', 'アスクレピオン', 'asclepionlaser'],
  },
  {
    key: 'xeo',
    name: 'xeo',
    maker: 'CUTERA',
    category: 'ipl',
    models: ['xeo', 'ゼオ'],
    makers: ['cutera', 'キュテラ', 'キュテラ社'],
  },
  {
    key: 'ulthera',
    name: 'ウルセラ',
    maker: 'Ulthera / Merz',
    category: 'hifu',
    models: ['Ulthera', 'ウルセラ', 'Ultherapy'],
    makers: ['ulthera', 'merz', 'メルツ', 'ジェイメック', 'jmec', 'ウルセラ'],
  },
  {
    key: 'picoway',
    name: 'PicoWay',
    maker: 'Candela',
    category: 'pico-laser',
    models: ['PicoWay', 'ピコウェイ'],
    makers: ['candela', 'キャンデラ', 'シネロン'],
  },
];
const normalize = (value: string) =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s・／/._-]/g, '');
export const equipmentImageUrl = (image: EquipmentImage, width: 480 | 960 = 480) =>
  `/images/equipment/${image.key}-${width}.webp`;
export function findEquipmentImage(
  maker: string | null | undefined,
  model: string | null | undefined,
  kind = 'device'
): EquipmentImage | null {
  if (kind !== 'device' || !model || !maker) return null;
  const modelKey = normalize(model);
  const makerKey = normalize(maker);
  return (
    equipmentImages.find(
      (image) =>
        image.models.some((alias) => normalize(alias) === modelKey) &&
        image.makers.some((alias) => makerKey.includes(normalize(alias)))
    ) ?? null
  );
}
export const sampleImageNotice = '参考画像（出品個体の写真ではありません）。状態・付属品は出品内容をご確認ください。';
