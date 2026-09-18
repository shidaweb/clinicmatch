import { CATEGORY_SLUGS } from './categories';

/** Generated category illustrations, never photographs of the listed unit. */
export function categoryImageUrl(category: string | null | undefined, kind = 'device', width: 480 | 960 = 480) {
  const key = kind !== 'device' ? 'consumable' : CATEGORY_SLUGS.includes(category ?? '') ? category : 'others';
  return `/images/categories/${key}-${width}.webp`;
}

export const categoryImageCaption = '（写真はイメージです）';
