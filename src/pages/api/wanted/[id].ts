import type { APIRoute } from 'astro';
import { getProfile } from '~/lib/auth';
import { createSupabaseAdminClient, createSupabaseServerClient } from '~/lib/supabase/server';
import { notifyWantedSubmission } from '~/lib/emails/notify-submission';

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

  const payload: Record<string, unknown> = {};
  if ('category_slug' in body) payload.category_slug = String(body.category_slug ?? '');
  if ('maker' in body) payload.maker = body.maker ? String(body.maker) : null;
  if ('model' in body) payload.model = body.model ? String(body.model) : null;
  if ('condition_pref' in body) payload.condition_pref = body.condition_pref ? String(body.condition_pref) : null;
  if ('budget' in body) payload.budget = body.budget ? Number(body.budget) : null;
  if ('desired_timing' in body) payload.desired_timing = body.desired_timing ? String(body.desired_timing) : null;
  if ('area_prefecture' in body) {
    payload.area_prefecture = body.area_prefecture ? String(body.area_prefecture) : org?.prefecture;
  }
  if ('area_city' in body) payload.area_city = body.area_city ? String(body.area_city) : org?.city;
  if ('requirements' in body) payload.requirements = body.requirements ? String(body.requirements) : null;
  if (body.submit === true || body.submit === 'true') payload.status = 'pending_review';
  if (Object.keys(payload).length === 0) return json({ error: '更新する項目がありません' }, 400);

  const supabase = createSupabaseServerClient(cookies, locals as never);
  const { data: existing } = await supabase
    .from('wanted_requests')
    .select('id, status, buyer_org_id, maker, model, category_slug')
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

  if (payload.status === 'pending_review' && existing.status !== 'pending_review') {
    const admin = createSupabaseAdminClient(locals as never);
    const categorySlug = String(payload.category_slug ?? existing.category_slug);
    const { data: category } = await admin
      .from('categories')
      .select('name')
      .eq('slug', categorySlug)
      .maybeSingle();
    await notifyWantedSubmission(admin, locals as never, {
      id,
      maker: payload.maker != null ? String(payload.maker) : existing.maker,
      model: payload.model != null ? String(payload.model) : existing.model,
      category: category?.name ?? categorySlug,
      orgId: profile.org_id,
      userId: profile.id,
    });
  }

  return json({ success: true, id });
};
