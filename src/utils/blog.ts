import type { PaginateFunction } from 'astro';
import type { Post } from '~/types';
import { APP_BLOG } from 'astrowind:config';
import { cleanSlug, trimSlash, BLOG_BASE, POST_PERMALINK_PATTERN, CATEGORY_BASE, TAG_BASE } from './permalinks';
import { getSanityClient } from '~/lib/sanity';
import { POSTS_GROQ } from '~/lib/sanity.queries';

/** Image URL: GROQ uses mainImage.asset->url (string). Pass-through. */
function getSanityImageUrl(src: string | null | undefined): string | undefined {
  if (!src || typeof src !== 'string') return undefined;
  return src;
}

const generatePermalink = ({
  id,
  slug,
  publishDate,
  category,
}: {
  id: string;
  slug: string;
  publishDate: Date;
  category: string | undefined;
}) => {
  const year = String(publishDate.getFullYear()).padStart(4, '0');
  const month = String(publishDate.getMonth() + 1).padStart(2, '0');
  const day = String(publishDate.getDate()).padStart(2, '0');
  const hour = String(publishDate.getHours()).padStart(2, '0');
  const minute = String(publishDate.getMinutes()).padStart(2, '0');
  const second = String(publishDate.getSeconds()).padStart(2, '0');

  const permalink = POST_PERMALINK_PATTERN.replace('%slug%', slug)
    .replace('%id%', id)
    .replace('%category%', category || '')
    .replace('%year%', year)
    .replace('%month%', month)
    .replace('%day%', day)
    .replace('%hour%', hour)
    .replace('%minute%', minute)
    .replace('%second%', second);

  return permalink
    .split('/')
    .map((el) => trimSlash(el))
    .filter((el) => !!el)
    .join('/');
};

/** Phase1: turn plain text into minimal HTML for prose container. */
function plainToSimpleHtml(text: string | null | undefined): string {
  if (!text || typeof text !== 'string') return '';
  const Esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const t = Esc(text);
  const inner = t.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br />');
  return `<p>${inner}</p>`;
}

type SanityPost = {
  _id: string;
  title?: string | null;
  slug?: string | null;
  publishedAt?: string | null;
  _updatedAt?: string | null;
  excerpt?: string | null;
  mainImage?: string | { _ref?: string } | null;
  category?: { slug?: string | null; title?: string | null } | null;
  tags?: Array<{ slug?: string | null; title?: string | null }> | null;
  author?: string | null;
  bodyPlain?: string | null;
};

function sanityPostToPost(p: SanityPost): Post {
  const slug = cleanSlug(p.slug || p._id);
  const publishDate = p.publishedAt ? new Date(p.publishedAt) : new Date();
  const updateDate = p._updatedAt ? new Date(p._updatedAt) : undefined;

  const category =
    p.category && (p.category.slug || p.category.title)
      ? { slug: cleanSlug(p.category.slug || p.category.title || ''), title: p.category.title || p.category.slug || '' }
      : undefined;

  const tags = (p.tags || [])
    .filter((t) => t && (t.slug || t.title))
    .map((t) => ({ slug: cleanSlug(t!.slug || t!.title || ''), title: t!.title || t!.slug || '' }));

  const image = getSanityImageUrl(typeof p.mainImage === 'string' ? p.mainImage : undefined);

  const basePermalink = generatePermalink({ id: p._id, slug, publishDate, category: category?.slug });
  const permalink =
    !BLOG_BASE || basePermalink === BLOG_BASE || basePermalink.startsWith(BLOG_BASE + '/')
      ? basePermalink
      : [BLOG_BASE, basePermalink].filter(Boolean).join('/');

  return {
    id: p._id,
    slug,
    permalink,

    publishDate,
    updateDate,

    title: p.title || '',
    excerpt: p.excerpt ?? undefined,
    image,

    category,
    tags,
    author: p.author ?? undefined,

    draft: false,

    metadata: {},

    Content: undefined,
    content: plainToSimpleHtml(p.bodyPlain),

    readingTime: undefined,
  };
}

const load = async function (): Promise<Array<Post>> {
  const client = getSanityClient();
  const raw = (await client.fetch<SanityPost[]>(POSTS_GROQ)) || [];

  return raw
    .filter((p) => p && (p.slug || p._id))
    .map(sanityPostToPost)
    .sort((a, b) => b.publishDate.valueOf() - a.publishDate.valueOf());
};

let _posts: Array<Post>;

/** */
export const isBlogEnabled = APP_BLOG.isEnabled;
export const isRelatedPostsEnabled = APP_BLOG.isRelatedPostsEnabled;
export const isBlogListRouteEnabled = APP_BLOG.list.isEnabled;
export const isBlogPostRouteEnabled = APP_BLOG.post.isEnabled;
export const isBlogCategoryRouteEnabled = APP_BLOG.category.isEnabled;
export const isBlogTagRouteEnabled = APP_BLOG.tag.isEnabled;

