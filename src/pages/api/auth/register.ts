import type { APIRoute } from 'astro';
import { createSupabaseAdminClient, createSupabaseServerClient } from '~/lib/supabase/server';
import { mapAuthRegisterError, normalizeCorporateNumber, validateRegisterPayload } from '~/lib/auth';
import { getEmailConfirmRedirectUrl } from '~/lib/auth-url';
import { readObject, isEmail } from '~/lib/http';
import { hasSupabaseConfig } from '~/lib/env';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  if (!hasSupabaseConfig(locals as never)) {
    return json({ error: 'Supabase が未設定です' }, 500);
  }

  const body = await readObject(request);
  if (!body) return json({ error: '入力内容が不正です' }, 400);
  const supabase = createSupabaseServerClient(cookies, locals as never);
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  const resuming =
    currentUser?.email?.toLowerCase() ===
    String(body.email ?? '')
      .trim()
      .toLowerCase();
  const validationError = validateRegisterPayload(resuming ? { ...body, password: 'ResumeOnly1' } : body);
  if (validationError) return json({ error: validationError }, 400);

  const email = String(body.email ?? '').trim();
  const password = String(body.password ?? '');
  const corporateNumber = normalizeCorporateNumber(String(body.corporate_number ?? ''));
  const name = String(body.name ?? '').trim();
  const prefecture = String(body.prefecture ?? '').trim();
  const city = String(body.city ?? '').trim();
  const fullName = String(body.full_name ?? '').trim();
  const displayName = String(body.display_name ?? '').trim();
  const tradeSide = String(body.trade_side ?? 'both').trim();

  const admin = createSupabaseAdminClient(locals as never);

  // A signed-in member can resume incomplete onboarding without changing Auth credentials.
  const result =
    currentUser?.email?.toLowerCase() === email.toLowerCase()
      ? { data: { user: currentUser, session: true }, error: null }
      : await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: getEmailConfirmRedirectUrl(request) },
        });
  const { data: authData, error: authError } = result;
  if (authError || !authData.user) {
    return json({ error: authError ? mapAuthRegisterError(authError) : '登録に失敗しました' }, 400);
  }
  // Supabase may return an obfuscated user for an already registered address.
  if (currentUser?.id !== authData.user.id && authData.user.identities?.length === 0) {
    return json({ error: '登録済みの場合はログインしてください。確認メールもご確認ください。' }, 409);
  }
  if (!authData.user.email || !isEmail(email)) return json({ error: 'メールアドレスを確認してください' }, 400);
  const { error: memberError } = await admin.rpc('register_member', {
    p_user: authData.user.id,
    p_data: {
      corporate_number: corporateNumber,
      name,
      prefecture,
      city,
      full_name: fullName,
      display_name: displayName,
      trade_side: tradeSide,
      email: authData.user.email,
    },
  });
  if (memberError) {
    console.error('[register] profile setup failed; Auth user retained', memberError.code);
    return json(
      {
        error:
          '会員情報を保存できませんでした。アカウントは削除されていません。確認メールで認証後、ログインして登録を再開してください。',
      },
      503
    );
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
