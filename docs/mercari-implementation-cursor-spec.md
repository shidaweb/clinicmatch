# クリニックマッチ｜売りたい画像登録＋メルカリ風UI 実装指示書（詳細・Cursor向け）

> 目的：出品（売りたい）に**メルカリ風の写真登録**を実装し、探す＝写真カードグリッド、買いたい＝参考画像（任意）に対応する。
> 前提：**URL不変**・デザインは `docs/design-spec.md` 準拠・画像バックエンドは実装済み（`listing-images` バケット、`listing_images`、`POST /api/listings/[id]` の画像アップロード）。
> 全体像は `docs/mercari-screens-cursor-spec.md` を参照。本書は**コード付きの実装手順**。

## 実装順（この順でPR）
1. 画像の削除・表紙・並べ替えAPIを追加（§2）
2. `ListingImagePicker.tsx` 作成（§3）
3. `ListingComposer.tsx` 作成＋ `account/listings/new.astro` を差し替え（§4）
4. 編集ページ `account/listings/[id]/edit.astro` 対応（§5）
5. 探す `cases/index.astro` を写真カードグリッド＋モバイルフィルタ（§6）
6. （任意）買いたい参考画像：マイグレーション＋API＋ピッカー（§7）

各ステップ後に §8 の受入基準を確認。**既存APIの入出力（JSON/FormData）を変えないこと。**

---

## 1. 既存仕様の確認（変更しない）
- `POST /api/listings`（JSON, `submit:false|true`）→ `{ id }`。作成のみ。
- `POST /api/listings/[id]`（multipart, field=`file`）→ 1枚アップロード。**最初の1枚が自動 `is_cover=true`**、`sort_order` は既存枚数。
- `PATCH /api/listings/[id]`（JSON）→ 各項目更新・`submit:true` で `pending_review`。**公開中(`published`)は編集不可**。
- 公開画像URL：`${PUBLIC_SUPABASE_URL}/storage/v1/object/public/listing-images/${storage_path}`。
- 認証/DB：`getProfile(cookies, locals)`, `createSupabaseServerClient(cookies, locals)`, `createSupabaseAdminClient(locals)`。APIは `export const prerender = false;` と `json()` ヘルパー。

---

## 2. 追加API：画像の削除・表紙・並べ替え

### 2.1 `src/pages/api/listings/[id]/images/[imageId].ts`（DELETE）
```ts
import type { APIRoute } from 'astro';
import { getProfile } from '~/lib/auth';
import { createSupabaseServerClient, createSupabaseAdminClient } from '~/lib/supabase/server';

export const prerender = false;
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

export const DELETE: APIRoute = async ({ params, cookies, locals }) => {
  const profile = await getProfile(cookies, locals as never);
  if (!profile) return json({ error: 'ログインが必要です' }, 401);

  const { id: listingId, imageId } = params;
  if (!listingId || !imageId) return json({ error: 'IDが必要です' }, 400);

  const supabase = createSupabaseServerClient(cookies, locals as never);

  const { data: listing } = await supabase
    .from('listings').select('id, seller_org_id, status').eq('id', listingId).single();
  if (!listing || listing.seller_org_id !== profile.org_id) return json({ error: '出品が見つかりません' }, 404);
  if (listing.status === 'published') return json({ error: '公開中は編集できません' }, 400);

  const { data: img } = await supabase
    .from('listing_images').select('id, storage_path, is_cover').eq('id', imageId).eq('listing_id', listingId).single();
  if (!img) return json({ error: '画像が見つかりません' }, 404);

  const admin = createSupabaseAdminClient(locals as never);
  await admin.storage.from('listing-images').remove([img.storage_path]);
  const { error } = await supabase.from('listing_images').delete().eq('id', imageId);
  if (error) return json({ error: error.message }, 400);

  // 表紙を消したら残り先頭を表紙に
  if (img.is_cover) {
    const { data: rest } = await supabase
      .from('listing_images').select('id').eq('listing_id', listingId).order('sort_order', { ascending: true }).limit(1);
    if (rest?.[0]) await supabase.from('listing_images').update({ is_cover: true }).eq('id', rest[0].id);
  }
  return json({ success: true });
};
```

