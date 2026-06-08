# クリニックマッチ｜Supabase 認証メール テンプレート

Supabase ダッシュボード → Authentication → Emails の各テンプレートに貼り付けてください。
各セクションの「件名」を Subject 欄に、`html` ブロックの中身を本文（Message body）に貼ります。

差し込み変数（Supabase が自動置換）：

- `{{ .ConfirmationURL }}` … 操作用リンク（確認・招待・再設定など）
- `{{ .Token }}` … 6桁のワンタイムコード（OTP）
- `{{ .SiteURL }}` … サイトURL
- `{{ .Email }}` / `{{ .NewEmail }}` … 現在 / 新しいメールアドレス

共通方針：結論先出し・短文・です/ます・具体的なボタン文言。Webフォントは使わず、メールで安全なシステム明朝/ゴシックにフォールバックします。色はブランド（ローズ／アイボリー／プラム）。

---

## 1. Confirm sign up（サインアップ確認）

**件名**：`【クリニックマッチ】メールアドレスの確認をお願いします`

```html
<!doctype html>
<html lang="ja">
  <body style="margin:0;padding:0;background:#EFE3DC;">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0;">メールアドレスの確認をお願いします。ボタンから数秒で完了します。</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFE3DC;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#FBF6F2;border:1px solid #ECDED7;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:22px 28px;border-bottom:1px solid #ECDED7;font-family:'Hiragino Mincho ProN','Yu Mincho',serif;font-size:18px;font-weight:600;letter-spacing:.12em;color:#46343A;">clinic&nbsp;match</td>
            </tr>
            <tr>
              <td style="padding:30px 28px;font-family:'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;color:#46343A;">
                <h1 style="margin:0 0 14px;font-family:'Hiragino Mincho ProN','Yu Mincho',serif;font-size:21px;font-weight:600;line-height:1.5;color:#46343A;">メールアドレスの確認をお願いします</h1>
                <p style="margin:0 0 8px;font-size:14px;line-height:1.9;color:#6E565D;">クリニックマッチにご登録いただき、ありがとうございます。</p>
                <p style="margin:0 0 22px;font-size:14px;line-height:1.9;color:#6E565D;">下のボタンから、メールアドレスの確認を完了してください。数秒で終わります。</p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
                  <tr><td style="background:#A1606E;border-radius:999px;">
                    <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 32px;font-family:'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:.04em;">メールアドレスを確認する</a>
                  </td></tr>
                </table>
                <p style="margin:0 0 6px;font-size:12px;line-height:1.8;color:#9E8A8F;">ボタンが開かない場合は、次のURLをブラウザに貼り付けてください。</p>
                <p style="margin:0 0 22px;font-size:12px;line-height:1.7;word-break:break-all;"><a href="{{ .ConfirmationURL }}" style="color:#A1606E;">{{ .ConfirmationURL }}</a></p>
                <p style="margin:0;padding-top:18px;border-top:1px solid #ECDED7;font-size:12px;line-height:1.8;color:#9E8A8F;">このリンクには有効期限があります。お心当たりがない場合は、このメールは破棄してください。</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;background:#46343A;font-family:'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;font-size:11px;line-height:1.7;color:#D8C4BD;">
                クリニックマッチ ／ 株式会社キラック<br>本メールは送信専用です。ご返信いただいてもお答えできません。
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

---

## 2. Invite user（ユーザー招待）

**件名**：`【クリニックマッチ】アカウント作成のご招待`

```html
<!doctype html>
<html lang="ja">
  <body style="margin:0;padding:0;background:#EFE3DC;">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0;">クリニックマッチへのご招待です。ボタンからアカウントを作成できます。</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFE3DC;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#FBF6F2;border:1px solid #ECDED7;border-radius:16px;overflow:hidden;">
          <tr><td style="padding:22px 28px;border-bottom:1px solid #ECDED7;font-family:'Hiragino Mincho ProN','Yu Mincho',serif;font-size:18px;font-weight:600;letter-spacing:.12em;color:#46343A;">clinic&nbsp;match</td></tr>
          <tr><td style="padding:30px 28px;font-family:'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;color:#46343A;">
            <h1 style="margin:0 0 14px;font-family:'Hiragino Mincho ProN','Yu Mincho',serif;font-size:21px;font-weight:600;line-height:1.5;color:#46343A;">クリニックマッチへのご招待</h1>
            <p style="margin:0 0 8px;font-size:14px;line-height:1.9;color:#6E565D;">クリニックマッチへご招待します。</p>
            <p style="margin:0 0 22px;font-size:14px;line-height:1.9;color:#6E565D;">下のボタンから、アカウントの作成にお進みください。中古の医療美容機器を、匿名のまま安心して売買できます。</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
              <tr><td style="background:#A1606E;border-radius:999px;">
                <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 32px;font-family:'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:.04em;">アカウントを作成する</a>
              </td></tr>
            </table>
            <p style="margin:0 0 6px;font-size:12px;line-height:1.8;color:#9E8A8F;">ボタンが開かない場合は、次のURLをブラウザに貼り付けてください。</p>
            <p style="margin:0 0 22px;font-size:12px;line-height:1.7;word-break:break-all;"><a href="{{ .ConfirmationURL }}" style="color:#A1606E;">{{ .ConfirmationURL }}</a></p>
            <p style="margin:0;padding-top:18px;border-top:1px solid #ECDED7;font-size:12px;line-height:1.8;color:#9E8A8F;">このご招待には有効期限があります。お心当たりがない場合は、このメールは破棄してください。</p>
          </td></tr>
          <tr><td style="padding:18px 28px;background:#46343A;font-family:'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;font-size:11px;line-height:1.7;color:#D8C4BD;">クリニックマッチ ／ 株式会社キラック<br>本メールは送信専用です。ご返信いただいてもお答えできません。</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
