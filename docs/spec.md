# クリニックマッチ｜中古医療美容機器マーケットプレイス  Cursor 設計指示書 v2

> 本書は **Cursor（AIコードエディタ）に与える実装指示書** です。既存の Astro サイトを、純粋仲介型の中古医療美容機器マーケットプレイスへ段階的に拡張します。各セクションはそのまま Cursor のコンテキスト／タスク指示として使えるよう、仕様・スキーマ・受入基準まで具体化しています。
>
> 作成日：2026-06-06 ／ 対象：株式会社キラック「クリニックマッチ」
>
> **v2 の変更点**
> - 🆕 **双方向登録**：「売りたい（出品）」だけでなく「買いたい（リクエスト）」も **マーケットプレイスに登録できる中核機能** にする（旧Phase3 → MVP/Phase1へ前倒し）。
> - 🆕 **相談CTA**：買い手・売り手の双方が使える「**出品・購入を相談する**」ボタンを全体に常設（自己登録とは別の、運営への相談導線）。
> - 🆕 **デザイン一新**：第A章にデザインシステムと主要画面の刷新方針を追加。「見るLP」から「使うマーケットプレイス」へ。
> - ✅ **ブログ・既存URLは現状維持**（`/blog/*`, `/categories/*`, `/cases`, `/about`, `/terms`, `/privacy`）。SEO資産を壊さない。

---

## 0. このドキュメントの使い方（Cursor運用ルール）

- このファイルを `docs/spec.md` としてリポジトリに置き、Cursor の **@docs/spec.md** で常に参照させる。
- `.cursor/rules`（または `.cursorrules`）に「本仕様書（docs/spec.md）を常に正とする」「ビジネスルール（第3章）を勝手に変更しない」「DBスキーマ変更は必ずマイグレーションファイルを追加する」「**ブログ・既存URLを変更・削除しない**」を明記する。
- 開発は **第8章のフェーズ順** に進める。1フェーズ＝1〜複数PR。各フェーズ末の「受入基準」を満たすまで次に進まない。
- デザイン実装は **第A章のデザイントークン／コンポーネント規約** に従う。独自の色・余白を勝手に増やさない。

---

## 1. ゴールと非ゴール

### ゴール
- 売り手クリニックが機器を **出品（売りたい）** できる。
- 買い手クリニックが欲しい機器を **買いたい（リクエスト）として登録** できる。← v2で中核化
- **売りたい・買いたいの両方が同じマーケットプレイスに並び**、相互にアプローチ／マッチングできる。
- 買い手・売り手のどちらも、自己登録の代わりに **「出品・購入を相談する」** から運営へ気軽に相談できる（匿名相談OK）。
- 誰でも閲覧でき、運営が **コミュニケーションを仲介** し、**合意後に連絡先を開示** する。
- 売買は **クリニック間の相対契約**（運営がひな形提供）。運営は **成約時に売り手から成約額の7.5%** を請求。

### 非ゴール（やらないこと）
- プラットフォーム内決済（クレジットカード等）は **実装しない**。
- 運営が在庫を買い取る／売主になる機能は **作らない**（純粋仲介）。
- 与信・エスクロー・配送の自動化は対象外（運営の手作業＋段取り支援に留める）。
- ブログ・既存URLの再構築は **しない**（現状維持）。

---

## 2. 現状からの差分（What exists → What to build）

| 領域 | 現状 | 目標 |
|---|---|---|
| フレームワーク | Astro（静的生成） | Astro を **ハイブリッド/SSR 化**（`@astrojs/cloudflare`） |
| ホスティング | Cloudflare Pages（静的配信、Workers未使用） | Cloudflare Pages + **Functions（SSR/API）** |
| データ | 出品・事例は静的データ | **Supabase（PostgreSQL）** に移行 |
| 登録 | 売却/購入フォーム（リード送信のみ） | **売りたい出品＋買いたいリクエスト** のDB登録（双方向） |
| 認証 | なし | **Supabase Auth** ＋ 法人番号登録 |
| 画像 | 静的アセット | **Supabase Storage**（出品画像） |
| デザイン | リード獲得型LP | **マーケットプレイスUIへ刷新**（第A章） |
| ブログ/カテゴリ/事例/会社/規約 | 既存（SEO資産） | **URL・内容ともに現状維持**。出品/リクエストへ内部リンクのみ追加 |

