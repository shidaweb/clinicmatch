import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '~/lib/supabase/server';
import { getProfile } from '~/lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const profile = await getProfile(cookies, locals as never);
  if (!profile) return json({ error: 'ログインが必要です' }, 401);

  const body = (await request.json()) as Record<string, unknown>;
  const supabase = createSupabaseServerClient(cookies, locals as never);

  const org = profile.organizations as { prefecture?: string; city?: string } | null;

  const payload = {
    buyer_org_id: profile.org_id,
    buyer_user_id: profile.id,
    category_slug: String(body.category_slug ?? ''),
    maker: body.maker ? String(body.maker) : null,
    model: body.model ? String(body.model) : null,
    condition_pref: body.condition_pref ? String(body.condition_pref) : null,
    budget: body.budget ? Number(body.budget) : null,
    desired_timing: body.desired_timing ? String(body.desired_timing) : null,
    area_prefecture: body.area_prefecture ? String(body.area_prefecture) : org?.prefecture,
    area_city: body.area_city ? String(body.area_city) : org?.city,
    requirements: body.requirements ? String(body.requirements) : null,
    status: body.submit === true || body.submit === 'true' ? 'pending_review' : 'draft',
  };

  if (!payload.category_slug) return json({ error: 'カテゴリは必須です' }, 400);

  const { data, error } = await supabase.from('wanted_requests').insert(payload).select('id').single();
  if (error) return json({ error: error.message }, 400);

  return json({ success: true, id: data.id });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