```

---

## 3. Magic Link or OTP（ログイン用リンク／コード）

**件名**：`【クリニックマッチ】ログイン用のリンク／コード`

```html
<!doctype html>
<html lang="ja">
  <body style="margin:0;padding:0;background:#EFE3DC;">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0;">ログイン用のリンクとコードをお送りします。</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFE3DC;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#FBF6F2;border:1px solid #ECDED7;border-radius:16px;overflow:hidden;">
          <tr><td style="padding:22px 28px;border-bottom:1px solid #ECDED7;font-family:'Hiragino Mincho ProN','Yu Mincho',serif;font-size:18px;font-weight:600;letter-spacing:.12em;color:#46343A;">clinic&nbsp;match</td></tr>
          <tr><td style="padding:30px 28px;font-family:'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;color:#46343A;">
            <h1 style="margin:0 0 14px;font-family:'Hiragino Mincho ProN','Yu Mincho',serif;font-size:21px;font-weight:600;line-height:1.5;color:#46343A;">ログインのご案内</h1>
            <p style="margin:0 0 22px;font-size:14px;line-height:1.9;color:#6E565D;">下のボタンからログインできます。ボタンが使えない場合は、コードを入力してください。</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
              <tr><td style="background:#A1606E;border-radius:999px;">
                <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 32px;font-family:'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:.04em;">ログインする</a>
              </td></tr>
            </table>
            <p style="margin:0 0 8px;font-size:13px;line-height:1.8;color:#6E565D;">ワンタイムコード</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
              <tr><td style="background:#ffffff;border:1px solid #ECDED7;border-radius:12px;padding:14px 22px;font-family:'Hiragino Mincho ProN','Yu Mincho',serif;font-size:26px;letter-spacing:.3em;color:#46343A;">{{ .Token }}</td></tr>
            </table>
            <p style="margin:0;padding-top:18px;border-top:1px solid #ECDED7;font-size:12px;line-height:1.8;color:#9E8A8F;">リンクとコードには有効期限があります。お心当たりがない場合は、このメールは破棄してください。</p>
          </td></tr>
          <tr><td style="padding:18px 28px;background:#46343A;font-family:'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;font-size:11px;line-height:1.7;color:#D8C4BD;">クリニックマッチ ／ 株式会社キラック<br>本メールは送信専用です。ご返信いただいてもお答えできません。</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
