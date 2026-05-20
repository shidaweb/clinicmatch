# ブログ記事の更新ルール

記事の本文を修正した場合は、フロントマター（Sanity または `src/data/post`）の **`updateDate`** を必ず更新してください。

- 表示: 記事ページに「最終更新: YYYY-MM-DD」が出ます（公開日と異なる場合のみ）
- SEO: `BlogPosting` 構造化データの `dateModified` に反映されます

`updateDate` が未設定の場合は `publishDate`（または Sanity の `_updatedAt`）が使われます。

## 記事末 FAQ（任意）

Sanity の Post に **FAQ（記事末）** フィールドを追加できます。入力すると記事末尾に FAQ 表示と `FAQPage` 構造化データが出力されます。

ローカル MDX（`src/data/post`）を使う場合はフロントマターに `faqs: [{ q: "...", a: "..." }]` を指定できます。
