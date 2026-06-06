import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '~/lib/supabase/server';
import { getProfile } from '~/lib/auth';

export const prerender = false;

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

  const { error } = await admin.from('consultations').insert({
    topic,
    contact_name: typeof body.contact_name === 'string' ? body.contact_name : null,
    contact_email: typeof body.contact_email === 'string' ? body.contact_email : null,
    contact_phone: typeof body.contact_phone === 'string' ? body.contact_phone : null,
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

  return json({ success: true });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
