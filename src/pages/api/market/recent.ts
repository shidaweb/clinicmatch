import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '~/lib/supabase/server';
import { PUBLIC_LISTING_SELECT, PUBLIC_WANTED_SELECT } from '~/lib/marketplace';
import { hasSupabaseConfig } from '~/lib/env';

export const prerender = false;

export const GET: APIRoute = async ({ cookies, locals }) => {
  if (!hasSupabaseConfig(locals as never)) {
    return json({ listings: [], wanted: [] });
  }

  const supabase = createSupabaseServerClient(cookies, locals as never);

  const [{ data: listings }, { data: wanted }] = await Promise.all([
    supabase
      .from('listings')
      .select(PUBLIC_LISTING_SELECT)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(8),
    supabase
      .from('wanted_requests')
      .select(PUBLIC_WANTED_SELECT)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(8),
  ]);

  return json({ listings: listings ?? [], wanted: wanted ?? [] });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
