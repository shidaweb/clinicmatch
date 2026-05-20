# SEO: ページネーション・フィルタ URL（タスク9）

## ブログ一覧 `/blog/2` 以降

- **robots:** 2ページ目以降は `noindex, follow`（既存の `blogListRobots` + `currentPage === 1` 条件）
- **canonical:** 1ページ目は `/blog`、2ページ目以降は各ページ自身のパス（`page.url.pathname`）を自己参照
- **実装:** `src/pages/[...blog]/[...page].astro`

## 取引事例 `/cases/?category=xxx`

- フィルタはクライアント側の表示切替（同一 HTML）。クエリ付き URL は重複コンテンツになりやすい
- **robots:** `?category=` 付きは `noindex, follow`
- **canonical:** クエリ付きアクセス時は `/cases` に統一
- **実装:** `src/pages/cases/index.astro`（`prerender = false` でリクエスト時にメタ出し分け）

## 将来の改善案

- カテゴリ別の正規 URL を `/cases/category/[slug]` のように静的化すると、カテゴリ別インデックスも可能
