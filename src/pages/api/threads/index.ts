import type { APIRoute } from 'astro';
import { getProfile } from '~/lib/auth';
import { createSupabaseAdminClient, createSupabaseServerClient } from '~/lib/supabase/server';
import { sendAdminEmail, sendUserEmail } from '~/lib/notifications';
import { getUserEmail, getOrgPrimaryEmail } from '~/lib/emails/recipients';
import { getSiteUrl, formatListingTitle } from '~/lib/emails/helpers';
import * as emailTemplates from '~/lib/emails/templates';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Create Q&A thread from listing (buyer asks about maintenance/accessories) */
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const profile = await getProfile(cookies, locals as never);
  if (!profile) return json({ error: 'ログインが必要です' }, 401);

  const body = (await request.json()) as Record<string, unknown>;
  const listingId = String(body.listing_id ?? '');
  const message = String(body.message ?? '').trim();

  if (!listingId || !message) return json({ error: '出品IDとメッセージは必須です' }, 400);

  const supabase = createSupabaseServerClient(cookies, locals as never);

  const { data: listing } = await supabase
    .from('listings')
    .select('id, seller_org_id, status, maker, model, category_slug, categories(name)')
    .eq('id', listingId)
    .eq('status', 'published')
    .single();

  if (!listing) return json({ error: '出品が見つかりません' }, 404);
  if (listing.seller_org_id === profile.org_id) {
    return json({ error: '自分の出品にはQ&Aできません' }, 400);
  }

  const { data: thread, error: threadError } = await supabase
    .from('threads')
    .insert({
      subject_type: 'listing',
      listing_id: listingId,
      buyer_org_id: profile.org_id,
      seller_org_id: listing.seller_org_id,
      kind: 'qa',
      status: 'open',
    })
    .select('id')
    .single();

  if (threadError || !thread) return json({ error: threadError?.message ?? 'スレッド作成に失敗しました' }, 400);

  const { error: msgError } = await supabase.from('messages').insert({
    thread_id: thread.id,
    sender_type: 'buyer',
    sender_user_id: profile.id,
    body: message,
    visible_to: 'all',
  });

  if (msgError) return json({ error: msgError.message }, 400);

  const admin = createSupabaseAdminClient(locals as never);
  const siteUrl = getSiteUrl(locals as never);
  const title = formatListingTitle(listing.maker, listing.model);
  const category =
    (listing.categories as { name?: string } | null)?.name ?? listing.category_slug;

  const buyerEmail = await getUserEmail(admin, profile.id);
  if (buyerEmail) {
    const t = emailTemplates.qaThreadToBuyer(siteUrl, { listingTitle: title });
    await sendUserEmail(buyerEmail, t.subject, t.html, locals as never);
  }

  const sellerEmail = await getOrgPrimaryEmail(admin, listing.seller_org_id);
  if (sellerEmail) {
    const t = emailTemplates.qaThreadToSeller(siteUrl, { listingTitle: title, category });
    await sendUserEmail(sellerEmail, t.subject, t.html, locals as never);
  }

  const a = emailTemplates.qaThreadToAdmin({
    threadId: thread.id,
    listingId,
    listingTitle: title,
    message,
    adminUrl: `${siteUrl}/admin/threads/${thread.id}`,
  });
  await sendAdminEmail(a.subject, a.html, locals as never);

  return json({ success: true, thread_id: thread.id });
};
