import type { APIRoute } from 'astro';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '~/lib/supabase/server';
import { hasSupabaseConfig } from '~/lib/env';

export const prerender = false;

export const GET: APIRoute = async ({ url, cookies, locals, redirect }) => {
  if (!hasSupabaseConfig(locals as never)) {
    return redirect('/auth/login?error=config');
  }

  const supabase = createSupabaseServerClient(cookies, locals as never);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return redirect('/auth/login?error=confirm');
    return redirect('/auth/login?confirmed=1');
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return redirect('/auth/login?error=confirm');
    return redirect('/auth/login?confirmed=1');
  }

  return redirect('/auth/login?error=confirm');
};