**方針：作り直さない＆既存URLを壊さない。** 既存ページは `prerender=true` で静的のまま残し、動的レイヤー（出品・買いたい・会員・仲介・管理）とデザイン刷新を追加する。

---

## 3. ビジネスルール（最重要・変更不可）

Cursor はここを勝手に変えないこと。

### 3.1 売主の位置づけ
- **純粋仲介**。売買は **クリニック ⇔ クリニック** の相対契約。運営は売主にならない。
- 契約書は **運営がひな形を提供** → 売り手・買い手が確認 → 合意で成立。
- **契約内容は案件ごとに異なる**（特に「メーカー保守の有無」「保守契約の引継ぎ可否」で変わる）。ひな形は **案件パラメータで差し替わる項目** を持つ。

### 3.2 双方向登録（v2の中核）
- マーケットプレイスには2種類の投稿が並ぶ：
  - **売りたい（listing）**：売り手が機器の条件・画像・保守状況を登録。
  - **買いたい（wanted_request）**：買い手が欲しい機器の条件・予算・希望時期・エリアを登録。
- アプローチは双方向：
  - 売りたい出品に対して、買い手が **関心リクエスト** を送る。
  - 買いたいリクエストに対して、売り手（または運営）が **「該当機器あり」提案** を送る。
- どちらの起点でも、成約までの流れ（仲介→合意→契約→請求）は共通（3.5）。

### 3.3 公開範囲・匿名性
- **希望価格（売りたい）／予算（買いたい）は公開** する。
- **所在地・希望エリアは「都道府県＋市区町村」まで公開**（例：東京都渋谷区）。番地・施設名は出さない。
  - 理由：**メーカー担当エリア** の判断に影響するため、エリア粒度は必須。
- **クリニック名（組織名）は非公開**。投稿は **匿名** 表示（例：「渋谷区の医療機関」）。
- 連絡先・組織名などの実名情報は **合意後にのみ開示**（3.4）。

### 3.4 仲介・連絡先開示
- 買い手⇔売り手のやり取りは **プラットフォーム上のメッセージで匿名のまま** 行う（運営が中継／監督）。
- **連絡先（電話・メール・組織名等）は、双方の合意成立後にのみ開示**。システムは「合意成立イベント」を記録し、それを境に連絡先カードを解放する。

### 3.5 契約と課金の順序（厳守）
1. アプローチ（関心 or 提案）→ 運営が仲介開始 → 条件すり合わせ。
2. **まず運営と売り手の「仲介契約（mediation_agreement）」を先に成立**（手数料7.5%合意を含む）。
3. その後に **売り手⇔買い手の「売買契約（deal）」を締結**。
4. **売買契約の成立と同時に**、運営は売り手へ **成約額の7.5%を請求**（請求書発行）。締結済み契約書を運営へ提出。
> 不変条件：`deal` は必ず先行する `mediation_agreement`（status=signed）に紐づく。仲介契約が未成立の `deal` は作成不可。

### 3.6 会員登録・審査
- 審査ゲートは **法人番号（13桁）の入力のみ**。売り手・買い手とも **数ステップで登録完了**。
- 任意で国税庁「法人番号システム Web-API」での実在確認（フェーズ2以降、必須でない）。
- 1アカウントで **売り手・買い手を兼任** 可（クリニックは売りも買いもする）。

### 3.7 保守・付属品の開示とQ&A
- 売り手は **本体・付属品の有無** と **保守関連の契約状況**（メーカー保守の有無、保守契約の残存・引継ぎ可否、第三者保守 等）を **出品時に公開**。
- 買い手は出品詳細から **保守・付属品について匿名で質問**（連絡先非開示・運営中継）。

---

## A. デザイン方針（一新）

> 目的：「見るLP」から「使うマーケットプレイス」へ。医療従事者が高額のオーナー間取引を判断する場として、**清潔感・信頼・比較しやすさ** を最優先する。トップで **売りたい／買いたい** の2導線を対等に見せる。

### A.1 ブランド・トーン
- キーワード：**端正・透明・実務的**。装飾過多を避け、情報密度と可読性を両立。
- 既存の「清潔感・信頼性・透明性」を継承しつつ、ボタン・カード・フォームを **プロダクトUIの水準** に引き上げる。

### A.2 デザイントークン（Tailwind 前提）
カラー（CSS変数 + Tailwind theme extend で定義。勝手に色を増やさない）：

