# クリニックマッチ｜/cases SEO・デザイン 実装指示書（Cursor向け）

> 対象：`src/pages/cases/[...slug].astro`（事例詳細）と `src/pages/cases/index.astro`（一覧）。
> 目的：(1) 静的「取引事例」ページを**SEOに強い・上質なデザイン**にする。(2) 動的な在庫/買いたい（UUID）詳細は**匿名・揮発性**に合わせたインデックス方針にする。
> 前提：**URLは変更しない**。デザインは `docs/design-spec.md`（美容医療トーン）に準拠。
> 作成日：2026-06-06

---

## 0. Cursorへの基本指示
- 本書を `docs/cases-seo-design-cursor-spec.md` として参照。`.cursor/rules` に「/cases の変更は本書を正とする」を追記。
- 配色・余白・角丸は `src/styles/tokens.css` / `src/assets/styles/tailwind.css` のトークン（`cm-*`, `bg-blush`, `text-plum` 等）のみ使用。新色を足さない。
- 構造化データ・メタは既存の仕組みを使う：`MetaData`（`src/types.d.ts`）→ `Metadata.astro`、パンくずは `components/seo/Breadcrumb.astro`（BreadcrumbList JSON-LD を自動出力）。

---

## 1. ページの3モード（現状の整理）
`[...slug].astro` は slug により分岐する：

| モード | 条件 | 内容 | インデックス方針 |
|---|---|---|---|
| static | slug が UUID でない（例 `coolsculpting-elite-2022`） | `cases` コレクション（編集記事）＝**取引事例** | **積極的にインデックス**（SEOの主役） |
| listing | slug が UUID＋`type=listing` | 公開中の在庫（売り） | **noindex, follow**（匿名・揮発性） |
| wanted | slug が UUID＋`type=wanted` | 公開中の買いたい | **noindex, follow** |

> 理由：静的事例は普遍的で被リンク資産になるが、UUID詳細は匿名・流動的で内容が薄く、インデックスは重複/プライバシーの観点で不利。

---

## 2. 静的事例ページ（static）— 実装仕様

### 2.1 SEO（実装済み・維持すること）
`mode === 'static'` のメタ生成で以下を必ず満たす：

- **title**：`staticData.title`（frontmatterのリッチな見出し）。
- **description**：カテゴリ・メーカー・機種名・製造年・状態・保守・価格帯から自動生成し、約155字に丸める。例の実装：
  ```ts
  const rawDesc =
    `${sd.categoryLabel}の中古取引事例。${sd.manufacturer} ${sd.model}（${formatDateYMD(sd.manufacturedDate)}製・${sd.status}）。` +
    `保守：${sd.maintenanceContract}／価格帯：${sd.priceRange}。中古美容医療機器の状態・保守・相場の見極めをクリニックマッチが解説します。`;
  metadata = { title: sd.title, description: rawDesc.length > 158 ? `${rawDesc.slice(0,157)}…` : rawDesc,
    canonical: String(getCanonical(getPermalink(`cases/${slug}`))), openGraph: { type: 'article' } };
  ```
- **canonical**：クエリ無しの自己URL（`getCanonical(getPermalink('cases/<slug>'))`）。
- **JSON-LD（Product）**：`itemCondition: UsedCondition`、`brand`、`category`、`description` を出力。**`offers` は付けない**（価格は「応相談/価格帯」で数値化できず、無効な構造化データになるため）。
  ```astro
  {productJsonLd && <script type="application/ld+json" set:html={JSON.stringify(productJsonLd)} />}
  ```
- **パンくず**：`Breadcrumb`（トップ → 在庫・取引事例 → タイトル）。BreadcrumbList JSON-LD は同コンポーネントが出力。
- **見出し階層**：`h1` は1つ（事例タイトル）。本文は h2 以降。レベルを飛ばさない。

### 2.2 デザイン（実装済み・維持すること）
- **ヒーロー帯**（`bg-blush`）：成約事例タグ＋**カテゴリチップ（`/categories/<category>` へリンク）**、明朝H1、`メーカー / 機種名`、製造・取引時期・価格帯を明朝・`tabular-nums` で並べる。
- **機器の概要**：`cm-card` のスペックグリッド（メーカー/機種名/製造年月/保守/使用状況/取引時期/価格帯）。
- **本文**：`.cases-prose`（`@tailwindcss/typography`＋見出しに左ローズ罫、strongはローズ）。
- **関連の取引事例**：同カテゴリ優先で最大3件をカードでリンク（内部リンク強化）。
- 末尾に売却/購入/相談のCTA。

