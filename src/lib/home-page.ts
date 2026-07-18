import type { CollectionEntry } from 'astro:content';
import { categoryIconOf } from './categories';

export type DoneCasePreview = {
  slug: string;
  manufacturer: string;
  model: string;
  categoryLabel: string;
  category: string;
  transactionDate: string;
  priceRange: string;
};

export function categoryIcon(category: string): string {
  return categoryIconOf(category);
}

export function formatTransactionMonth(ym: string): string {
  if (!ym || ym.length < 7) return ym;
  const [y, m] = ym.split('-');
  return `${y}年${Number(m)}月成約`;
}

export function selectRecentDoneCases(
  cases: CollectionEntry<'cases'>[],
  limit = 3
): DoneCasePreview[] {
  return cases
    .filter((entry) => entry.data.priceRange?.trim())
    .sort(
      (a, b) =>
        new Date(b.data.transactionDate).getTime() - new Date(a.data.transactionDate).getTime()
    )
    .slice(0, limit)
    .map((entry) => ({
      slug: entry.data.slug ?? entry.slug,
      manufacturer: entry.data.manufacturer,
      model: entry.data.model,
      categoryLabel: entry.data.categoryLabel,
      category: entry.data.category,
      transactionDate: entry.data.transactionDate,
      priceRange: entry.data.priceRange,
    }));
}

export function countDoneCasesWithPrice(cases: CollectionEntry<'cases'>[]): number {
  return cases.filter((entry) => entry.data.priceRange?.trim()).length;
}