### 2.2 `src/pages/api/listings/[id]/images/index.ts`（PATCH：並べ替え／表紙）
```ts
import type { APIRoute } from 'astro';
import { getProfile } from '~/lib/auth';
import { createSupabaseServerClient } from '~/lib/supabase/server';

export const prerender = false;
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

export const PATCH: APIRoute = async ({ params, request, cookies, locals }) => {
  const profile = await getProfile(cookies, locals as never);
  if (!profile) return json({ error: 'ログインが必要です' }, 401);
  const listingId = params.id;
  if (!listingId) return json({ error: 'IDが必要です' }, 400);

  const body = (await request.json()) as { order?: string[]; coverId?: string };
  const supabase = createSupabaseServerClient(cookies, locals as never);

  const { data: listing } = await supabase
    .from('listings').select('id, seller_org_id, status').eq('id', listingId).single();
  if (!listing || listing.seller_org_id !== profile.org_id) return json({ error: '出品が見つかりません' }, 404);
  if (listing.status === 'published') return json({ error: '公開中は編集できません' }, 400);

  if (Array.isArray(body.order)) {
    await Promise.all(body.order.map((imgId, i) =>
      supabase.from('listing_images').update({ sort_order: i }).eq('id', imgId).eq('listing_id', listingId)));
  }
  if (body.coverId) {
    await supabase.from('listing_images').update({ is_cover: false }).eq('listing_id', listingId);
    await supabase.from('listing_images').update({ is_cover: true }).eq('id', body.coverId).eq('listing_id', listingId);
  }
  return json({ success: true });
};
```

---

## 3. `src/components/interactive/ListingImagePicker.tsx`

親が `files: PickedImage[]` を保持し、本コンポーネントは表示・追加・削除・表紙指定（先頭へ移動）を行う。

```tsx
import { useRef } from 'react';

export type PickedImage = { key: string; file: File; url: string };

const MAX = 10;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 8 * 1024 * 1024;

export default function ListingImagePicker({
  items, onChange, onError,
}: {
  items: PickedImage[];
  onChange: (next: PickedImage[]) => void;
  onError?: (msg: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const incoming = Array.from(fileList);
    const next = [...items];
    for (const file of incoming) {
      if (next.length >= MAX) { onError?.(`画像は最大${MAX}枚までです`); break; }
      if (!ALLOWED.includes(file.type)) { onError?.('JPEG / PNG / WebP のみ対応しています'); continue; }
      if (file.size > MAX_BYTES) { onError?.('1枚あたり8MBまでです'); continue; }
      next.push({ key: `${Date.now()}-${file.name}-${next.length}`, file, url: URL.createObjectURL(file) });
    }
    onChange(next);
    if (inputRef.current) inputRef.current.value = '';
  };

  const remove = (key: string) => {
    const target = items.find((i) => i.key === key);
    if (target) URL.revokeObjectURL(target.url);
    onChange(items.filter((i) => i.key !== key));
  };
  const makeCover = (key: string) => {
    const target = items.find((i) => i.key === key);
    if (!target) return;
    onChange([target, ...items.filter((i) => i.key !== key)]);
  };

  return (
    <div>
      <p className="cm-label">写真（最大{MAX}枚／1枚目が表紙）</p>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {items.map((img, idx) => (
          <div key={img.key} className="relative aspect-square rounded-input overflow-hidden border border-line bg-cream">
            <img src={img.url} alt="" className="w-full h-full object-cover" />
            {idx === 0 && (
              <span className="absolute top-1 left-1 bg-rose-deep text-white text-[10px] font-bold rounded px-1.5 py-0.5">表紙</span>
            )}
            <button type="button" onClick={() => remove(img.key)} aria-label="削除"
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/45 text-white text-xs flex items-center justify-center">×</button>
            {idx !== 0 && (
              <button type="button" onClick={() => makeCover(img.key)}
                className="absolute bottom-1 inset-x-1 bg-white/90 text-plum text-[10px] rounded py-0.5">表紙にする</button>
            )}
          </div>
        ))}
        {items.length < MAX && (
          <button type="button" onClick={() => inputRef.current?.click()}
            className="aspect-square rounded-input border-[1.5px] border-dashed border-rose/60 text-rose-deep flex flex-col items-center justify-center text-xs">
            <span className="text-xl leading-none">＋</span>写真を追加
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-plum-soft">院名・銘板・患者が写らないようにしてください。</p>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
        onChange={(e) => addFiles(e.target.files)} />
    </div>
  );
}
```

