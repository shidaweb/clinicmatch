import type { APIRoute } from 'astro';

// API ルートはサーバーのみ（prerender しない）
export const prerender = false;

function formatValue(value: unknown): string {
  if (value == null) return '（未入力）';
  if (Array.isArray(value)) return value.length ? value.join('、') : '（未選択）';
  return String(value);
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const POST: APIRoute = async ({ request, locals }) => {
  const data = (await request.json()) as Record<string, unknown>;

  // Cloudflare adapter の場合は runtime.env、それ以外は import.meta.env
  const resendApiKey =
    (locals as { runtime?: { env?: { RESEND_API_KEY?: string } } }).runtime?.env?.RESEND_API_KEY ??
    import.meta.env.RESEND_API_KEY;

  if (!resendApiKey) {
    console.error('RESEND_API_KEY is not set');
    return new Response(JSON.stringify({ success: false, error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const formType = data.formType === 'sell' ? '売却希望' : '購入希望';
  const subject = `【クリニックマッチ】${formType}のお問い合わせ`;

  const htmlContent = Object.entries(data)
    .filter(([key]) => key !== 'formType')
    .map(([key, value]) => `<p><strong>${escapeHtml(key)}:</strong> ${escapeHtml(formatValue(value))}</p>`)
    .join('');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'クリニックマッチ <noreply@clinicmatch.org>',
        to: ['master@jugyoin.jp', 'general-aaaarfzhzdv7fph2uqij5m6si4@kiruck.slack.com'],
        subject,
        html: `<h2>${subject}</h2>${htmlContent}`,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error('Resend error:', error);
      return new Response(JSON.stringify({ success: false, error }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Send error:', e);
    return new Response(JSON.stringify({ success: false }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