| 用途 | トークン | 値（目安） |
|---|---|---|
| Primary（ブランド/CTA） | `brand-600` | `#2E6CA8` |
| Primary濃 | `brand-800` | `#1F3A5F` |
| Accent（成約/ポジティブ） | `accent-600` | `#0E7C6B` |
| 売りたい系タグ | `sell` | `#2E6CA8`（青系） |
| 買いたい系タグ | `buy` | `#B25E00`（オレンジ系） |
| 背景 | `surface` / `surface-muted` | `#FFFFFF` / `#F2F4F7` |
| 罫線 | `border` | `#C9D2DC` |
| 文字 | `text` / `text-muted` | `#222222` / `#5B6B7B` |

- タイポ：日本語は `Noto Sans JP`／システムゴシック。見出し太字、本文 15–16px、行間 1.7。
- 角丸 `rounded-xl`、影は控えめ（`shadow-sm`）、余白広め（セクション間 `py-12`〜`py-16`）。
- **売りたい＝青、買いたい＝オレンジ** のラベル色を全体で一貫させ、一覧で一目で種別が分かるようにする。

### A.3 グローバルナビ（刷新）
- ヘッダー：ロゴ ／ **さがす（マーケット）** ／ **売りたいを出す** ／ **買いたいを出す** ／ **出品・購入を相談する** ／ ブログ ／ ログイン・マイページ。
- 主要CTAは常時：「**売りたいを出す**」「**買いたいを出す**」を色分け（青／オレンジ）＋ **「出品・購入を相談する」**（中立色のセカンダリボタン。買い手・売り手の両方が押せる）。
- 「出品・購入を相談する」は **未ログインでも押せる相談導線**。フォーム送信（`/consult`）または既存LINEへ接続。
- モバイル：下部固定のアクションバー（さがす／出す／**相談**／マイページ）。フッターにも常設。

### A.4 主要画面の刷新
| 画面 | 刷新ポイント |
|---|---|
| トップ `/` | ヒーローに **売りたい／買いたいの2大導線**＋**「出品・購入を相談する」**。直下に「新着の売りたい」「新着の買いたい」を横並び。検索バーを上部に。既存の強み/流れ/FAQは下部へ整理。 |
| 相談 `/consult` | 買い手・売り手 **共通の相談フォーム**（相談種別＝出品/購入を選択、匿名OK）。送信→運営へ通知。LINE導線も併記。 |
| マーケット `/market` | **売りたい・買いたいを統合した一覧**。タブ or トグル（すべて／売りたい／買いたい）。左にフィルタ（カテゴリ/年式/価格/都道府県/市区町村/状態）。カードは種別ラベル色つき。 |
| 出品詳細 `/listings/[id]` | 画像ギャラリー＋スペック表＋**保守バッジ・付属品**＋希望価格＋所在地（都道府県＋市区町村）。固定CTA「関心リクエスト」「保守Q&A」。 |
| 買いたい詳細 `/wanted/[id]` | 希望条件・予算・時期・希望エリアをカード表示。CTA「該当機器を提案（売り手）」。 |
| 登録フォーム | **売りたい／買いたいで色とコピーを変えた** ステップフォーム。入力は定型化（医療広告配慮）。 |
| ダッシュボード `/account` | やることベース（審査待ち・未読・進行中商談）。売りたい/買いたいの両タブ。 |
| メッセージ | チャットUI。匿名表示＋「運営が仲介中」表示。合意後に連絡先カード解放。 |

### A.5 共通コンポーネント（命名）
`PostCard`（種別ラベルで売/買を出し分け）, `MarketFilters`, `ListingDetail`, `WantedDetail`, `MaintenanceBadge`, `MessageThread`, `ContactCard`, `StepForm`, `ConsultButton`（ヘッダー/フッター/詳細/モバイルバー共通の「出品・購入を相談する」）, `ConsultForm`, `BottomActionBar`, `EmptyState`。

> `ConsultButton` は買い手・売り手のどちらの文脈でも同一CTAとして表示。出品詳細・買いたい詳細では「この件を相談する」として該当投稿IDを引き継ぐ。

> 既存のブログ/カテゴリ/事例の見た目は大きく変えず、ヘッダー/フッターと共通トークンの差し替えに留める（URL・内容は維持）。

---

## 4. 技術スタック

