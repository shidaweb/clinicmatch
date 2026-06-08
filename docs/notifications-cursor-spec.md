# クリニックマッチ｜通知メール 実装指示書（Cursor向け）

> 前提：**(A) 認証メールは Supabase Auth の機能を活用**（ダッシュボードのテンプレ＝`docs/supabase-auth-email-templates.md`）。**(B) 取引通知メールは、その同じHTMLテンプレートのデザインで、アプリから Resend 経由で送る**。
> 既存実装：`src/lib/notifications.ts` の `sendAdminEmail`（Resend・宛先ハードコード）と各APIハンドラ。これを拡張して当事者通知まで対応する。
> 関連：通知仕様（イベント/タイミング）、`docs/spec.md`（システム）。
> 作成日：2026-06-06

---

## 0. Cursorへの基本指示
- 本書を `docs/notifications-cursor-spec.md` として参照。`.cursor/rules` に「通知は本書を正とする」「メール本文に当事者の実名・連絡先・番地を出さない（匿名）」を追記。
- **認証メールのHTMLはコードで作らない**（Supabaseが送る）。コードで作るのは**取引通知メール**のみ。
- 既存の `sendAdminEmail` を壊さず、共通基盤に**リファクタ＋追加**する形で実装する。

---

## 1. 全体方針：メールは2系統に分ける

### (A) 認証メール ＝ Supabase Auth が送信（コード不要）
対象：サインアップ確認 / 招待 / マジックリンク・OTP / メール変更 / パスワード再設定 / 再認証。
- ダッシュボード **Authentication → Emails** に `docs/supabase-auth-email-templates.md` のテンプレを設定済みにする。
- **配信は Supabase の Custom SMTP に Resend を設定**して、`noreply@clinicmatch.org` から送る（ブランド統一＋到達率）。Auth → SMTP Settings に Resend の SMTP 情報を入れる。
- アプリ側はログインに `signInWithOtp` / `resetPasswordForEmail` 等を呼ぶだけ。**本文HTMLは書かない**。

### (B) 取引通知メール ＝ アプリが Resend で送信（本書の実装対象）
対象：関心・提案・相談・仲介開始・新着メッセージ・合意/連絡先開示・成約/手数料・各リマインド。
- 認証メールと**同じ見た目**（ブランドHTML）を共通レンダラで生成し、Resend API へ送る。
- 既存 `sendAdminEmail` と同じ Resend 呼び出し経路を共通化して使う。

---

## 2. 共通メール基盤（`src/lib/notifications.ts` を拡張）

### 2.1 環境変数（ハードコード廃止）
```
RESEND_API_KEY=re_xxx
PUBLIC_SITE_URL=https://clinicmatch.org
ADMIN_NOTIFY_EMAILS=master@jugyoin.jp,general-...@kiruck.slack.com   # カンマ区切り
MAIL_FROM=クリニックマッチ <noreply@clinicmatch.org>
```
現状コードに直書きの宛先（`master@jugyoin.jp` 等）は `ADMIN_NOTIFY_EMAILS` から読む。`src/pages/api/contact.ts` の重複ロジックも本基盤に寄せる。

### 2.2 共通レイアウト `renderEmail()`（ブランドHTML＝認証メールと同デザイン）
`src/lib/emails/layout.ts` を新規作成。
```ts
type EmailButton = { label: string; url: string };
export function renderEmail(opts: {
  heading: string;
  paragraphs: string[];      // 各要素=1段落（短文）
  button?: EmailButton;      // CTA（任意）
  code?: string;            // OTP/コード表示（任意）
  fallbackUrl?: string;      // ボタンのURLテキスト表示（任意）
  note?: string;             // 末尾の注意書き（有効期限・心当たり等）
}): string {
  // docs/supabase-auth-email-templates.md と同じ構造で返す：
  //   背景#EFE3DC / カード#FBF6F2 / ヘッダー"clinic match"(明朝) /
  //   見出し(明朝21px) / 本文(#6E565D 14px) / ボタン(#A1606E ピル) /
  //   コード箱(明朝) / 罫線注記(#9E8A8F) / フッター(#46343A・送信専用)
  // すべてインラインCSS・テーブルレイアウト・Webフォント非依存。
}
export function escapeHtml(s: string): string { /* 既存を流用 */ }
```
> 認証メールのHTML（`docs/supabase-auth-email-templates.md`）と**同一の装飾トークン**を使うこと。デザインの二重管理を避けるため、取引通知は必ず `renderEmail()` 経由にする。

### 2.3 送信関数
```ts
// 既存 sendAdminEmail は内部で sendEmail を呼ぶ薄いラッパへ
export async function sendEmail(to: string[], subject: string, html: string, locals?): Promise<boolean> { /* Resend POST */ }
export async function sendAdminEmail(subject: string, html: string, locals?) {
  return sendEmail(getAdminEmails(locals), subject, html, locals); // ADMIN_NOTIFY_EMAILS
}
export async function sendUserEmail(to: string, subject: string, html: string, locals?) {
  if (!to) return false;
  return sendEmail([to], subject, html, locals);
}
```

