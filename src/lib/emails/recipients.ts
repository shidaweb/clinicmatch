import type { SupabaseClient } from '@supabase/supabase-js';

export async function getUserEmail(
  admin: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await admin.auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
}

export async function getOrgPrimaryEmail(
  admin: SupabaseClient,
  orgId: string
): Promise<string | null> {
  const { data } = await admin
    .from('profiles')
    .select('id')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return data ? getUserEmail(admin, data.id) : null;
}
