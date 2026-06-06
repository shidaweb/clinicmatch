import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { AstroCookies } from 'astro';
import { getEnv } from '~/lib/env';

type RuntimeLocals = {
  runtime?: {
    env?: Record<string, string | undefined>;
  };
};

export function createSupabaseServerClient(cookies: AstroCookies, locals?: RuntimeLocals) {
  const supabaseUrl = getEnv('PUBLIC_SUPABASE_URL', locals);
  const supabaseAnonKey = getEnv('PUBLIC_SUPABASE_ANON_KEY', locals);

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(key: string) {
        return cookies.get(key)?.value;
      },
      set(key: string, value: string, options: CookieOptions) {
        cookies.set(key, value, options);
      },
      remove(key: string, options: CookieOptions) {
        cookies.delete(key, options);
      },
    },
  });
}

export function createSupabaseAdminClient(locals?: RuntimeLocals) {
  const supabaseUrl = getEnv('PUBLIC_SUPABASE_URL', locals);
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY', locals);

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
