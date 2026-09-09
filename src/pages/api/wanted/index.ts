import type { APIRoute } from 'astro';
import { readObject } from '~/lib/http';
import { createPostOnce } from '~/lib/post-creation';
import { createSupabaseAdminClient } from '~/lib/supabase/server';
import { getProfile } from '~/lib/auth';
import { notifyWantedSubmission } from '~/lib/emails/notify-submission';
import { parseListingKind } from '~/lib/consumables';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const profile = await getProfile(cookies, locals as never);
  if (!profile) return json({ error: 'ログインが必要です' }, 401);

  const body = await readObject(request);
  if (!body) return json({ error: '入力内容の形式が不正です' }, 400);
  for (const key of ['asking_price', 'budget', 'quantity', 'manufacture_year', 'min_remaining_shots']) {
    const value = body[key];
    if (
      value != null &&
      value !== '' &&
      (!Number.isFinite(Number(value)) || Number(value) < 0 || !Number.isInteger(Number(value)))
    ) {
      return json({ error: '価格・予算・数量は0以上の整数で入力してください' }, 400);
    }
  }

  const org = profile.organizations as { prefecture?: string; city?: string } | null;
  const listingKindPref = parseListingKind(body.listing_kind_pref);
  const onlyUnexpired = body.only_unexpired === true || body.only_unexpired === 'true';
  const minRemainingShots =
    body.min_remaining_shots === '' || body.min_remaining_shots == null ? null : Number(body.min_remaining_shots);
  const openStatePref = body.open_state_pref ? String(body.open_state_pref) : null;

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
    listing_kind_pref: listingKindPref,
    consumable_master_id: body.consumable_master_id ? String(body.consumable_master_id) : null,
    only_unexpired: onlyUnexpired,
    min_remaining_shots: minRemainingShots,
    open_state_pref: openStatePref,
    status: body.submit === true || body.submit === 'true' ? 'pending_review' : 'draft',
  };

  if (!payload.category_slug) return json({ error: 'カテゴリは必須です' }, 400);
  if (payload.listing_kind_pref !== 'device' && !payload.consumable_master_id) {
    return json({ error: '消耗品を希望する場合は品目を選択してください' }, 400);
  }
  if (
    payload.min_remaining_shots != null &&
    (!Number.isFinite(payload.min_remaining_shots) || payload.min_remaining_shots < 0)
  ) {
    return json({ error: '最低残ショット数は0以上で入力してください' }, 400);
  }
  if (
    payload.open_state_pref &&
    !['sealed_only', 'opened_allowed', 'used_allowed'].includes(String(payload.open_state_pref))
  ) {
    return json({ error: '開封状態の希望が不正です' }, 400);
  }

  const admin = createSupabaseAdminClient(locals as never);
  const created = await createPostOnce(admin, request, 'wanted_requests', profile.id, payload);
  if (created.response) return created.response;
  const data = { id: created.id! };

  if (payload.status === 'pending_review' && !created.duplicate) {
    const admin = createSupabaseAdminClient(locals as never);
    const { data: category } = await admin
      .from('categories')
      .select('name')
      .eq('slug', payload.category_slug)
      .maybeSingle();
    await notifyWantedSubmission(admin, locals as never, {
      id: data.id,
      maker: payload.maker,
      model: payload.model,
      category: category?.name ?? payload.category_slug,
      orgId: profile.org_id,
      userId: profile.id,
    });
  }

  return json({ success: true, id: data.id });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