### 2.4 宛先解決ヘルパー `src/lib/emails/recipients.ts`
```ts
// 会員のメール：auth.users から取得（service role）
export async function getUserEmail(admin, userId: string): Promise<string|null> {
  const { data } = await admin.auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
}
// 組織の代表メール：その org の profile を1件引き、auth から email
export async function getOrgPrimaryEmail(admin, orgId: string): Promise<string|null> {
  const { data } = await admin.from('profiles').select('id').eq('org_id', orgId).limit(1).maybeSingle();
  return data ? getUserEmail(admin, data.id) : null;
}
```
> 簡素化のため `profiles.email` カラムを持たせて同期する案も可（マイグレーション追加）。どちらでも良いが**本人のメールを確実に引ける**ようにする。

---

## 3. 送り分けモデル（3者）

アクションの性質で分ける。**当事者・相手向けメールには相手を特定できる情報を入れない**（所在地は「○○区の医療機関」まで／実名・連絡先は合意後の保護画面のみ）。

- **登録（出品/買いたい作成）＝相手なし → 2通**：行動ユーザに受付ack ＋ 運営に対応依頼。
- **関心・提案＝相手あり → 3通**：行動ユーザに受付ack ＋ 相手側に「運営から連絡します」（匿名）＋ 運営に対応依頼。
- **相談（/contact）→ 2通**：ユーザに受付ack（contact_email があれば）＋ 運営に対応依頼。

---

## 4. テンプレ登録 `src/lib/emails/templates.ts`

各イベントごとに `{ subject, html }` を返す関数を定義（`renderEmail()` を使用）。**匿名安全**な引数だけ受け取る。例：

```ts
import { renderEmail } from './layout';
const SITE = import.meta.env.PUBLIC_SITE_URL;

// (B) 関心：相手側（売り手）— 匿名・「運営から連絡します」
export function interestToSeller(p: { listingTitle: string; category: string; area: string }) {
  return {
    subject: '【クリニックマッチ】あなたの出品に関心が寄せられました',
    html: renderEmail({
      heading: 'あなたの出品に関心が寄せられました',
      paragraphs: [
        `「${p.listingTitle}」（${p.category}）に関心が寄せられました。`,
        '詳細は運営よりご連絡しますので、今しばらくお待ちください。',
        '相手の情報は、双方の合意後にのみ開示されます。',
      ],
      button: { label: 'マイページを開く', url: `${SITE}/account/approaches` },
      note: 'お心当たりがない場合は、このメールを破棄してください。',
    }),
  };
}
// (B) 関心：行動ユーザ（買い手）受付ack
export function interestToBuyer(p: { listingTitle: string }) { /* 「関心を受け付けました。運営よりご連絡します。」 */ }
// (B) 関心：運営 対応依頼（社内＝ID/orgを含めてよい）
export function interestToAdmin(p: { approachId: string; listingId: string; fromOrgId: string; message?: string }) { /* 着手リンク付き */ }
// (A系) 登録・相談・仲介開始・新着メッセージ・開示・成約… も同様に用意
```

文面ルール（skill準拠）：結論先出し・短文・です/ます・具体的CTA（「マイページを開く」「対応する」等）。効能効果の断定をしない。

---

## 5. イベント → 宛先 → テンプレ（ハンドラ別の実装ポイント）

既存ハンドラに当事者通知を**追加**する。⚠は現状の不足（前回の精査で判明）。

| イベント / ファイル | 行動ユーザ | 相手側（匿名） | 運営 | 備考 |
|---|---|---|---|---|
| 関心・提案 `api/approaches.ts` | `interest/offer ToActor`（受付ack） | `…ToCounterparty`（運営から連絡） | 既存＋文脈追加（種別/対象/エリア） | ⚠当事者通知が無い。3通へ |
| 相談 `api/consultations.ts` | `consultAck`（`contact_email`宛・任意） | — | `consultToAdmin` | ⚠**現状メール無し**。追加必須 |
| 旧フォーム `api/contact.ts` | 同上ackを追加 | — | 共通基盤へ統合 | 重複ロジック廃止 |
| Q&A開始 `api/threads/index.ts` | buyerへ受付ack | sellerへ「質問が届きました（運営連絡）」 | 既存 | ⚠相手通知が無い |
| 新着メッセージ `api/threads/[id]/messages.ts` | — | 相手側へ「新着メッセージ」（本文プレビューに実名/連絡先を入れない） | 既存 | ⚠相手に届かない |
| 仲介開始 `api/admin/threads/index.ts` | 買い手・売り手の双方へ「運営が仲介を開始」 | （双方が当事者） | 既存 | ⚠当事者通知が無い。原文の `visible_to:'all'` 転記は**operator限定に変更**（漏えい防止） |
| 合意・連絡先開示 `api/admin/threads/[id]/disclose.ts` | 双方へ「合意成立・連絡先を開示しました」（保護画面へ誘導） | — | 既存 | ⚠**最重要なのに当事者へ送っていない** |
| 成約・手数料 `api/admin/deals/[id]/conclude.ts` | 売り手へ「売買契約成立・手数料請求」 | 買い手へ「取引成立」 | 既存 | ⚠売り手に請求が届かない |
| 出品/買いたい 公開・差戻し（審査） | 申請者へ「公開しました/修正依頼」 | — | — | `admin/posts` の承認処理に追加 |

