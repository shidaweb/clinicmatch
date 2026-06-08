import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '~/lib/supabase/server';
import { getProfile } from '~/lib/auth';
import { sendAdminEmail, sendUserEmail } from '~/lib/notifications';
import { getSiteUrl } from '~/lib/emails/helpers';
import * as emailTemplates from '~/lib/emails/templates';

export const prerender = false;

const TOPIC_LABELS: Record<string, string> = {
  sell: '売却相談',
  buy: '購入相談',
  other: 'その他',
};

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const body = (await request.json()) as Record<string, unknown>;
  const topic = body.topic as string;

  if (!topic || !['sell', 'buy', 'other'].includes(topic)) {
    return json({ error: '相談種別を選択してください' }, 400);
  }
  if (!body.body || typeof body.body !== 'string' || !body.body.trim()) {
    return json({ error: '相談内容を入力してください' }, 400);
  }

  const admin = createSupabaseAdminClient(locals as never);
  const profile = await getProfile(cookies, locals as never);

  const contactEmail = typeof body.contact_email === 'string' ? body.contact_email.trim() : null;
  const contactName = typeof body.contact_name === 'string' ? body.contact_name : null;
  const contactPhone = typeof body.contact_phone === 'string' ? body.contact_phone : null;

  const { error } = await admin.from('consultations').insert({
    topic,
    contact_name: contactName,
    contact_email: contactEmail,
    contact_phone: contactPhone,
    org_id: profile?.org_id ?? null,
    related_listing_id: typeof body.related_listing_id === 'string' ? body.related_listing_id : null,
    related_wanted_id: typeof body.related_wanted_id === 'string' ? body.related_wanted_id : null,
    body: body.body.trim(),
    channel: 'form',
  });

  if (error) {
    console.error('consultation insert error:', error);
    return json({ error: '送信に失敗しました' }, 500);
  }

  const siteUrl = getSiteUrl(locals as never);

  if (contactEmail) {
    const ack = emailTemplates.consultAck(siteUrl);
    await sendUserEmail(contactEmail, ack.subject, ack.html, locals as never);
  }

  const adminMail = emailTemplates.consultToAdmin({
    topic: TOPIC_LABELS[topic] ?? topic,
    body: body.body.trim(),
    contactName,
    contactEmail,
    contactPhone,
    orgId: profile?.org_id ?? null,
    adminUrl: `${siteUrl}/admin/consultations`,
  });
  await sendAdminEmail(adminMail.subject, adminMail.html, locals as never);

  return json({ success: true });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
