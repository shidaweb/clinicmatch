/**
 * GROQ queries for Sanity blog (post).
 * Drafts are excluded: !(_id in path("drafts.**"))
 */

/** Fields used in list and detail. body as raw Portable Text for HTML conversion. */
const postProjection = `{
  _id,
  title,
  "slug": slug.current,
  publishedAt,
  _updatedAt,
  excerpt,
  "mainImage": mainImage.asset->url,
  category,
  tags,
  body
}`;

/** List: for /blog, /blog/category/..., /blog/tag/... (draft 除外, slug 必須) */
export const POSTS_GROQ = `*[_type == "post" && !(_id in path("drafts.**")) && defined(slug.current)] | order(publishedAt desc) ${postProjection}`;

/** Detail by slug (optional; load() uses POSTS_GROQ and bodyPlain is included there). */
export const POST_BY_SLUG_GROQ = `*[_type == "post" && !(_id in path("drafts.**")) && defined(slug.current) && slug.current == $slug][0] ${postProjection}`;

/** Slugs only: for getStaticPaths */
export const POST_SLUGS_GROQ = `*[_type == "post" && !(_id in path("drafts.**")) && defined(slug.current)].slug.current`;