| 項目 | 採用 | 備考 |
|---|---|---|
| フロント | **Astro**（既存継続） | `output:'server'` + ページ単位 `prerender` |
| SSR/配信 | **Cloudflare Pages + Functions** | `@astrojs/cloudflare` アダプタ |
| UI/スタイル | Astro components + **Tailwind**（既存踏襲）＋ 第A章トークン | 重いSPA化はしない |
| 認証 | **Supabase Auth**（email+password） | セッションはCookie |
| DB | **Supabase（PostgreSQL）** + **RLS** | `supabase/migrations/` |
| ストレージ | **Supabase Storage**（`listing-images`） | 公開読み取り、書込はRLS |
| 通知 | メール（Resend 等）＋ 既存 **LINE** | 関心/提案受信・審査結果・新着メッセージ |
| 管理画面 | `/admin`（権限ガード） | 初期は Supabase Studio 併用可 |

### 環境変数
```
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=     # サーバー側のみ。クライアントに出さない
RESEND_API_KEY=                # 任意
HOJIN_BANGO_API_TOKEN=         # 任意・フェーズ2
```

---

## 5. データモデル（Supabase / PostgreSQL）

`supabase/migrations/0001_init.sql`。金額は `integer`（円）。

### 5.1 DDL（抜粋・実装の起点）

```sql
-- 組織（クリニック/法人）。組織名・法人番号・連絡先は非公開
create table organizations (
  id uuid primary key default gen_random_uuid(),
  corporate_number varchar(13) not null,
  name text not null,                       -- 非公開
  prefecture text not null,                 -- 公開
  city text not null,                       -- 公開
  address_detail text,                      -- 非公開
  phone text,                               -- 非公開（合意後開示）
  contact_email text,                       -- 非公開（合意後開示）
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references organizations(id),
  full_name text,
  role text not null default 'member' check (role in ('member','admin')),
  created_at timestamptz not null default now()
);

create table categories (
  slug text primary key,        -- hair-removal / pico-laser / ipl / hifu / rf / body
  name text not null,
  sort_order int not null default 0
);

-- 売りたい（出品）
create table listings (
  id uuid primary key default gen_random_uuid(),
  seller_org_id uuid not null references organizations(id),
  category_slug text not null references categories(slug),
  maker text not null,
  model text not null,
  manufacture_year int,
  manufacture_month int,
  condition text,
  shot_count int,
  has_accessories boolean default false,
  accessories_detail text,                  -- 公開
  maker_maintenance text check (maker_maintenance in ('yes','no','unknown')) default 'unknown',
  maintenance_transferable text check (maintenance_transferable in ('yes','no','unknown')) default 'unknown',
  maintenance_notes text,                   -- 公開
  asking_price int,                         -- 公開
  location_prefecture text not null,        -- 公開
  location_city text not null,              -- 公開
  description text,
  status text not null default 'draft'
    check (status in ('draft','pending_review','published','reserved','closed')),
  view_count int not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  storage_path text not null,
  sort_order int not null default 0,
  is_cover boolean not null default false
);

-- 買いたい（リクエスト）★v2で中核
create table wanted_requests (
  id uuid primary key default gen_random_uuid(),
  buyer_org_id uuid not null references organizations(id),
  buyer_user_id uuid not null references profiles(id),
  category_slug text not null references categories(slug),
  maker text,                               -- 任意（特定機種指定も可）
  model text,                               -- 任意
  condition_pref text,                      -- 希望状態
  budget int,                               -- 予算（公開）
  desired_timing text,                      -- 希望時期
  area_prefecture text,                     -- 希望エリア（公開・都道府県）
  area_city text,                           -- 希望エリア（公開・市区町村）
  requirements text,                        -- 要件・補足
  status text not null default 'draft'
    check (status in ('draft','pending_review','published','reserved','closed')),
  view_count int not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

-- アプローチ：売りたい出品への「関心」/ 買いたいへの「提案」を統一して扱う
create table approaches (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('interest','offer')),  -- interest=買い手→出品 / offer=売り手→買いたい
  listing_id uuid references listings(id),                  -- interest時
  wanted_request_id uuid references wanted_requests(id),    -- offer時
  from_org_id uuid not null references organizations(id),
  from_user_id uuid not null references profiles(id),
  budget int,                              -- interest時の予算（任意）
  price int,                               -- offer時の提示価格（任意）
  message text,
  status text not null default 'new'
    check (status in ('new','in_mediation','agreed','matched','declined')),
  created_at timestamptz not null default now(),
  check ((kind='interest' and listing_id is not null)
      or (kind='offer'    and wanted_request_id is not null))
);

-- 仲介スレッド（売りたい/買いたいどちらの起点でも使える）
create table threads (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('listing','wanted')),
  listing_id uuid references listings(id),
  wanted_request_id uuid references wanted_requests(id),
  approach_id uuid references approaches(id),     -- Q&A段階ではnull可
  buyer_org_id uuid not null references organizations(id),
  seller_org_id uuid not null references organizations(id),
  operator_id uuid references profiles(id),
  kind text not null default 'qa' check (kind in ('qa','mediation')),
  contact_disclosed boolean not null default false,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references threads(id) on delete cascade,
  sender_type text not null check (sender_type in ('buyer','seller','operator')),
  sender_user_id uuid references profiles(id),
  body text not null,
  attachment_path text,
  visible_to text not null default 'all' check (visible_to in ('all','buyer_side','seller_side')),
  created_at timestamptz not null default now()
);

-- 仲介契約（売り手 ⇔ 運営）。売買契約より必ず先
create table mediation_agreements (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references listings(id),         -- 売りたい起点
  wanted_request_id uuid references wanted_requests(id), -- 買いたい起点（成約機器の出所）
  seller_org_id uuid not null references organizations(id),
  commission_rate numeric(4,3) not null default 0.075,
  terms text,
  status text not null default 'draft' check (status in ('draft','sent','signed','cancelled')),
  signed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 売買契約（売り手 ⇔ 買い手）。必ず signed の仲介契約に紐づく
create table deals (
  id uuid primary key default gen_random_uuid(),
  mediation_agreement_id uuid not null references mediation_agreements(id),
  buyer_org_id uuid not null references organizations(id),
  seller_org_id uuid not null references organizations(id),
  agreed_price int not null,
  commission_amount int,                  -- round(agreed_price * rate)
  contract_template_key text,             -- 保守有無等で分岐
  contract_doc_path text,                 -- 締結済み契約書
  contract_status text not null default 'preparing'
    check (contract_status in ('preparing','sent','signed')),
  status text not null default 'negotiating'
    check (status in ('negotiating','contracted','delivered','completed','cancelled')),
  concluded_at timestamptz,               -- 売買契約成立 = 請求トリガ
  created_at timestamptz not null default now()
);

create table commission_invoices (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id),
  amount int not null,
  issued_at timestamptz not null default now(),
  due_date date,
  paid_at timestamptz,
  status text not null default 'issued' check (status in ('issued','paid','void'))
);

-- 相談（買い手・売り手共通。未ログインでも送信可）
create table consultations (
  id uuid primary key default gen_random_uuid(),
  topic text not null check (topic in ('sell','buy','other')),  -- 出品/購入/その他
  contact_name text,                       -- 任意（匿名相談OK）
  contact_email text,
  contact_phone text,
  org_id uuid references organizations(id),         -- ログイン時のみ自動付与
  related_listing_id uuid references listings(id),  -- 「この件を相談」時
  related_wanted_id uuid references wanted_requests(id),
  body text not null,
  channel text not null default 'form' check (channel in ('form','line')),
  status text not null default 'new' check (status in ('new','in_progress','closed')),
  created_at timestamptz not null default now()
);
```

