import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '~/lib/supabase/server';
import { mapAuthResendError } from '~/lib/auth';
import { getEmailConfirmRedirectUrl } from '~/lib/auth-url';
import { hasSupabaseConfig } from '~/lib/env';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  if (!hasSupabaseConfig(locals as never)) {
    return json({ error: 'Supabase が未設定です' }, 500);
  }

  const body = (await request.json()) as Record<string, unknown>;
  const email = String(body.email ?? '').trim();
  if (!email) return json({ error: 'メールアドレスを入力してください' }, 400);

  const supabase = createSupabaseServerClient(cookies, locals as never);
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: getEmailConfirmRedirectUrl(request) },
  });

  if (error) {
    const message = mapAuthResendError(error);
    const alreadyConfirmed = message.includes('既に確認済み');
    return json(
      { error: message, code: alreadyConfirmed ? 'already_confirmed' : 'resend_failed' },
      400
    );
  }

  return json({
    success: true,
    message: '確認メールを再送しました。受信トレイ（迷惑メールフォルダも）をご確認ください。',
  });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
