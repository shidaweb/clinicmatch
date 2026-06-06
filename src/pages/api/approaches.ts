import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '~/lib/supabase/server';
import { getProfile } from '~/lib/auth';
import { sendAdminEmail, escapeHtml } from '~/lib/notifications';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const profile = await getProfile(cookies, locals as never);
  if (!profile) return json({ error: 'ログインが必要です' }, 401);

  const body = (await request.json()) as Record<string, unknown>;
  const kind = body.kind as string;

  if (!['interest', 'offer'].includes(kind)) {
    return json({ error: '不正なアプローチ種別です' }, 400);
  }

  const supabase = createSupabaseServerClient(cookies, locals as never);

  const payload = {
    kind,
    listing_id: kind === 'interest' ? String(body.listing_id ?? '') : null,
    wanted_request_id: kind === 'offer' ? String(body.wanted_request_id ?? '') : null,
    from_org_id: profile.org_id,
    from_user_id: profile.id,
    budget: body.budget ? Number(body.budget) : null,
    price: body.price ? Number(body.price) : null,
    message: body.message ? String(body.message) : null,
    status: 'new',
  };

  if (kind === 'interest' && !payload.listing_id) return json({ error: '出品IDが必要です' }, 400);
  if (kind === 'offer' && !payload.wanted_request_id) return json({ error: '買いたいIDが必要です' }, 400);

  const { data, error } = await supabase.from('approaches').insert(payload).select('id').single();
  if (error) return json({ error: error.message }, 400);

  await sendAdminEmail(
    `【クリニックマッチ】新規アプローチ（${kind === 'interest' ? '関心' : '提案'}）`,
    `<p>ID: ${escapeHtml(data.id)}</p><p>${escapeHtml(String(payload.message ?? ''))}</p>`,
    locals as never
  );

  return json({ success: true, id: data.id });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