### 5.2 不変条件・トリガ
- **仲介契約先行**：`deals` 作成時、`mediation_agreement_id` の `status='signed'` を必須チェック。
- **成約＝請求**：`deals` が `contracted`（`concluded_at` set）になった時に `commission_invoices` を1件発行。`commission_amount = round(agreed_price*0.075)`。
- **公開フィールド限定**：公開API/ページは `organizations.name/address_detail/phone/contact_email` を **絶対に返さない**（公開ビュー or 明示selectで担保）。

### 5.3 RLS 方針
- `listings` / `wanted_requests`：`status='published'` は **誰でもSELECT可**。それ以外は所属組織のみ。INSERT/UPDATEは本人組織のみ。
- `organizations`：公開ビュー `public_orgs`（id, prefecture, city）のみ参照。生テーブルは本人組織＋admin。
- `approaches` / `threads` / `messages`：当事者組織（buyer/seller）＋ operator(admin)。`messages.visible_to` で出し分け。
- `deals` / `mediation_agreements` / `commission_invoices`：当事者組織＋admin。請求は売り手とadminのみ参照。

---

## 6. ルート / 画面一覧（レンダリング方式つき）

### 公開（未ログイン可）
| ルート | 方式 | 内容 |
|---|---|---|
| `/` | static | 刷新トップ。売りたい/買いたい2大導線＋相談CTA＋新着＋検索 |
| `/consult` | server | **出品・購入を相談する** 共通フォーム（買い手/売り手・匿名OK・LINE併記） |
| `/market` | server | **売りたい・買いたい統合一覧**（タブ/トグル＋フィルタ） |
| `/listings/[id]` | server | 売りたい詳細（保守・付属品・価格・所在地、匿名） |
| `/wanted/[id]` | server | 買いたい詳細（予算・時期・希望エリア、匿名） |
| `/categories/[slug]` | static | 既存カテゴリLP（URL維持）＋該当投稿への導線 |
| `/blog/*` `/cases` `/about` `/terms` `/privacy` | static | **現状維持（URL・内容そのまま）** |

