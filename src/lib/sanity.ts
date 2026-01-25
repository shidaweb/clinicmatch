import { createClient } from '@sanity/client';

const projectId = import.meta.env.SANITY_PROJECT_ID;
const dataset = import.meta.env.SANITY_DATASET ?? 'production';
const apiVersion = import.meta.env.SANITY_API_VERSION ?? '2024-01-01';
const useCdn = import.meta.env.PUBLIC_SANITY_USE_CDN !== 'false';
const token = import.meta.env.SANITY_READ_TOKEN;

export function getSanityClient() {
  if (!projectId || !dataset) {
    throw new Error(
      'Missing Sanity env: SANITY_PROJECT_ID and SANITY_DATASET are required. Check .env and Cloudflare Pages environment variables.'
    );
  }

  return createClient({
    projectId,
    dataset,
    apiVersion,
    useCdn,
    ...(token ? { token } : {}),
  });
}
