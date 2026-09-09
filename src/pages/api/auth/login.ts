import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '~/lib/supabase/server';
import { mapAuthLoginError } from '~/lib/auth';
import { hasSupabaseConfig } from '~/lib/env';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  if (!hasSupabaseConfig(locals as never)) {
    return json({ error: 'Supabase が未設定です' }, 500);
  }

  const body = (await request.json()) as Record<string, unknown>;
  const email = String(body.email ?? '').trim();
  const password = String(body.password ?? '');

  if (!email && !password) {
    return json({ error: 'メールアドレスとパスワードを入力してください', code: 'missing_fields' }, 400);
  }
  if (!email) {
    return json({ error: 'メールアドレスを入力してください', code: 'missing_email' }, 400);
  }
  if (!password) {
    return json({ error: 'パスワードを入力してください', code: 'missing_password' }, 400);
  }

  const supabase = createSupabaseServerClient(cookies, locals as never);
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const mapped = mapAuthLoginError(error);
    return json({ error: mapped.message, code: mapped.code }, 401);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: member, error: memberError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user!.id)
    .maybeSingle();
  if (memberError) return json({ error: '会員情報を確認できませんでした' }, 503);
  return json({ success: true, onboardingRequired: !member });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
