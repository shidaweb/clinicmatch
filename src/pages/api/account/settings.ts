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

export const PATCH: APIRoute = async ({ request, cookies, locals }) => {
  const profile = await getProfile(cookies, locals as never);
  if (!profile) return json({ error: 'ログインが必要です' }, 401);

  const body = (await request.json()) as Record<string, unknown>;
  const supabase = createSupabaseServerClient(cookies, locals as never);

  const orgUpdate: Record<string, string> = {};
  if (body.phone != null) orgUpdate.phone = String(body.phone).trim();
  if (body.contact_email != null) {
    const contactEmail = String(body.contact_email).trim();
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return json({ error: '連絡先メールの形式が正しくありません' }, 400);
    }
    orgUpdate.contact_email = contactEmail;
  }
  if (body.address_detail != null) orgUpdate.address_detail = String(body.address_detail).trim();

  if (Object.keys(orgUpdate).length) {
    const { error } = await supabase.from('organizations').update(orgUpdate).eq('id', profile.org_id);
    if (error) return json({ error: error.message }, 400);
  }

  const profileUpdate: Record<string, string> = {};
  if (body.full_name != null) profileUpdate.full_name = String(body.full_name).trim();
  if (body.display_name != null) {
    const displayName = String(body.display_name).trim();
    if (!displayName) return json({ error: '表示名を入力してください' }, 400);
    profileUpdate.display_name = displayName;
  }
  if (body.avatar_path != null) profileUpdate.avatar_path = String(body.avatar_path).trim();
  if (body.trade_side != null) {
    const tradeSide = String(body.trade_side).trim();
    if (!['sell', 'buy', 'both'].includes(tradeSide)) {
      return json({ error: '取引区分が不正です' }, 400);
    }
    profileUpdate.trade_side = tradeSide;
  }

  if (Object.keys(profileUpdate).length) {
    const { error } = await supabase
      .from('profiles')
      .update(profileUpdate)
      .eq('id', profile.id);
    if (error) return json({ error: error.message }, 400);
  }

  return json({ success: true });
};