```

---

## 4. Change Email Address（メールアドレス変更の確認）

**件名**：`【クリニックマッチ】新しいメールアドレスの確認`

```html
<!doctype html>
<html lang="ja">
  <body style="margin:0;padding:0;background:#EFE3DC;">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0;">新しいメールアドレスの確認をお願いします。</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFE3DC;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#FBF6F2;border:1px solid #ECDED7;border-radius:16px;overflow:hidden;">
          <tr><td style="padding:22px 28px;border-bottom:1px solid #ECDED7;font-family:'Hiragino Mincho ProN','Yu Mincho',serif;font-size:18px;font-weight:600;letter-spacing:.12em;color:#46343A;">clinic&nbsp;match</td></tr>
          <tr><td style="padding:30px 28px;font-family:'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;color:#46343A;">
            <h1 style="margin:0 0 14px;font-family:'Hiragino Mincho ProN','Yu Mincho',serif;font-size:21px;font-weight:600;line-height:1.5;color:#46343A;">新しいメールアドレスの確認</h1>
            <p style="margin:0 0 8px;font-size:14px;line-height:1.9;color:#6E565D;">メールアドレスの変更を受け付けました。</p>
            <p style="margin:0 0 18px;font-size:14px;line-height:1.9;color:#6E565D;"><span style="color:#9E8A8F;">{{ .Email }}</span> から <span style="color:#46343A;">{{ .NewEmail }}</span> へ変更します。下のボタンで確認を完了してください。</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
              <tr><td style="background:#A1606E;border-radius:999px;">
                <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 32px;font-family:'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:.04em;">新しいアドレスを確認する</a>
              </td></tr>
            </table>
            <p style="margin:0 0 6px;font-size:12px;line-height:1.8;color:#9E8A8F;">ボタンが開かない場合は、次のURLをブラウザに貼り付けてください。</p>
            <p style="margin:0 0 22px;font-size:12px;line-height:1.7;word-break:break-all;"><a href="{{ .ConfirmationURL }}" style="color:#A1606E;">{{ .ConfirmationURL }}</a></p>
            <p style="margin:0;padding-top:18px;border-top:1px solid #ECDED7;font-size:12px;line-height:1.8;color:#9E8A8F;">お心当たりがない場合は、確認せずにこのメールを破棄してください。変更は行われません。</p>
          </td></tr>
          <tr><td style="padding:18px 28px;background:#46343A;font-family:'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;font-size:11px;line-height:1.7;color:#D8C4BD;">クリニックマッチ ／ 株式会社キラック<br>本メールは送信専用です。ご返信いただいてもお答えできません。</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
