import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '~/lib/supabase/server';
import { isValidCorporateNumber } from '~/lib/auth';
import { hasSupabaseConfig } from '~/lib/env';
import { verifyCorporateNumber } from '~/lib/hojin-bango';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  if (!hasSupabaseConfig(locals as never)) {
    return json({ error: 'Supabase が未設定です' }, 500);
  }

  const body = (await request.json()) as Record<string, unknown>;
  const email = String(body.email ?? '').trim();
  const password = String(body.password ?? '');
  const corporateNumber = String(body.corporate_number ?? '').trim();
  const name = String(body.name ?? '').trim();
  const prefecture = String(body.prefecture ?? '').trim();
  const city = String(body.city ?? '').trim();
  const fullName = String(body.full_name ?? '').trim();

  if (!email || !password) return json({ error: 'メールとパスワードを入力してください' }, 400);
  if (!isValidCorporateNumber(corporateNumber)) return json({ error: '法人番号は13桁の数字で入力してください' }, 400);
  if (!name || !prefecture || !city) return json({ error: '組織名・都道府県・市区町村を入力してください' }, 400);

  const hojin = await verifyCorporateNumber(corporateNumber, locals as never);
  if (!hojin.verified) return json({ error: hojin.message ?? '法人番号を確認できません' }, 400);

  const admin = createSupabaseAdminClient(locals as never);

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    return json({ error: authError?.message ?? '登録に失敗しました' }, 400);
  }

  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({
      corporate_number: corporateNumber,
      name,
      prefecture,
      city,
      verified_at: hojin.name ? new Date().toISOString() : null,
    })
    .select('id')
    .single();

  if (orgError || !org) {
    await admin.auth.admin.deleteUser(authData.user.id);
    return json({ error: '組織情報の登録に失敗しました' }, 500);
  }

  const { error: profileError } = await admin.from('profiles').insert({
    id: authData.user.id,
    org_id: org.id,
    full_name: fullName || null,
    role: 'member',
  });

  if (profileError) {
    await admin.from('organizations').delete().eq('id', org.id);
    await admin.auth.admin.deleteUser(authData.user.id);
    return json({ error: 'プロフィールの登録に失敗しました' }, 500);
  }

  return json({ success: true });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
