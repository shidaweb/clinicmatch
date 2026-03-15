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

/** ── Portable Text → HTML converter ────────────────────── */

type PTSpan = {
  _type: 'span';
  text?: string;
  marks?: string[];
};

type PTBlock = {
  _type: 'block';
  _key?: string;
  style?: string;
  listItem?: 'bullet' | 'number';
  level?: number;
  markDefs?: Array<{ _key: string; _type: string; href?: string }>;
  children?: PTSpan[];
};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderSpans(children: PTSpan[], markDefs: Array<{ _key: string; _type: string; href?: string }> = []): string {
  return (children || [])
    .map((span) => {
      if (span._type !== 'span') return '';
      let text = esc(span.text || '');
      const marks = span.marks || [];
      for (const mark of marks) {
        if (mark === 'strong') text = `<strong>${text}</strong>`;
        else if (mark === 'em') text = `<em>${text}</em>`;
        else if (mark === 'underline') text = `<u>${text}</u>`;
        else if (mark === 'strike-through') text = `<s>${text}</s>`;
        else if (mark === 'code') text = `<code>${text}</code>`;
        else {
          const def = markDefs.find((d) => d._key === mark);
          if (def && def._type === 'link' && def.href) {
            text = `<a href="${esc(def.href)}" rel="noopener noreferrer">${text}</a>`;
          }
        }
      }
      return text;
    })
    .join('');
}

function portableTextToHtml(blocks: PTBlock[] | null | undefined): string {
  if (!blocks || !Array.isArray(blocks)) return '';

  const html: string[] = [];
  let openList: 'bullet' | 'number' | null = null;

  function closeList() {
    if (openList === 'bullet') html.push('</ul>');
    else if (openList === 'number') html.push('</ol>');
    openList = null;
  }

  for (const block of blocks) {
    if (block._type !== 'block') continue;

    const inner = renderSpans(block.children || [], block.markDefs || []);

    // List items
    if (block.listItem) {
      if (openList !== block.listItem) {
        closeList();
        openList = block.listItem;
        html.push(block.listItem === 'bullet' ? '<ul>' : '<ol>');
      }
      html.push(`<li>${inner}</li>`);
      continue;
    }

    // Close any open list before non-list block
    closeList();

    const style = block.style || 'normal';
    switch (style) {
      case 'h1':
        html.push(`<h1>${inner}</h1>`);
        break;
      case 'h2':
        html.push(`<h2>${inner}</h2>`);
        break;
      case 'h3':
        html.push(`<h3>${inner}</h3>`);
        break;
      case 'h4':
        html.push(`<h4>${inner}</h4>`);
        break;
      case 'blockquote':
        html.push(`<blockquote><p>${inner}</p></blockquote>`);
        break;
      default:
        if (inner.trim()) html.push(`<p>${inner}</p>`);
        break;
    }
  }

  closeList();
  return html.join('\n');
}

/** Category value → {slug, title} mapping */
const CATEGORY_MAP: Record<string, string> = {
  'hair-removal': '脱毛',
  'pico': 'ピコ',
  'ipl': 'IPL',
  'hifu': 'HIFU',
  'rf': 'RF・高周波',
  'body': '痩身・ボディ',
  'ops': '運用・設置',
  'pricing': '相場・査定',
};

type SanityPost = {
  _id: string;
  title?: string | null;
  slug?: string | null;
  publishedAt?: string | null;
  _updatedAt?: string | null;
  excerpt?: string | null;
  mainImage?: string | { _ref?: string } | null;
  category?: string | null;
  tags?: string[] | null;
  body?: PTBlock[] | null;
};

function sanityPostToPost(p: SanityPost): Post {
  const slug = cleanSlug(p.slug || p._id);
  const publishDate = p.publishedAt ? new Date(p.publishedAt) : new Date();
  const updateDate = p._updatedAt ? new Date(p._updatedAt) : undefined;

  const category = p.category
    ? { slug: cleanSlug(p.category), title: CATEGORY_MAP[p.category] || p.category }
    : undefined;

  const tags = (p.tags || [])
    .filter((t) => !!t)
    .map((t) => ({ slug: cleanSlug(t), title: t }));

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
    author: undefined,

    draft: false,

    metadata: {},

    Content: undefined,
    content: portableTextToHtml(p.body),

    readingTime: undefined,
  };
}

const load = async function (): Promise<Array<Post>> {
  try {
    const client = getSanityClient();
    const raw = (await client.fetch<SanityPost[]>(POSTS_GROQ)) || [];

    return raw
      .filter((p) => p && (p.slug || p._id))
      .map(sanityPostToPost)
      .sort((a, b) => b.publishDate.valueOf() - a.publishDate.valueOf());
  } catch (e) {
    console.error('[blog] Failed to fetch posts from Sanity:', e);
    return [];
  }
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
