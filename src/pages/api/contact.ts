import type { APIRoute } from 'astro';
import { sendAdminEmail } from '~/lib/notifications';
import * as emailTemplates from '~/lib/emails/templates';

export const prerender = false;

function formatValue(value: unknown): string {
  if (value == null) return '（未入力）';
  if (Array.isArray(value)) return value.length ? value.join('、') : '（未選択）';
  return String(value);
}

const FIELD_LABELS: Record<string, string> = {
  name: 'お名前',
  email: 'メール',
  phone: '電話',
  company: '会社名',
  message: '内容',
  category: 'カテゴリ',
  budget: '予算',
  timing: '希望時期',
};

export const POST: APIRoute = async ({ request, locals }) => {
  const data = (await request.json()) as Record<string, unknown>;
  const formType = data.formType === 'sell' ? '売却希望' : '購入希望';

  const fields = Object.entries(data)
    .filter(([key]) => key !== 'formType')
    .map(([key, value]) => ({
      label: FIELD_LABELS[key] ?? key,
      value: formatValue(value),
    }));

  const mail = emailTemplates.contactToAdmin({ formType, fields });
  const sent = await sendAdminEmail(mail.subject, mail.html, locals as never);

  if (!sent) {
    return new Response(JSON.stringify({ success: false, error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
