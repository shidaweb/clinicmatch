import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '~/lib/supabase/server';
import { getProfile } from '~/lib/auth';
import { notifyPostPublished } from '~/lib/emails/notify-submission';
import { formatListingTitle, formatWantedTitle } from '~/lib/emails/helpers';

export const prerender = false;

export const POST: APIRoute = async ({ params, cookies, locals }) => {
  const profile = await getProfile(cookies, locals as never);
  if (!profile || profile.role !== 'admin') return json({ error: '権限がありません' }, 403);

  const { type, id } = params as { type?: string; id?: string };
  if (!type || !id || !['listings', 'wanted'].includes(type)) {
    return json({ error: '不正なリクエストです' }, 400);
  }

  const admin = createSupabaseAdminClient(locals as never);

  if (type === 'listings') {
    const { data: listing } = await admin
      .from('listings')
      .select('id, maker, model, seller_org_id')
      .eq('id', id)
      .single();

    const { error } = await admin
      .from('listings')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return json({ error: error.message }, 400);

    if (listing) {
      await notifyPostPublished(admin, locals as never, {
        type: 'listing',
        id,
        title: formatListingTitle(listing.maker, listing.model),
        orgId: listing.seller_org_id,
      });
    }
  } else {
    const { data: wanted } = await admin
      .from('wanted_requests')
      .select('id, maker, model, category_slug, buyer_org_id, categories(name)')
      .eq('id', id)
      .single();

    const { error } = await admin
      .from('wanted_requests')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return json({ error: error.message }, 400);

    if (wanted) {
      const category =
        (wanted.categories as { name?: string } | null)?.name ?? wanted.category_slug;
      await notifyPostPublished(admin, locals as never, {
        type: 'wanted',
        id,
        title: formatWantedTitle(wanted.maker, wanted.model, category),
        orgId: wanted.buyer_org_id,
      });
    }
  }

  return json({ success: true });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
