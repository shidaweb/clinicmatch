type EmailButton = { label: string; url: string };

export type RenderEmailOptions = {
  heading: string;
  paragraphs: string[];
  button?: EmailButton;
  code?: string;
  fallbackUrl?: string;
  note?: string;
  preheader?: string;
};

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderEmail(opts: RenderEmailOptions): string {
  const preheader = escapeHtml(opts.preheader ?? opts.paragraphs[0] ?? opts.heading);
  const heading = escapeHtml(opts.heading);

  const paragraphsHtml = opts.paragraphs
    .map((p, i) => {
      const isLast = i === opts.paragraphs.length - 1;
      const marginBottom = isLast && !opts.button && !opts.code ? '0' : isLast ? '0 0 22px' : '0 0 8px';
      return `<p style="margin:${marginBottom};font-size:14px;line-height:1.9;color:#6E565D;">${p}</p>`;
    })
    .join('');

  const buttonHtml = opts.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
  <tr><td style="background:#A1606E;border-radius:999px;">
    <a href="${escapeHtml(opts.button.url)}" style="display:inline-block;padding:14px 32px;font-family:'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:.04em;">${escapeHtml(opts.button.label)}</a>
  </td></tr>
</table>`
    : '';

  const codeHtml = opts.code
    ? `<p style="margin:0 0 22px;padding:16px 20px;background:#F5EDE8;border:1px solid #ECDED7;border-radius:12px;font-family:'Hiragino Mincho ProN','Yu Mincho',serif;font-size:28px;font-weight:600;letter-spacing:.3em;text-align:center;color:#46343A;">${escapeHtml(opts.code)}</p>`
    : '';

  const fallbackHtml = opts.fallbackUrl
    ? `<p style="margin:0 0 6px;font-size:12px;line-height:1.8;color:#9E8A8F;">ボタンが開かない場合は、次のURLをブラウザに貼り付けてください。</p>
<p style="margin:0 0 22px;font-size:12px;line-height:1.7;word-break:break-all;"><a href="${escapeHtml(opts.fallbackUrl)}" style="color:#A1606E;">${escapeHtml(opts.fallbackUrl)}</a></p>`
    : '';

  const noteHtml = opts.note
    ? `<p style="margin:0;padding-top:18px;border-top:1px solid #ECDED7;font-size:12px;line-height:1.8;color:#9E8A8F;">${escapeHtml(opts.note)}</p>`
    : '';

  return `<!doctype html>
<html lang="ja">
  <body style="margin:0;padding:0;background:#EFE3DC;">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFE3DC;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#FBF6F2;border:1px solid #ECDED7;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:22px 28px;border-bottom:1px solid #ECDED7;font-family:'Hiragino Mincho ProN','Yu Mincho',serif;font-size:18px;font-weight:600;letter-spacing:.12em;color:#46343A;">clinic&nbsp;match</td>
            </tr>
            <tr>
              <td style="padding:30px 28px;font-family:'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;color:#46343A;">
                <h1 style="margin:0 0 14px;font-family:'Hiragino Mincho ProN','Yu Mincho',serif;font-size:21px;font-weight:600;line-height:1.5;color:#46343A;">${heading}</h1>
                ${paragraphsHtml}
                ${buttonHtml}
                ${codeHtml}
                ${fallbackHtml}
                ${noteHtml}
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
</html>`;
}
