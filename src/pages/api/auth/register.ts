import type { APIRoute } from 'astro';
import { createSupabaseAdminClient, createSupabaseServerClient } from '~/lib/supabase/server';
import {
  isValidCorporateNumberFormat,
  isValidPassword,
  normalizeCorporateNumber,
  PASSWORD_RULES_MESSAGE,
} from '~/lib/auth';
import { getEmailConfirmRedirectUrl } from '~/lib/auth-url';
import { hasSupabaseConfig } from '~/lib/env';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  if (!hasSupabaseConfig(locals as never)) {
    return json({ error: 'Supabase が未設定です' }, 500);
  }

  const body = (await request.json()) as Record<string, unknown>;
  const email = String(body.email ?? '').trim();
  const password = String(body.password ?? '');
  const corporateNumber = normalizeCorporateNumber(String(body.corporate_number ?? ''));
  const name = String(body.name ?? '').trim();
  const prefecture = String(body.prefecture ?? '').trim();
  const city = String(body.city ?? '').trim();
  const fullName = String(body.full_name ?? '').trim();

  if (!email || !password) return json({ error: 'メールとパスワードを入力してください' }, 400);
  if (!isValidPassword(password)) return json({ error: PASSWORD_RULES_MESSAGE }, 400);
  if (!isValidCorporateNumberFormat(corporateNumber)) {
    return json({ error: '法人番号は13桁の数字で入力してください' }, 400);
  }
  if (!name || !prefecture || !city) return json({ error: '組織名・都道府県・市区町村を入力してください' }, 400);

  const supabase = createSupabaseServerClient(cookies, locals as never);
  const admin = createSupabaseAdminClient(locals as never);

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getEmailConfirmRedirectUrl(request),
    },
  });

  if (authError || !authData.user) {
    return json({ error: authError?.message ?? '登録に失敗しました' }, 400);
  }

  const userId = authData.user.id;

  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({
      corporate_number: corporateNumber,
      name,
      prefecture,
      city,
      verified_at: null,
    })
    .select('id')
    .single();

  if (orgError || !org) {
    await admin.auth.admin.deleteUser(userId);
    return json({ error: '組織情報の登録に失敗しました' }, 500);
  }

  const { error: profileError } = await admin.from('profiles').insert({
    id: userId,
    org_id: org.id,
    full_name: fullName || null,
    role: 'member',
  });

  if (profileError) {
    await admin.from('organizations').delete().eq('id', org.id);
    await admin.auth.admin.deleteUser(userId);
    return json({ error: 'プロフィールの登録に失敗しました' }, 500);
  }

  const confirmationRequired = !authData.session;

  return json({
    success: true,
    confirmationRequired,
    message: confirmationRequired
      ? '確認メールを送信しました。メール内のリンクをクリックして登録を完了してください。'
      : '登録が完了しました。ログインしてください。',
  });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