### 2.3 カテゴリリンクの注意
- カテゴリページは6種のみ（`hair-removal, pico-laser, ipl, hifu, rf, body`）。**`others` はページが無い**ため、`category === 'others'` のときはリンクにせず `<span>` で表示する（404防止）。実装済み。

### 2.4 画像（今後の改善ポイント）
- 現在 frontmatter の `images`（`/images/cases/...`）は**実ファイルが無い**。`<img>` を出すと404になるため**描画しない**のが現状の正解。
- 画像を追加する場合：
  1. `public/images/cases/<slug>/` に webp を配置。
  2. ヒーローに `<img>` を**実在時のみ**描画（`alt` は「メーカー 機種名」）。
  3. `metadata.openGraph.images` に**絶対URL**で cover 画像を設定（SNS/検索のサムネ向上）。

---

## 3. 動的詳細（listing / wanted）— 実装仕様

### 3.1 インデックス方針（追加実装してほしい）
両モードのメタに **noindex** を設定する：
```ts
if (mode === 'listing' && listing) {
  metadata = {
    title: `${listing.maker} ${listing.model}（売りたい）`,
    description: `${listing.categories?.name ?? ''}の中古在庫（匿名）。所在地：${formatLocation(listing.location_prefecture, listing.location_city)}。詳細は運営が仲介します。`,
    robots: { index: false, follow: true },
  };
}
if (mode === 'wanted' && wanted) {
  metadata = {
    title: `${wantedTitle}（買いたい）`,
    description: `${wanted.categories?.name ?? ''}の買いたいリクエスト（匿名）。希望エリア・予算の概要を掲載。`,
    robots: { index: false, follow: true },
  };
}
```
- **canonical は自己URLにしない**（揮発・クエリ付きのため）。`/cases` へ寄せるか、未指定でよい。
- **構造化データは付けない**（noindex のため不要。付ける場合も `offers` は出さない）。
- 匿名厳守：title/description に**組織名・連絡先・番地を入れない**。所在地は「都道府県＋市区町村」まで。

### 3.2 デザイン
- 既存の listing 詳細（画像ギャラリー＋スペック＋保守＋「この先の進め方」＋固定CTA）を維持。トークンは静的事例と共通。

---

## 4. 一覧ページ `cases/index.astro`（現状維持＋確認）
- フィルタ/カテゴリ/`view=done` などの**派生URLは `robots:{index:false, follow:true}`** とし、canonical を素の `/cases` に寄せる（実装済みロジックを維持）。
- 各カード（`PostRow`/`PostCard`）から詳細への内部リンクを保つ。
- 一覧の `<h1>` は「在庫・取引事例をさがす」（日本語・1つ）。

---

## 5. 受入チェックリスト
- [ ] 静的事例7件すべてに、リッチなtitle・自動descriptin・self canonical・OG(type=article)・Product JSON-LD・Breadcrumb JSON-LD が出る。
- [ ] 静的事例に h1 が1つ、ヒーロー帯・概要・関連事例・CTA が表示される。
- [ ] カテゴリチップが `/categories/<category>` にリンク（`others` はリンクなし）。
- [ ] 実在しない画像で `<img>` 404 を出していない。
- [ ] listing / wanted（UUID）詳細が **noindex, follow**。title/descriptionに実名・連絡先・番地が無い。
- [ ] 一覧の派生URL（フィルタ等）が noindex＋canonical=`/cases`。
- [ ] 変更で既存URLが一切変わっていない。
- [ ] 配色・余白がトークンのみ（新色なし）。

---

## 6. 変更ファイル
- 編集済み：`src/pages/cases/[...slug].astro`（static のSEO＋デザイン＋関連事例＋Product JSON-LD）。
- 追加実装してほしい：同ファイルの listing/wanted メタに `robots:{index:false,follow:true}` ＋ description。
- 確認：`src/pages/cases/index.astro`（派生URLの noindex/canonical）。
- 参照：`components/seo/Breadcrumb.astro`、`src/types.d.ts`(MetaData)、`src/utils/permalinks.ts`(getCanonical/getPermalink)、`src/styles/tokens.css`。
