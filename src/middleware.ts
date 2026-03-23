import { defineMiddleware } from 'astro:middleware';

const CANONICAL_HOST = 'clinicmatch.org';
const WWW_HOST = `www.${CANONICAL_HOST}`;
const CANONICAL_ORIGIN = `https://${CANONICAL_HOST}`;
const LOCALHOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export const onRequest = defineMiddleware(async (context, next) => {
  const { url } = context;
  const isLocalDevHost = LOCALHOSTS.has(url.hostname);

  // Force HTTPS and a single canonical host for SEO consistency.
  if (!isLocalDevHost && url.protocol === 'http:') {
    const destination = new URL(`${url.pathname}${url.search}`, `https://${url.host}`);
    return context.redirect(destination.toString(), 308);
  }

  if (url.hostname === WWW_HOST) {
    const destination = new URL(`${url.pathname}${url.search}`, CANONICAL_ORIGIN);
    return context.redirect(destination.toString(), 308);
  }

  return next();
});
