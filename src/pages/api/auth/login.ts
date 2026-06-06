import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '~/lib/supabase/server';
import { hasSupabaseConfig } from '~/lib/env';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  if (!hasSupabaseConfig(locals as never)) {
    return json({ error: 'Supabase が未設定です' }, 500);
  }

  const body = (await request.json()) as Record<string, unknown>;
  const email = String(body.email ?? '').trim();
  const password = String(body.password ?? '');

  if (!email || !password) return json({ error: 'メールとパスワードを入力してください' }, 400);

  const supabase = createSupabaseServerClient(cookies, locals as never);
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return json({ error: error.message }, 401);

  return json({ success: true });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
