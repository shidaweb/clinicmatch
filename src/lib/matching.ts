import type { PublicListing, PublicWanted } from '~/lib/marketplace';

export type MatchScore = {
  post: PublicListing | PublicWanted;
  kind: 'listing' | 'wanted';
  score: number;
  reasons: string[];
};

function categoryMatch(a: string, b: string): boolean {
  return a === b;
}

/** Find published listings that may match a wanted request */
export function matchListingsForWanted(
  wanted: PublicWanted,
  listings: PublicListing[]
): MatchScore[] {
  return listings
    .map((listing) => {
      let score = 0;
      const reasons: string[] = [];

      if (categoryMatch(wanted.category_slug, listing.category_slug)) {
        score += 40;
        reasons.push('カテゴリ一致');
      }
      if (wanted.maker && listing.maker.toLowerCase().includes(wanted.maker.toLowerCase())) {
        score += 25;
        reasons.push('メーカー一致');
      }
      if (wanted.model && listing.model.toLowerCase().includes(wanted.model.toLowerCase())) {
        score += 25;
        reasons.push('型番一致');
      }
      if (wanted.budget && listing.asking_price && listing.asking_price <= wanted.budget) {
        score += 20;
        reasons.push('予算内');
      }
      if (
        wanted.area_prefecture &&
        listing.location_prefecture === wanted.area_prefecture
      ) {
        score += 10;
        reasons.push('エリア一致');
      }

      return { post: listing, kind: 'listing' as const, score, reasons };
    })
    .filter((m) => m.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

/** Find published wanted requests that may match a listing */
export function matchWantedForListing(
  listing: PublicListing,
  wantedList: PublicWanted[]
): MatchScore[] {
  return wantedList
    .map((wanted) => {
      let score = 0;
      const reasons: string[] = [];

      if (categoryMatch(listing.category_slug, wanted.category_slug)) {
        score += 40;
        reasons.push('カテゴリ一致');
      }
      if (wanted.maker && listing.maker.toLowerCase().includes(wanted.maker.toLowerCase())) {
        score += 25;
        reasons.push('メーカー一致');
      }
      if (wanted.model && listing.model.toLowerCase().includes(wanted.model.toLowerCase())) {
        score += 25;
        reasons.push('型番一致');
      }
      if (wanted.budget && listing.asking_price && listing.asking_price <= wanted.budget) {
        score += 20;
        reasons.push('予算内');
      }
      if (
        wanted.area_prefecture &&
        listing.location_prefecture === wanted.area_prefecture
      ) {
        score += 10;
        reasons.push('エリア一致');
      }

      return { post: wanted, kind: 'wanted' as const, score, reasons };
    })
    .filter((m) => m.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}
