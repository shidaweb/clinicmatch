# クリニックマッチ｜売りたい・買いたい・探す（メルカリ風）実装指示書（Cursor向け）

> 目的：出品（売りたい）で**メルカリ風の写真登録**を可能にし、買いたい・探すも含めて**写真前提・スマホ最適**のUXにする。
> 前提：**URL不変**。デザインは `docs/design-spec.md`（美容医療トーン）準拠。画像のバックエンドは**実装済み**を活用する。
> 既存実装：Storage バケット `listing-images`（public read / 認証uploadはRLSで自org所有listingのみ）、`listing_images` テーブル、`POST /api/listings`（作成）、`POST /api/listings/[id]`（**画像1枚アップロード**：multipart `file`、最初の1枚が自動 cover）、`PATCH /api/listings/[id]`（更新・`submit:true`で審査へ）。
> 作成日：2026-06-06

---

## 0. 結論（やること）
1. **売りたい登録**にメルカリ風の写真ピッカー（最大10枚・1枚目＝表紙・並べ替え・削除・スマホはカメラ/アルバム）を追加。
2. 作成フローを **「下書き作成 → 画像アップロード → 申請」** の3ステップに（画像APIが listing id 必須のため）。
3. **探す**（`/cases`）を**写真カードのグリッド**に（モバイル2カラム）。
4. **買いたい**は**参考画像1枚（任意）**＋写真前提のカード表示（スキーマ追加・任意）。
5. 画像の**削除・表紙変更・並べ替え**APIを追加（現在 upload のみ）。

---

## 1. 売りたい登録（`src/pages/account/listings/new.astro`）

### 1.1 画面（スマホ最優先）
- 最上部に**写真ピッカー**：3列グリッドのタイル。
  - 「写真を追加」タイル（破線・カメラ＋アイコン）。
  - 追加済みは正方形サムネ。**1枚目に「表紙」バッジ**、各タイルに削除（✕）。
  - 補助文「最大10枚／1枚目が表紙／長押しで並べ替え・タップで表紙変更」。
- 以下、既存フィールド：カテゴリ／メーカー・機種名／希望価格・年式／状態／保守（メーカー保守・譲渡可否）／付属品／所在地（都道府県・市区町村）／説明。
- 下部に**固定アクションバー**（モバイル）：「下書き保存」「確認に進む」。

### 1.2 写真ピッカー実装（クライアント）
- `<input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden>`。`capture` は**付けない**（カメラ/アルバム選択をOSに委ねる）。
- クライアントで保持：`File[]` ＋ `URL.createObjectURL` のプレビュー。並び順＝配列順、`index 0 = 表紙`。
- 検証：拡張子 jpg/jpeg/png/webp、1枚あたり上限（例 8MB）、合計10枚まで。超過・不正はその場でエラー表示。
- 推奨：アップ前に**canvasで長辺2000px程度に圧縮**（任意・速度/容量対策）。
- 並べ替え（ドラッグ or ↑↓ボタン）、タップで表紙指定（配列先頭へ移動）、✕で削除。
- React島で作るのが楽（既存 `src/components/interactive/` パターン）。例：`ListingImagePicker.tsx`（`onChange(files: File[])`）。

### 1.3 送信フロー（重要）
画像APIは listing id 必須のため、順序を固定する：
```ts
// 1) 下書き作成
const res = await fetch('/api/listings', {
  method: 'POST', headers: {'Content-Type':'application/json'},
  body: JSON.stringify({ ...formFields, submit: false }),
});
const { id } = await res.json();

// 2) 画像を「表紙→…」の順で1枚ずつアップロード（最初の1枚が自動 is_cover=true）
for (const file of orderedFiles) {
  const fd = new FormData(); fd.append('file', file);
  await fetch(`/api/listings/${id}`, { method: 'POST', body: fd });
}

// 3) 申請（審査へ）
await fetch(`/api/listings/${id}`, {
  method: 'PATCH', headers: {'Content-Type':'application/json'},
  body: JSON.stringify({ submit: true }),
});
// → /account/listings へ。完了トースト「審査後に公開されます」
```
- **冪等性**：作成した `id` を保持し、再送時は再作成しない（PATCH＋不足画像のみ）。
- **進捗UI**：アップロード中は「2/5枚…」のプログレス。失敗枚はリトライ可能に。
- 「下書き保存」は手順2まで（submitしない）。

### 1.4 編集（`account/listings/[id]/edit.astro`）
- 既存listingに直接アップロード（手順2と同じ）。
- 既存画像の**削除・表紙変更・並べ替え**を可能にする（次節のAPIを追加）。

---

## 2. 追加が必要なAPI（画像の削除・表紙・並べ替え）

現状は upload(POST) のみ。以下を追加：
- `DELETE /api/listings/[id]/images/[imageId]`：`listing_images` 行削除＋Storage実体削除（`admin.storage.from('listing-images').remove([storage_path])`）。所有org検証必須。表紙を消した場合は残り先頭を `is_cover=true` に。
- `PATCH /api/listings/[id]/images`：`{ order: imageId[] }` で `sort_order` 一括更新、`{ coverId }` で `is_cover` 付け替え（他を false）。所有org検証必須。
- いずれも `seller_org_id === profile.org_id` と `status !== 'published'` を確認（公開中は編集不可の既存方針に合わせる）。