```

---

## 5. Reset Password（パスワード再設定）

**件名**：`【クリニックマッチ】パスワード再設定のご案内`

```html
<!doctype html>
<html lang="ja">
  <body style="margin:0;padding:0;background:#EFE3DC;">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0;">パスワードを再設定できます。お心当たりがない場合は破棄してください。</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFE3DC;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#FBF6F2;border:1px solid #ECDED7;border-radius:16px;overflow:hidden;">
          <tr><td style="padding:22px 28px;border-bottom:1px solid #ECDED7;font-family:'Hiragino Mincho ProN','Yu Mincho',serif;font-size:18px;font-weight:600;letter-spacing:.12em;color:#46343A;">clinic&nbsp;match</td></tr>
          <tr><td style="padding:30px 28px;font-family:'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;color:#46343A;">
            <h1 style="margin:0 0 14px;font-family:'Hiragino Mincho ProN','Yu Mincho',serif;font-size:21px;font-weight:600;line-height:1.5;color:#46343A;">パスワードの再設定</h1>
            <p style="margin:0 0 8px;font-size:14px;line-height:1.9;color:#6E565D;">パスワード再設定のご依頼を受け付けました。</p>
            <p style="margin:0 0 22px;font-size:14px;line-height:1.9;color:#6E565D;">下のボタンから、新しいパスワードを設定してください。</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
              <tr><td style="background:#A1606E;border-radius:999px;">
                <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 32px;font-family:'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:.04em;">パスワードを再設定する</a>
              </td></tr>
            </table>
            <p style="margin:0 0 6px;font-size:12px;line-height:1.8;color:#9E8A8F;">ボタンが開かない場合は、次のURLをブラウザに貼り付けてください。</p>
            <p style="margin:0 0 22px;font-size:12px;line-height:1.7;word-break:break-all;"><a href="{{ .ConfirmationURL }}" style="color:#A1606E;">{{ .ConfirmationURL }}</a></p>
            <p style="margin:0;padding-top:18px;border-top:1px solid #ECDED7;font-size:12px;line-height:1.8;color:#9E8A8F;">お心当たりがない場合は、このメールを破棄してください。パスワードは変更されません。リンクには有効期限があります。</p>
          </td></tr>
          <tr><td style="padding:18px 28px;background:#46343A;font-family:'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;font-size:11px;line-height:1.7;color:#D8C4BD;">クリニックマッチ ／ 株式会社キラック<br>本メールは送信専用です。ご返信いただいてもお答えできません。</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
```

---

## 6. Reauthentication（操作前の本人確認コード）

**件名**：`【クリニックマッチ】本人確認コード`

> このテンプレートでは URL は使えません。`{{ .Token }}`（コード）のみ送ります。

```html
<!doctype html>
<html lang="ja">
  <body style="margin:0;padding:0;background:#EFE3DC;">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0;">本人確認用のコードをお送りします。</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFE3DC;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#FBF6F2;border:1px solid #ECDED7;border-radius:16px;overflow:hidden;">
          <tr><td style="padding:22px 28px;border-bottom:1px solid #ECDED7;font-family:'Hiragino Mincho ProN','Yu Mincho',serif;font-size:18px;font-weight:600;letter-spacing:.12em;color:#46343A;">clinic&nbsp;match</td></tr>
          <tr><td style="padding:30px 28px;font-family:'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;color:#46343A;">
            <h1 style="margin:0 0 14px;font-family:'Hiragino Mincho ProN','Yu Mincho',serif;font-size:21px;font-weight:600;line-height:1.5;color:#46343A;">本人確認のコード</h1>
            <p style="margin:0 0 22px;font-size:14px;line-height:1.9;color:#6E565D;">大切な操作の前に、本人確認を行います。画面に次のコードを入力してください。</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
              <tr><td style="background:#ffffff;border:1px solid #ECDED7;border-radius:12px;padding:16px 26px;font-family:'Hiragino Mincho ProN','Yu Mincho',serif;font-size:30px;letter-spacing:.32em;color:#46343A;">{{ .Token }}</td></tr>
            </table>
            <p style="margin:0;padding-top:18px;border-top:1px solid #ECDED7;font-size:12px;line-height:1.8;color:#9E8A8F;">コードには有効期限があります。心当たりのない場合は入力せず、このメールを破棄してください。コードは誰にも共有しないでください。</p>
          </td></tr>
          <tr><td style="padding:18px 28px;background:#46343A;font-family:'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;font-size:11px;line-height:1.7;color:#D8C4BD;">クリニックマッチ ／ 株式会社キラック<br>本メールは送信専用です。ご返信いただいてもお答えできません。</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
```

---

## 貼り付け後の確認

- 各テンプレートの「件名」を Subject 欄へ、`html` の中身を本文へ。
- 送信元アドレス（noreply@clinicmatch.org など）は SMTP / 送信ドメインの設定側で行います。
- 文面に院名・連絡先などの個人情報は含めていません（認証メールの定型のみ）。取引の通知メールとは別物として運用してください。
