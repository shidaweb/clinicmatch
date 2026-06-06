import type { APIRoute } from 'astro';
import { getProfile } from '~/lib/auth';
import { createSupabaseServerClient } from '~/lib/supabase/server';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const PATCH: APIRoute = async ({ request, cookies, locals }) => {
  const profile = await getProfile(cookies, locals as never);
  if (!profile) return json({ error: 'ログインが必要です' }, 401);

  const body = (await request.json()) as Record<string, unknown>;
  const supabase = createSupabaseServerClient(cookies, locals as never);

  const orgUpdate: Record<string, string> = {};
  if (body.phone != null) orgUpdate.phone = String(body.phone);
  if (body.contact_email != null) orgUpdate.contact_email = String(body.contact_email);
  if (body.address_detail != null) orgUpdate.address_detail = String(body.address_detail);
  if (body.prefecture != null) orgUpdate.prefecture = String(body.prefecture);
  if (body.city != null) orgUpdate.city = String(body.city);

  if (Object.keys(orgUpdate).length) {
    const { error } = await supabase.from('organizations').update(orgUpdate).eq('id', profile.org_id);
    if (error) return json({ error: error.message }, 400);
  }

  if (body.full_name != null) {
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: String(body.full_name) })
      .eq('id', profile.id);
    if (error) return json({ error: error.message }, 400);
  }

  return json({ success: true });
};