> 補足：必要なら `/listings`（売りたいのみ）/ `/wanted`（買いたいのみ）も `/market?type=` のエイリアスとして用意可。**既存URLは変更しない**。

### 会員（ログイン必須）
| ルート | 方式 | 内容 |
|---|---|---|
| `/auth/register` `/auth/login` | server | 登録（法人番号＋都道府県/市区町村）・ログイン |
| `/account` | server | ダッシュボード（売りたい/買いたい両タブ・受信アプローチ・進行中スレッド） |
| `/account/listings` `/account/listings/new` `/account/listings/[id]/edit` | server | 売りたいCRUD＋画像 |
| `/account/wanted` `/account/wanted/new` `/account/wanted/[id]/edit` | server | **買いたいCRUD** |
| `/account/approaches` | server | 送った/受けたアプローチの進捗 |
| `/account/threads/[id]` | server | 匿名メッセージ（Q&A/仲介）。合意後に連絡先カード |
| `/account/deals` | server | 仲介契約・売買契約・手数料明細 |
| `/account/settings` | server | 組織情報・通知・退会 |

### 運営（admin のみ）
| ルート | 方式 | 内容 |
|---|---|---|
| `/admin/consultations` | server | 受信した相談（出品/購入）の対応・ステータス管理 |
| `/admin/posts` | server | 売りたい/買いたいの審査（pending_review→published／差戻し） |
| `/admin/members` | server | 会員/組織確認（法人番号） |
| `/admin/threads` | server | 仲介ワークスペース（買い手側/売り手側を中継） |
| `/admin/agreements` | server | 仲介契約の作成・送付・成立 |
| `/admin/deals` | server | 売買契約・成約・手数料請求・入金消込 |

### API（`src/pages/api/*`）
- `POST /api/listings`・`PATCH /api/listings/[id]`・`POST /api/listings/[id]/images`
- `POST /api/wanted`・`PATCH /api/wanted/[id]`
- `POST /api/approaches`（interest/offer 共通）
- `POST /api/consultations`（出品・購入の相談。未ログイン可）
- `POST /api/threads`・`POST /api/threads/[id]/messages`
- `POST /api/admin/agreements`・`POST /api/admin/deals`・`POST /api/admin/deals/[id]/conclude`

---

## 7. 主要フローの実装仕様

### 7.1 会員登録（簡単登録）
1. メール＋パスワードで Supabase Auth サインアップ。
2. **法人番号（13桁）**・**都道府県**・**市区町村**・担当者名を入力 → `organizations`/`profiles` 作成。
3. 法人番号は13桁数字の形式チェック（実在確認は任意・フェーズ2）。売り手/買い手は固定しない（兼任可）。

### 7.2 売りたい（出品）登録 → 公開
1. `/account/listings/new`。所在地は組織の都道府県/市区町村を初期値。
2. 保守（メーカー保守 yes/no/unknown・引継ぎ可否・補足）と付属品（有無＋内容）を入力（**公開**）。
3. 画像を Storage へ（`listing-images/{listing_id}/...`）。
4. 保存時 `pending_review` → 運営承認で `published`。
5. 公開表示は **匿名**（「{市区町村}の医療機関」）。組織名・連絡先は出さない。

### 7.3 買いたい（リクエスト）登録 → 公開 ★v2
1. `/account/wanted/new`。カテゴリ必須、メーカー/機種名は任意、予算・希望時期・希望エリア（都道府県/市区町村）・要件を入力。
2. 保存時 `pending_review` → 運営承認で `published`。
3. `/wanted/[id]` と `/market`（買いたいタブ）に **匿名** で掲載。

