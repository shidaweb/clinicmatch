import { createClient } from '@supabase/supabase-js';
import { getEnv } from '~/lib/env';

export function createSupabaseBrowserClient() {
  return createClient(getEnv('PUBLIC_SUPABASE_URL'), getEnv('PUBLIC_SUPABASE_ANON_KEY'));
}
