import { getEnv } from '~/lib/env';

type RuntimeLocals = {
  runtime?: {
    env?: Record<string, string | undefined>;
  };
};

export function getSiteUrl(locals?: RuntimeLocals): string {
  return getEnv('PUBLIC_SITE_URL', locals) || 'https://clinicmatch.org';
}

export function formatAnonArea(city: string): string {
  return `${city}の医療機関`;
}

export function formatListingTitle(maker: string, model: string): string {
  return `${maker} ${model}`;
}

export function formatWantedTitle(maker: string | null, model: string | null, category: string): string {
  if (maker && model) return `${maker} ${model}`;
  return category;
}