export const blogListRobots = APP_BLOG.list.robots;
export const blogPostRobots = APP_BLOG.post.robots;
export const blogCategoryRobots = APP_BLOG.category.robots;
export const blogTagRobots = APP_BLOG.tag.robots;

export const blogPostsPerPage = APP_BLOG?.postsPerPage;

/** */
export const fetchPosts = async (): Promise<Array<Post>> => {
  if (!_posts) {
    _posts = await load();
  }

  return _posts;
};

/** */
export const findPostsBySlugs = async (slugs: Array<string>): Promise<Array<Post>> => {
  if (!Array.isArray(slugs)) return [];

  const posts = await fetchPosts();

  return slugs.reduce(function (r: Array<Post>, slug: string) {
    posts.some(function (post: Post) {
      return slug === post.slug && r.push(post);
    });
    return r;
  }, []);
};

/** */
export const findPostsByIds = async (ids: Array<string>): Promise<Array<Post>> => {
  if (!Array.isArray(ids)) return [];

  const posts = await fetchPosts();

  return ids.reduce(function (r: Array<Post>, id: string) {
    posts.some(function (post: Post) {
      return id === post.id && r.push(post);
    });
    return r;
  }, []);
};

/** */
export const findLatestPosts = async ({ count }: { count?: number }): Promise<Array<Post>> => {
  const _count = count || 4;
  const posts = await fetchPosts();

  return posts ? posts.slice(0, _count) : [];
};

/** */
export const getStaticPathsBlogList = async ({ paginate }: { paginate: PaginateFunction }) => {
  if (!isBlogEnabled || !isBlogListRouteEnabled) return [];
  return paginate(await fetchPosts(), {
    params: { blog: BLOG_BASE || undefined },
    pageSize: blogPostsPerPage,
  });
};

/** */
export const getStaticPathsBlogPost = async () => {
  if (!isBlogEnabled || !isBlogPostRouteEnabled) return [];
  return (await fetchPosts()).flatMap((post) => ({
    params: {
      blog: post.permalink,
    },
    props: { post },
  }));
};

/** */
export const getStaticPathsBlogCategory = async ({ paginate }: { paginate: PaginateFunction }) => {
  if (!isBlogEnabled || !isBlogCategoryRouteEnabled) return [];

  const posts = await fetchPosts();
  const categories: Record<string, { slug: string; title: string }> = {};
  posts.forEach((post) => {
    if (post.category?.slug) {
      categories[post.category.slug] = post.category;
    }
  });

  return Array.from(Object.keys(categories)).flatMap((categorySlug) =>
    paginate(
      posts.filter((post) => post.category?.slug && categorySlug === post.category?.slug),
      {
        params: { category: categorySlug, blog: CATEGORY_BASE || undefined },
        pageSize: blogPostsPerPage,
        props: { category: categories[categorySlug] },
      }
    )
  );
};

/** */
export const getStaticPathsBlogTag = async ({ paginate }: { paginate: PaginateFunction }) => {
  if (!isBlogEnabled || !isBlogTagRouteEnabled) return [];

  const posts = await fetchPosts();
  const tags: Record<string, { slug: string; title: string }> = {};
  posts.forEach((post) => {
    if (Array.isArray(post.tags)) {
      post.tags.forEach((tag) => {
        if (tag?.slug) tags[tag.slug] = tag;
      });
    }
  });

  return Array.from(Object.keys(tags)).flatMap((tagSlug) =>
    paginate(
      posts.filter((post) => Array.isArray(post.tags) && post.tags.find((elem) => elem.slug === tagSlug)),
      {
        params: { tag: tagSlug, blog: TAG_BASE || undefined },
        pageSize: blogPostsPerPage,
        props: { tag: tags[tagSlug] },
      }
    )
  );
};

/** */
export async function getRelatedPosts(originalPost: Post, maxResults: number = 4): Promise<Post[]> {
  const allPosts = await fetchPosts();
  const originalTagsSet = new Set(originalPost.tags ? originalPost.tags.map((tag) => tag.slug) : []);

  const postsWithScores = allPosts.reduce((acc: { post: Post; score: number }[], iteratedPost: Post) => {
    if (iteratedPost.slug === originalPost.slug) return acc;

    let score = 0;
    if (iteratedPost.category && originalPost.category && iteratedPost.category.slug === originalPost.category.slug) {
      score += 5;
    }

    if (iteratedPost.tags) {
      iteratedPost.tags.forEach((tag) => {
        if (originalTagsSet.has(tag.slug)) {
          score += 1;
        }
      });
    }

    acc.push({ post: iteratedPost, score });
    return acc;
  }, []);

  postsWithScores.sort((a, b) => b.score - a.score);

  const selectedPosts: Post[] = [];
  let i = 0;
  while (selectedPosts.length < maxResults && i < postsWithScores.length) {
    selectedPosts.push(postsWithScores[i].post);
    i++;
  }

  return selectedPosts;
}
