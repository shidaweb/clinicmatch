# ブログ記事ドラフト（Sanity 投入用）

Markdown + YAML frontmatter。投入は `docs/sanity-blog-import.md` を参照。

- `mode: create` — 新規（`_id` は `post-{slug}`）
- `mode: rewrite` — 既存 slug を上書き（`publishedAt` は維持）

画像は `images/` に置き、`heroImage: drafts/images/...` のようにパス指定。
