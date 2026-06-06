import { getEnv } from '~/lib/env';

type RuntimeLocals = {
  runtime?: {
    env?: Record<string, string | undefined>;
  };
};

function normalizeApiKey(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export async function sendAdminEmail(
  subject: string,
  html: string,
  locals?: RuntimeLocals
): Promise<boolean> {
  const resendApiKey = normalizeApiKey(
    locals?.runtime?.env?.RESEND_API_KEY ?? import.meta.env.RESEND_API_KEY
  );

  if (!resendApiKey || !resendApiKey.startsWith('re_')) {
    console.warn('[notify] RESEND_API_KEY not configured, skipping email');
    return false;
  }

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
        html,
      }),
    });

    if (!res.ok) {
      console.error('[notify] Resend error:', await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error('[notify] Send error:', e);
    return false;
  }
}

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
