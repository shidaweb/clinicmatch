import type { APIRoute } from 'astro';
import { getProfile } from '~/lib/auth';
import { createSupabaseServerClient } from '~/lib/supabase/server';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const PATCH: APIRoute = async ({ params, request, cookies, locals }) => {
  const profile = await getProfile(cookies, locals as never);
  if (!profile) return json({ error: 'ログインが必要です' }, 401);

  const id = params.id;
  if (!id) return json({ error: 'IDが必要です' }, 400);

  const body = (await request.json()) as Record<string, unknown>;
  const org = profile.organizations as { prefecture?: string; city?: string } | null;

  const payload = {
    category_slug: String(body.category_slug ?? ''),
    maker: body.maker ? String(body.maker) : null,
    model: body.model ? String(body.model) : null,
    condition_pref: body.condition_pref ? String(body.condition_pref) : null,
    budget: body.budget ? Number(body.budget) : null,
    desired_timing: body.desired_timing ? String(body.desired_timing) : null,
    area_prefecture: body.area_prefecture ? String(body.area_prefecture) : org?.prefecture,
    area_city: body.area_city ? String(body.area_city) : org?.city,
    requirements: body.requirements ? String(body.requirements) : null,
    ...(body.submit === true || body.submit === 'true' ? { status: 'pending_review' as const } : {}),
  };

  const supabase = createSupabaseServerClient(cookies, locals as never);
  const { data: existing } = await supabase
    .from('wanted_requests')
    .select('id, status, buyer_org_id')
    .eq('id', id)
    .single();

  if (!existing || existing.buyer_org_id !== profile.org_id) {
    return json({ error: '買いたいが見つかりません' }, 404);
  }
  if (existing.status === 'published') {
    return json({ error: '公開中の買いたいは編集できません。運営にお問い合わせください。' }, 400);
  }

  const { error } = await supabase.from('wanted_requests').update(payload).eq('id', id);
  if (error) return json({ error: error.message }, 400);

  return json({ success: true, id });
};