---

## 3. 探す（`src/pages/cases/index.astro`）＝写真カードグリッド

### 3.1 デザイン変更
- 募集中（在庫）／買いたいの結果を**写真カード（`PostCard`）のグリッド**で表示（メルカリ的に写真前提）。
  - **モバイル：2カラム**（`grid-cols-2`）、**md：3、lg：4**。`gap-3 sm:gap-4`。
  - カード：cover画像（`aspect-square`／`object-cover`、`loading="lazy"`、`alt="メーカー 機種名"`）＋種別タグ（募集中=ローズ／買いたい=ベージュ／成約=グレー）＋機種名（明朝）＋「年式・市区町村」＋価格（明朝）。
  - 画像が無い在庫はカテゴリ別のプレースホルダ（無地＋アイコン）。404 を出さない。
- **フィルタ**：PCは左レール固定、**モバイルは「絞り込み」ボタン→ボトムシート**（全画面）。現状の左カラム常時表示はモバイルで縦長すぎるため変更。
- 上部に件数＋並び替え（新着/価格/年式）。
- 0件時：既存の空状態（「条件で相談する」）を維持しつつカードグリッドと違和感ないトーンに。

### 3.2 既存資産
- `PostCard.astro` は cover URL を生成済み（`listing_images` から）。これをグリッドで使う。`PostRow`（行リスト）からカード主体へ。

---

## 4. 買いたい登録（`src/pages/account/wanted/new.astro`）

### 4.1 画面
- 上部に**参考画像（任意・1枚）**ピッカー（「欲しい機種のカタログ画像など」）。必須ではない。
- 探しているカテゴリ／希望条件（機種名・状態など 任意）／予算／希望時期／希望エリア（都道府県・市区町村）。
- 下部固定「確認に進む」＋「匿名OK・約2分。該当機器を持つ売り手から提案が届きます」。

### 4.2 参考画像のためのスキーマ（任意・段階導入可）
最小構成：
- `wanted_requests` に `reference_image_path text` を追加（`supabase/migrations/0004_wanted_reference_image.sql`）。
- Storage バケット `wanted-images`（public read、認証uploadは自org所有wantedのみ・listing同様のRLS、フォルダ＝`{wanted_id}/`）。
- API：`POST /api/wanted/[id]`（multipart `file`）でアップロードし `reference_image_path` を更新。フローは listing と同じ（下書き作成→画像→submit）。
- 画像が無い買いたいは従来どおりカテゴリアイコン表示。

> 優先度：売りたいの画像が本命。買いたい参考画像は任意機能として後追いでも可。

---

## 5. 共通・画像の扱い
- 公開URL：`${PUBLIC_SUPABASE_URL}/storage/v1/object/public/listing-images/${storage_path}`（既存パターン）。
- `alt` は必ず「メーカー 機種名」。装飾サムネは `alt=""`。
- `aspect-square`＋`object-cover` で CLS を防ぐ。一覧は `loading="lazy"`、詳細の主画像は `eager`。
- 容量・枚数の上限はサーバ側でも検証（既存APIは拡張子チェック済み。サイズ上限の追加を推奨）。
- 匿名厳守：画像内に院名・人物・連絡先が写り込む懸念を**注意文**で案内（「銘板・院名・患者が写らないように」）。運営審査でも確認。

---

## 6. コンポーネント
新規：`ListingImagePicker.tsx`（売り）、`WantedImagePicker.tsx`（買い・任意）、必要なら `ImageThumb`/`UploadProgress`。
編集：`account/listings/new.astro`・`account/listings/[id]/edit.astro`・`account/wanted/new.astro`、`cases/index.astro`（カードグリッド＋モバイルフィルタ）、`PostCard.astro`（プレースホルダ・2カラム対応）。
追加API：`/api/listings/[id]/images/[imageId]`(DELETE)、`/api/listings/[id]/images`(PATCH)、（任意）`/api/wanted/[id]`(POST 画像)。

---

## 7. 受入チェックリスト
- [ ] 売りたい登録で**複数画像をアップロード**でき、1枚目が表紙・並べ替え・削除ができる（スマホでカメラ/アルバム選択可）。
- [ ] 送信は「下書き作成→画像→申請」で動き、途中失敗時もリトライでき、二重作成しない。
- [ ] 公開後、探す・詳細・カードに**写真が表示**される（alt＝メーカー機種名、遅延読込）。
- [ ] 探すが**写真カードのグリッド**で、モバイル2カラム・フィルタはボトムシート。
- [ ] 画像が無い投稿でも 404 を出さずプレースホルダ表示。
- [ ] 買いたいは参考画像（任意）。無くても登録できる。
- [ ] 画像の削除/表紙変更/並べ替えAPIが所有org・未公開を検証している。
- [ ] 既存URLは不変。配色・余白はトークンのみ。