### 7.4 アプローチ（双方向）
- **関心（interest）**：買い手が `/listings/[id]` から送る（`approaches.kind='interest'`）。
- **提案（offer）**：売り手が `/wanted/[id]` から「該当機器あり」を送る（`approaches.kind='offer'`、提示価格任意）。
- いずれも運営へ通知 → 運営が `thread(kind='mediation')` を起票し中継。やり取りは匿名。
- **保守・付属品Q&A**：買い手は出品詳細から `thread(kind='qa')` を作成して質問可（匿名・連絡先非開示）。

### 7.4.5 出品・購入の相談（買い手・売り手共通）
1. ヘッダー/フッター/モバイルバー/各詳細ページの **「出品・購入を相談する」** から `/consult` へ（未ログインでも可）。
2. フォームで **相談種別（出品 / 購入 / その他）** を選び、本文と任意の連絡先を入力（**匿名相談OK**）。詳細ページからの遷移時は対象投稿IDを引き継ぐ。
3. `consultations` に保存 → 運営へ通知。`/admin/consultations` で対応。LINEでの相談導線も併記。
4. 相談から、運営が出品/買いたい登録や仲介スレッド起票へ橋渡しする（自己登録が難しい会員の受け皿）。

### 7.5 合意 → 連絡先開示
- 運営が双方の合意を確認 → 当該 `thread.contact_disclosed=true`。
- 以降のみ会員画面に **連絡先カード（組織名・担当・電話・メール）** を表示。

### 7.6 仲介契約 →（後に）売買契約 → 請求
1. **先に** 運営が `mediation_agreements`（売り手⇔運営、rate=0.075）を作成・送付 → 売り手合意で `signed`。
2. `signed` に紐づけて `deals` を作成。保守有無等で `contract_template_key` を選びひな形生成。
3. 双方が契約締結 → `deals.status='contracted'`、`concluded_at` セット。
4. **成立と同時に** `commission_invoices` 発行（`amount=round(agreed_price*0.075)`）。締結済み契約書を運営へ提出。

### 7.7 契約ひな形（案件ごとに可変）
- ひな形をパラメータ化（`maker_maintenance`, `maintenance_transferable`, 付属品 等）で条項差し替え。フェーズ1は「テンプレ選択＋手動編集」でも可。

---

## 8. 開発フェーズ（この順で実装）

### Phase 0 — 基盤移行＆デザイン基盤
- `@astrojs/cloudflare` 導入、`output:'server'`、既存ページに `prerender=true`（**既存URL/SEO維持**）。
- Supabase 接続、`0001_init.sql` 適用、`categories` シード。
- **デザイントークン（第A章）を Tailwind に定義**、共通ヘッダー/フッター刷新。
- **受入基準**：既存LP/ブログ/カテゴリ/事例が従来URLで表示。新トークンが適用。Supabase接続可。

### Phase 1 — MVP（双方向登録＋運営）
- 簡単会員登録（法人番号＋都道府県/市区町村）／ログイン。
- **売りたい出品**CRUD＋画像、**買いたいリクエスト**CRUD（★v2で同時）。運営審査 `pending_review→published`。
- **統合マーケット `/market`**（売り/買いタブ＋フィルタ）、`/listings/[id]`、`/wanted/[id]`（匿名表示）。
- アプローチ（関心/提案）送信 → 運営へ通知 → `/admin` で確認。
- **「出品・購入を相談する」CTA＋`/consult` フォーム**（買い手/売り手共通・匿名OK）→ `/admin/consultations`。
- 刷新トップ（2大導線＋相談CTA）。
- **受入基準**：売り手が出品、買い手が買いたいを登録し、運営承認で公開。両方が `/market` に並び種別が色で判別できる。関心/提案を送れる。公開画面に組織名/連絡先なし、所在地は都道府県＋市区町村のみ。

### Phase 2 — 仲介・契約・請求・通知
- 匿名メッセージ（Q&A＋仲介、`visible_to` 出し分け、Realtime）。
- 合意イベント → `contact_disclosed` → 連絡先カード解放。
- 仲介契約 → 売買契約 → **成約と同時に7.5%請求発行**（自動）。
- 通知（メール/LINE）。法人番号API実在確認（任意）。
- **受入基準**：仲介契約 signed でないと deal 作成不可。deal 成約で請求が自動発行され金額が `agreed_price*0.075`。連絡先は合意後のみ表示。

### Phase 3 — 拡張
- 評価/バッジ、レコメンド（買いたい⇔売りたい自動マッチ提案）、成約データからの事例自動生成、分析ダッシュボード、ひな形自動差し込み高度化。

