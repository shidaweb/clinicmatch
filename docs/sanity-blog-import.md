# Sanity ブログ記事インポート（drafts）

`drafts/*.md` から Sanity の `post` ドキュメントへ反映する手順です。スキーマは `sanity/schemaTypes/post.ts` に準拠します。

## スキーマ対応（ドラフト frontmatter → Sanity）

| ドラフト YAML | Sanity フィールド | 備考 |
|---------------|-------------------|------|
| `title` | `title` | 必須 |
| `slug` | `slug.current` | rewrite 時も YAML の slug を使用 |
| `description` | `excerpt` | `metaDescription` フィールドはなし |
| `publishedAt` | `publishedAt` | **rewrite** では既存値を維持（patch に含めない） |
| `category` | `category` | 文字列スラッグ（`ops`, `pricing` 等） |
| `tags` | `tags` | 文字列配列 |
| `faqs[].question` / `answer` | `faqs[].q` / `a` | どちらのキーでも可 |
| `heroImage` | `mainImage` | ローカルパス指定時はアップロード（`--apply` 時） |
| `author`, `supervisor`, `seoTitle`, `ogTitle`, `updatedAt` | — | 無視（サイトは `_updatedAt` を更新日に使用） |

## 7本のドラフト

| ファイル | mode | slug |
|----------|------|------|
| `01-candela-maintenance.md` | create | `candela-maintenance-cost` |
| `02-candela-power-storage.md` | create | `candela-power-storage` |
| `03-installation-guide-rewrite.md` | rewrite | `installation-guide` |
| `04-maintenance-contracts-rewrite.md` | rewrite | `maintenance-contracts` |
| `05-candela-hub.md` | create | `candela-overview` |
| `06-dubai-export.md` | create | `dubai-export-trends` |
| `07-market-trends-2026-rewrite.md` | rewrite | `market-trends-2025`（URL維持） |

## 使い方

1. `.env` または `.env.clinicmatch` に `SANITY_WRITE_TOKEN` を設定
2. **ドライラン（デフォルト）** — Sanity には書き込まない

```bash
npm run sanity:import-drafts
npm run sanity:import-drafts -- 03-installation-guide-rewrite.md
```

3. **反映** — 1記事ずつ確認してから推奨

```bash
node scripts/import-drafts.cjs 03-installation-guide-rewrite.md --apply
```

rewrite 実行前に `backups/{slug}-{timestamp}.json` に既存ドキュメントを保存します。

4. 反映後は Cloudflare Pages の再デプロイ（またはビルド）でサイトに反映されます。

## 関連スクリプト

- `scripts/import-drafts.cjs` — 本手順
- `scripts/import_clinicmatch_articles.cjs` — 初期50本一括インポート用（別ディレクトリ）
- `scripts/lib/sanity-import-utils.cjs` — Markdown → Portable Text 共有