実装例（`api/approaches.ts` への追記イメージ）：
```ts
const admin = createSupabaseAdminClient(locals as never);
// 対象・相手の匿名情報を取得（出品名/カテゴリ/市区町村、相手org）
// 1) 行動ユーザ
const actorEmail = await getUserEmail(admin, profile.id);
if (actorEmail) { const t = interestToBuyer({ listingTitle }); await sendUserEmail(actorEmail, t.subject, t.html, locals); }
// 2) 相手側（匿名）
const sellerEmail = await getOrgPrimaryEmail(admin, listing.seller_org_id);
if (sellerEmail) { const t = interestToSeller({ listingTitle, category, area }); await sendUserEmail(sellerEmail, t.subject, t.html, locals); }
// 3) 運営（既存を文脈強化）
const a = interestToAdmin({ approachId: data.id, listingId, fromOrgId: profile.org_id, message: payload.message ?? undefined });
await sendAdminEmail(a.subject, a.html, locals);
```

---

## 6. 匿名・コンプラ ルール（必須・本文の内容）
- ユーザ／相手向けメールの**件名・本文・プレビュー**に、相手の組織名・担当者名・電話・メール・番地を**入れない**。所在地は「○○区の医療機関」まで。
- 実名・連絡先は**合意成立後**に `account/threads/[id]` の保護画面でのみ表示。メールは「マイページを開く」導線に留める。
- 医療広告/薬機法に配慮し、通知文では効能効果を断定しない（事務連絡に徹する）。
- `api/admin/threads/index.ts` のアプローチ原文転記は `visible_to:'operator'` にし、運営が確認のうえ共有する（連絡先の事前漏えい防止）。

---

## 7. リマインド（後続・任意）
- Cloudflare Workers の **Cron Triggers**（`wrangler.jsonc` に `triggers.crons`）で定期実行のAPIを叩く。
- 対象（未対応のみ）：未読メッセージ（24h/72h）、仲介契約の署名待ち、手数料の入金待ち、関心の未対応（運営）、出品の鮮度（30/60日）。
- 重複送信防止のため `notifications`（or `notification_log`）テーブルを設け、`(type, target_id, user_id)` の送信履歴で冪等化。即時通知も同テーブルに記録すると将来アプリ内通知へ拡張しやすい。

---

## 8. 変更ファイル一覧
新規：
- `src/lib/emails/layout.ts`（`renderEmail`）
- `src/lib/emails/templates.ts`（イベント別 `{subject, html}`）
- `src/lib/emails/recipients.ts`（`getUserEmail` / `getOrgPrimaryEmail`）

編集：
- `src/lib/notifications.ts`（`sendEmail`/`sendUserEmail` 追加、`sendAdminEmail` を薄ラッパ化、宛先env化）
- `src/pages/api/approaches.ts` / `consultations.ts` / `contact.ts` / `threads/index.ts` / `threads/[id]/messages.ts` / `admin/threads/index.ts` / `admin/threads/[id]/disclose.ts` / `admin/deals/[id]/conclude.ts`（当事者通知の追加）
- `admin/posts` の承認処理（公開/差戻し通知）
- `wrangler.jsonc`（cron・リマインド導入時）
- `.env.example`（`ADMIN_NOTIFY_EMAILS` / `MAIL_FROM` / `PUBLIC_SITE_URL`）

設定（コード外）：
- Supabase Authentication → Emails に `docs/supabase-auth-email-templates.md` を設定。
- Supabase Auth → SMTP に Resend を設定（送信元 `noreply@clinicmatch.org`）。

---

## 9. 受入チェックリスト
- [ ] 認証6種は Supabase ダッシュボードのテンプレで送信され、Resend SMTP 経由でブランド送信元になっている。
- [ ] 取引通知が **行動ユーザ／相手側／運営** に正しく送り分けられる（登録=2通・関心/提案=3通・相談=2通）。
- [ ] `consultations.ts` から運営＋ユーザに通知が飛ぶ（現状の無通知を解消）。
- [ ] 合意・連絡先開示、成約・手数料が**当事者にも**届く。
- [ ] すべての取引メールが `renderEmail()` 経由で、認証メールと同一デザイン。
- [ ] ユーザ／相手向けメールに相手の実名・連絡先・番地が**一切含まれない**（所在地は市区町村まで）。
- [ ] 宛先・送信元が env 化され、コード直書きが無い。
- [ ] （導入時）リマインドが cron で未対応分のみ送られ、重複しない。