---

## 4. `src/components/interactive/ListingComposer.tsx`（フォーム＋3ステップ送信）

`account/listings/new.astro` の素のフォームを置き換える。フィールド＋画像＋送信を1つの島で管理。

```tsx
import { useState } from 'react';
import ListingImagePicker, { type PickedImage } from './ListingImagePicker';

const CATEGORIES = [
  ['hair-removal', '脱毛'], ['pico-laser', 'ピコレーザー'], ['ipl', 'IPL・光治療'],
  ['hifu', 'HIFU'], ['rf', 'RF・高周波'], ['body', '痩身・ボディ'],
] as const;

type Props = { prefectures: string[]; defaultPrefecture?: string; defaultCity?: string };

export default function ListingComposer({ prefectures, defaultPrefecture, defaultCity }: Props) {
  const [images, setImages] = useState<PickedImage[]>([]);
  const [status, setStatus] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [form, setForm] = useState({
    category_slug: 'hair-removal', maker: '', model: '', asking_price: '', manufacture_year: '',
    location_prefecture: defaultPrefecture ?? '', location_city: defaultCity ?? '',
    condition: '', maker_maintenance: 'unknown', maintenance_transferable: 'unknown',
    has_accessories: false, accessories_detail: '', description: '',
  });
  const set = (k: keyof typeof form, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  async function uploadAll(id: string) {
    for (let i = 0; i < images.length; i++) {
      setStatus(`画像をアップロード中… ${i + 1}/${images.length}`);
      const fd = new FormData();
      fd.append('file', images[i].file);
      const res = await fetch(`/api/listings/${id}`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`画像${i + 1}枚目の保存に失敗しました`);
    }
  }

  async function handleSubmit(submit: boolean) {
    if (busy) return;
    if (!form.maker.trim() || !form.model.trim()) { setStatus('メーカー・機種名は必須です'); return; }
    setBusy(true);
    try {
      let id = draftId;
      if (!id) {
        setStatus('保存中…');
        const res = await fetch('/api/listings', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, submit: false }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? '保存に失敗しました');
        id = j.id; setDraftId(j.id);
      } else {
        await fetch(`/api/listings/${id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, submit: false }),
        });
      }
      await uploadAll(id!);
      if (submit) {
        setStatus('申請中…');
        const res = await fetch(`/api/listings/${id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ submit: true }),
        });
        if (!res.ok) throw new Error('申請に失敗しました');
      }
      window.location.href = '/account/listings';
    } catch (e) {
      setStatus(e instanceof Error ? e.message : '送信に失敗しました（もう一度お試しください）');
    } finally {
      setBusy(false);
    }
  }

  const input = 'cm-input';
  return (
    <div className="cm-card p-6 space-y-5">
      <ListingImagePicker items={images} onChange={setImages} onError={setStatus} />

      <div><label className="cm-label">カテゴリ</label>
        <select className={input} value={form.category_slug} onChange={(e) => set('category_slug', e.target.value)}>
          {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select></div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div><label className="cm-label">メーカー</label>
          <input className={input} value={form.maker} onChange={(e) => set('maker', e.target.value)} /></div>
        <div><label className="cm-label">機種名</label>
          <input className={input} value={form.model} onChange={(e) => set('model', e.target.value)} /></div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div><label className="cm-label">希望価格（円）</label>
          <input className={input} type="number" value={form.asking_price} onChange={(e) => set('asking_price', e.target.value)} /></div>
        <div><label className="cm-label">年式</label>
          <input className={input} type="number" value={form.manufacture_year} onChange={(e) => set('manufacture_year', e.target.value)} /></div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div><label className="cm-label">都道府県</label>
          <select className={input} value={form.location_prefecture} onChange={(e) => set('location_prefecture', e.target.value)}>
            {prefectures.map((p) => <option key={p} value={p}>{p}</option>)}
          </select></div>
        <div><label className="cm-label">市区町村</label>
          <input className={input} value={form.location_city} onChange={(e) => set('location_city', e.target.value)} /></div>
      </div>

      <div><label className="cm-label">状態</label>
        <input className={input} value={form.condition} onChange={(e) => set('condition', e.target.value)} placeholder="状態良好・動作確認済 など" /></div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div><label className="cm-label">メーカー保守</label>
          <select className={input} value={form.maker_maintenance} onChange={(e) => set('maker_maintenance', e.target.value)}>
            <option value="unknown">不明</option><option value="yes">あり</option><option value="no">なし</option>
          </select></div>
        <div><label className="cm-label">保守の譲渡</label>
          <select className={input} value={form.maintenance_transferable} onChange={(e) => set('maintenance_transferable', e.target.value)}>
            <option value="unknown">不明</option><option value="yes">可</option><option value="no">不可</option>
          </select></div>
      </div>

      <div><label className="cm-label">説明（任意）</label>
        <textarea className={input} rows={4} value={form.description} onChange={(e) => set('description', e.target.value)} /></div>

      {status && <p className="text-sm text-plum-soft">{status}</p>}

      <div className="flex gap-3">
        <button type="button" disabled={busy} onClick={() => handleSubmit(false)} className="cm-btn-secondary text-sm flex-1">下書き保存</button>
        <button type="button" disabled={busy} onClick={() => handleSubmit(true)} className="cm-btn-primary text-sm flex-[1.6]">確認に進む（審査へ）</button>
      </div>
    </div>
  );
}
```

### 4.1 `src/pages/account/listings/new.astro`（差し替え）
```astro
---
export const prerender = false;
import AccountLayout from '~/layouts/AccountLayout.astro';
import ListingComposer from '~/components/interactive/ListingComposer';
import { getProfile } from '~/lib/auth';
import { PREFECTURES } from '~/lib/marketplace';

const profile = await getProfile(Astro.cookies, Astro.locals as never);
if (!profile) return Astro.redirect('/auth/login');
const org = profile.organizations as { prefecture?: string; city?: string } | null;
const metadata = { title: '売りたいを出す' };
---
<AccountLayout metadata={metadata} title="売りたい機器を登録・相談する" maxWidth="2xl">
  <ListingComposer client:load prefectures={PREFECTURES} defaultPrefecture={org?.prefecture} defaultCity={org?.city} />
</AccountLayout>
```

> 注意：`cm-input` `cm-label` `cm-btn-primary` `cm-btn-secondary` は既存クラス（`src/assets/styles/tailwind.css`）。無い場合は同ファイルに準拠して追加。

---

## 5. 編集ページ `account/listings/[id]/edit.astro`
- `ListingComposer` を**初期値つき**で再利用（`initial` props を追加：既存フィールド＋既存画像URL一覧）。
- 既存画像は別表示し、**削除＝§2.1 DELETE**、**表紙/並べ替え＝§2.2 PATCH** を呼ぶ。新規追加は `POST /api/listings/[id]`。
- 送信は新規作成をスキップし、`draftId = 既存id` として PATCH（フィールド更新）＋画像アップロード＋`submit:true`。
- `published` の場合はフォームを無効化し「運営にお問い合わせ」を表示（APIも拒否する）。

---

## 6. 探す `src/pages/cases/index.astro`（写真カードグリッド＋モバイルフィルタ）

### 6.1 グリッド
- 結果は `PostCard` の**グリッド**：`class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4"`。
- `PostCard.astro`：cover画像を `aspect-square object-cover w-full`、`loading="lazy"`、`alt={\`${maker} ${model}\`}`。**画像が無い場合**はカテゴリ色の無地＋アイコン（404を出さない）。種別タグ（募集中=ローズ／買いたい=ベージュ／成約=グレー）、機種名（明朝）、`年式・市区町村`、価格（明朝）。

### 6.2 モバイルのフィルタ（ボトムシート）
- 既存の左フィルタは `lg:` 以上で表示（`hidden lg:block`）。
- モバイルは結果上部に「絞り込み」ボタン → ボトムシート。最小実装：
```astro
<button id="filter-open" class="lg:hidden cm-btn-secondary text-sm">絞り込み</button>
<div id="filter-sheet" class="fixed inset-0 z-50 hidden">
  <div class="absolute inset-0 bg-black/40" data-close></div>
  <div class="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-ivory p-5">
    <!-- 既存フィルタ form をここにも配置（同名パラメータ） -->
  </div>
</div>
<script>
  const open = document.getElementById('filter-open');
  const sheet = document.getElementById('filter-sheet');
  open?.addEventListener('click', () => sheet?.classList.remove('hidden'));
  sheet?.querySelector('[data-close]')?.addEventListener('click', () => sheet.classList.add('hidden'));
</script>
```
- 0件時は既存の空状態（「条件で相談する」）を維持。

---

## 7. （任意）買いたいの参考画像

### 7.1 マイグレーション `supabase/migrations/0004_wanted_reference_image.sql`
```sql
alter table wanted_requests add column if not exists reference_image_path text;

insert into storage.buckets (id, name, public)
values ('wanted-images', 'wanted-images', true) on conflict (id) do nothing;

drop policy if exists "wanted_images_public_read" on storage.objects;
create policy "wanted_images_public_read" on storage.objects for select
  using (bucket_id = 'wanted-images');

drop policy if exists "wanted_images_auth_upload" on storage.objects;
create policy "wanted_images_auth_upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'wanted-images'
    and (storage.foldername(name))[1] in (
      select w.id::text from wanted_requests w where w.buyer_org_id = auth_org_id()));
```

### 7.2 API `POST /api/wanted/[id]`（multipart `file`）
- listing の画像APIと同形。`wanted-images/{id}/...` にアップロードし `wanted_requests.reference_image_path` を更新（所有org検証）。1枚のみ（再アップロードで置換）。

### 7.3 UI
- `WantedComposer.tsx`（`ListingComposer` を簡略化）に「参考画像（任意・1枚）」を追加。フローは下書き作成→画像→submit。
- 公開ビュー/カードで `reference_image_path` があれば表示、無ければカテゴリアイコン。`PUBLIC_WANTED_SELECT` に列を追加。

> 優先度：低（売りたいの画像が本命）。後追い可。

---

## 8. 受入基準
- [ ] 売りたいで複数画像を選び、表紙指定・削除ができ、スマホでカメラ/アルバムから選べる。
- [ ] 「確認に進む」で `作成→画像→submit` が順に走り、進捗が出る。失敗時はメッセージ＋再試行で**二重作成しない**（`draftId` 保持）。
- [ ] 「下書き保存」は submit せず保存し `/account/listings` へ。
- [ ] 公開後、探す/詳細/カードに写真が出る（alt＝メーカー機種名、遅延読込、CLS無し）。
- [ ] 探すが写真カードグリッド（モバイル2カラム）、フィルタはモバイルでボトムシート。
- [ ] 画像が無い投稿でプレースホルダ表示（404なし）。
- [ ] 画像の削除/表紙/並べ替えAPIが所有org・未公開を検証。
- [ ] （任意導入時）買いたいの参考画像が無くても登録できる。
- [ ] 既存URL不変・トークンのみ使用・公開画面に組織名/連絡先を出さない。

## 9. 変更/新規ファイル
新規：`api/listings/[id]/images/[imageId].ts`、`api/listings/[id]/images/index.ts`、`components/interactive/ListingImagePicker.tsx`、`components/interactive/ListingComposer.tsx`、（任意）`migrations/0004_wanted_reference_image.sql`・`api/wanted/[id].ts`(POST)・`components/interactive/WantedComposer.tsx`。
編集：`account/listings/new.astro`、`account/listings/[id]/edit.astro`、`cases/index.astro`、`PostCard.astro`、（任意）`account/wanted/new.astro`・`lib/marketplace.ts`(PUBLIC_WANTED_SELECT)。
