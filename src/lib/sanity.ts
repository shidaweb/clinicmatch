import { createClient } from '@sanity/client';

const projectId = import.meta.env.SANITY_PROJECT_ID;
const dataset = import.meta.env.SANITY_DATASET ?? 'production';
const apiVersion = import.meta.env.SANITY_API_VERSION ?? '2024-01-01';
const useCdn = import.meta.env.PUBLIC_SANITY_USE_CDN !== 'false';
const token = import.meta.env.SANITY_READ_TOKEN;

export function getSanityClient() {
  if (!projectId || !dataset) {
    console.error(
      '[sanity] Missing env: SANITY_PROJECT_ID and/or SANITY_DATASET. Check .env and Cloudflare Pages environment variables.'
    );
    // Return a minimal client that won't crash but will return empty results
    return createClient({
      projectId: projectId || 'missing',
      dataset: dataset || 'production',
      apiVersion,
      useCdn,
    });
  }

  return createClient({
    projectId,
    dataset,
    apiVersion,
    useCdn,
    ...(token ? { token } : {}),
  });
}
