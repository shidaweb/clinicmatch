import { getEnv } from '~/lib/env';

export { escapeHtml } from '~/lib/emails/layout';

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

function getResendApiKey(locals?: RuntimeLocals): string {
  return normalizeApiKey(locals?.runtime?.env?.RESEND_API_KEY ?? import.meta.env.RESEND_API_KEY);
}

function getMailFrom(locals?: RuntimeLocals): string {
  return getEnv('MAIL_FROM', locals) || 'クリニックマッチ <noreply@clinicmatch.org>';
}

export function getAdminEmails(locals?: RuntimeLocals): string[] {
  const raw = getEnv('ADMIN_NOTIFY_EMAILS', locals);
  if (raw) {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return ['master@jugyoin.jp', 'general-aaaarfzhzdv7fph2uqij5m6si4@kiruck.slack.com'];
}

export async function sendEmail(
  to: string[],
  subject: string,
  html: string,
  locals?: RuntimeLocals
): Promise<boolean> {
  const recipients = to.filter(Boolean);
  if (recipients.length === 0) return false;

  const resendApiKey = getResendApiKey(locals);
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
        from: getMailFrom(locals),
        to: recipients,
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

export async function sendAdminEmail(
  subject: string,
  html: string,
  locals?: RuntimeLocals
): Promise<boolean> {
  return sendEmail(getAdminEmails(locals), subject, html, locals);
}

export async function sendUserEmail(
  to: string,
  subject: string,
  html: string,
  locals?: RuntimeLocals
): Promise<boolean> {
  if (!to) return false;
  return sendEmail([to], subject, html, locals);
}
