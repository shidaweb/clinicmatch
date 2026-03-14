import { z, defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

const metadataDefinition = () =>
  z
    .object({
      title: z.string().optional(),
      ignoreTitleTemplate: z.boolean().optional(),

      canonical: z.string().url().optional(),

      robots: z
        .object({
          index: z.boolean().optional(),
          follow: z.boolean().optional(),
        })
        .optional(),

      description: z.string().optional(),

      openGraph: z
        .object({
          url: z.string().optional(),
          siteName: z.string().optional(),
          images: z
            .array(
              z.object({
                url: z.string(),
                width: z.number().optional(),
                height: z.number().optional(),
              })
            )
            .optional(),
          locale: z.string().optional(),
          type: z.string().optional(),
        })
        .optional(),

      twitter: z
        .object({
          handle: z.string().optional(),
          site: z.string().optional(),
          cardType: z.string().optional(),
        })
        .optional(),
    })
    .optional();

const postCollection = defineCollection({
  loader: glob({ pattern: ['*.md', '*.mdx'], base: 'src/data/post' }),
  schema: z.object({
    publishDate: z.date().optional(),
    updateDate: z.date().optional(),
    draft: z.boolean().optional(),

    title: z.string(),
    excerpt: z.string().optional(),
    image: z.string().optional(),

    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    author: z.string().optional(),

    metadata: metadataDefinition(),
  }),
});

// Content Collection スキーマ定義（セクション7）
const casesCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    // slug は Astro が予約しておりスキーマに含めない（frontmatterの slug はそのまま使用可）
    category: z.enum([
      'hair-removal', 'pico-laser', 'ipl', 'hifu', 'rf', 'body', 'others'
    ]),
    categoryLabel: z.string(),
    manufacturer: z.string(),
    model: z.string(),
    manufacturedDate: z.string(),           // "YYYY-MM" 形式
    maintenanceContract: z.string(),
    usage: z.string(),
    transactionDate: z.string(),            // "YYYY-MM" 形式
    priceRange: z.string(),
    status: z.enum(['取引完了', '取引中', '売却受付中', '購入希望受付中']),
    images: z.array(z.string()).optional(),
  }),
});

const categoriesCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    accentColor: z.string(),               // Tailwind or hex
    machines: z.array(z.object({
      name: z.string(),
      manufacturer: z.string(),
      priceRange: z.string().optional(),
      image: z.string().optional(),
    })),
    checkpoints: z.array(z.string()),
  }),
});

const blogCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishedDate: z.string(),
    category: z.string(),
    tags: z.array(z.string()),
    image: z.string().optional(),
  }),
});

export const collections = {
  post: postCollection,
  cases: casesCollection,
  categories: categoriesCollection,
  blog: blogCollection,
};
