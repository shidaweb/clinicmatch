import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '~/lib/supabase/server';
import { getProfile } from '~/lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ params, cookies, locals }) => {
  const profile = await getProfile(cookies, locals as never);
  if (!profile || profile.role !== 'admin') return json({ error: '権限がありません' }, 403);

  const { type, id } = params as { type?: string; id?: string };
  if (!type || !id || !['listings', 'wanted'].includes(type)) {
    return json({ error: '不正なリクエストです' }, 400);
  }

  const table = type === 'listings' ? 'listings' : 'wanted_requests';
  const admin = createSupabaseAdminClient(locals as never);

  const { error } = await admin
    .from(table)
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return json({ error: error.message }, 400);
  return json({ success: true });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
