import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '~/lib/supabase/server';
import { hasSupabaseConfig } from '~/lib/env';

export const prerender = false;

export const POST: APIRoute = async ({ cookies, locals, redirect }) => {
  if (hasSupabaseConfig(locals as never)) {
    const supabase = createSupabaseServerClient(cookies, locals as never);
    await supabase.auth.signOut();
  }
  return redirect('/?logged_out=1', 303);
};