---

## 9. 受入チェックリスト（横断）

- [ ] **売りたい・買いたいの両方** を登録でき、`/market` に並ぶ（種別が青/オレンジで判別可）。
- [ ] **「出品・購入を相談する」** が買い手・売り手の双方向けにヘッダー/フッター/モバイルバー/各詳細に常設され、未ログインでも `/consult` から送信できる。
- [ ] 公開API/ページで `organizations.name/address_detail/phone/contact_email` が **一切返らない**。
- [ ] 所在地/希望エリアは **都道府県＋市区町村** のみ。番地・施設名なし。
- [ ] 投稿・アプローチ・メッセージは **合意前は匿名**（「{市区町村}の医療機関」）。
- [ ] **合意後のみ** 連絡先カードが表示される（`contact_disclosed`）。
- [ ] 会員登録ゲートは **法人番号（13桁）** のみ。売り手/買い手とも数ステップ完了。
- [ ] **仲介契約（signed）が先**、その後に売買契約（deal）が作れる。
- [ ] **売買契約成立と同時に** 7.5%手数料請求が発行される。
- [ ] 保守状況・付属品が出品に公開され、買い手が **匿名Q&A** で質問できる。
- [ ] **ブログ・既存URL（/blog, /categories, /cases, /about, /terms, /privacy）が変更されていない**。
- [ ] 第A章のデザイントークン/コンポーネント規約に沿っている（色・余白を勝手に増やしていない）。
- [ ] `SUPABASE_SERVICE_ROLE_KEY` がクライアントへ漏れていない。

---

## 10. コンプライアンス注記（実装に影響）

- 本サービスは **純粋仲介**（クリニック間の相対契約）。運営は売主にならない前提。中古の高度管理／特定保守管理医療機器の売買には薬機法上の販売業許可・営業所管理者・製造販売業者への中古通知が関わるため、**公開前に行政・専門家へ要確認**。
- システムは「製造販売業者への中古通知」を売り手にリマインドする運営チェックリストを `/admin/deals` に持たせる。
- 投稿文・表現は医療広告ガイドライン／薬機法に配慮し、**入力項目を定型化＋運営審査** で統制する。

---

## 付録A. 推奨ディレクトリ構成（Astro）

```
src/
  layouts/
  pages/
    index.astro                 # static（刷新トップ）
    consult.astro               # server（出品・購入を相談する）
    market/index.astro          # server（売り/買い統合一覧）
    listings/[id].astro         # server（売りたい詳細）
    wanted/[id].astro           # server（買いたい詳細）
    categories/[slug].astro     # static（既存・URL維持）
    blog/ ...                   # static（既存・URL維持）
    cases.astro about.astro terms.astro privacy.astro  # 既存・URL維持
    auth/{register,login}.astro
    account/                    # server（会員：listings / wanted / approaches / threads / deals）
    admin/                      # server（運営）
    api/                        # server（API）
  lib/
    supabase/{client.ts,server.ts}
    auth.ts
    listings.ts wanted.ts approaches.ts threads.ts deals.ts
  components/
    PostCard.astro MarketFilters.astro ListingDetail.astro WantedDetail.astro
    MaintenanceBadge.astro MessageThread.astro ContactCard.astro
    ConsultButton.astro ConsultForm.astro
    StepForm.astro BottomActionBar.astro EmptyState.astro
  styles/tokens.css             # 第A章トークン
supabase/
  migrations/0001_init.sql
  seed/categories.sql
docs/spec.md                    # 本書
.cursor/rules
```

## 付録B. `.cursor/rules` 雛形

```
- docs/spec.md を常に参照し、これを唯一の正とする。
- 第3章「ビジネスルール」を変更・緩和しない（純粋仲介／双方向登録／匿名／合意後開示／仲介契約先行／成約時7.5%請求）。
- ブログ・既存URL（/blog, /categories, /cases, /about, /terms, /privacy）を変更・削除しない。
- デザインは第A章のトークン/コンポーネント規約に従う。色・余白・角丸を勝手に増やさない。
- DBスキーマ変更は必ず supabase/migrations に新規ファイルを追加（既存を書き換えない）。
- 公開ページ・公開APIで組織名・番地・連絡先を返さない。
- 開発は spec 第8章のフェーズ順。各フェーズの受入基準を満たすまで次へ進まない。
- service role キーをクライアントバンドルに含めない。
```
