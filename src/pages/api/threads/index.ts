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

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const profile = await getProfile(cookies, locals as never);
  if (!profile) return json({ error: 'ログインが必要です' }, 401);

  const body = (await request.json()) as Record<string, unknown>;
  const listingId = body.listing_id ? String(body.listing_id) : '';
  const wantedId = body.wanted_request_id ? String(body.wanted_request_id) : '';
  const message = String(body.message ?? '').trim();
  if (!message) return json({ error: 'メッセージは必須です' }, 400);
  if (!listingId && !wantedId) return json({ error: '対象が指定されていません' }, 400);
  if (listingId && wantedId) {
    return json({ error: '対象は出品か買いたいのどちらか1つだけ指定してください' }, 400);
  }

  const subjectType: 'listing' | 'wanted' = listingId ? 'listing' : 'wanted';

  const supabase = createSupabaseServerClient(cookies, locals as never);
  let buyerOrgId = '';
  let sellerOrgId = '';
  let counterpartOrgId = '';
  let subjectTitle = '投稿';
  let subjectId = '';
  let senderType: 'buyer' | 'seller' = 'buyer';

  if (subjectType === 'listing') {
    const { data: listing } = await supabase
      .from('listings')
      .select('id, seller_org_id, status, maker, model')
      .eq('id', listingId)
      .eq('status', 'published')
      .single();

    if (!listing) return json({ error: '出品が見つかりません' }, 404);
    if (listing.seller_org_id === profile.org_id) {
      return json({ error: '自分の出品にはコメントできません' }, 400);
    }
    buyerOrgId = profile.org_id;
    sellerOrgId = listing.seller_org_id;
    counterpartOrgId = listing.seller_org_id;
    senderType = 'buyer';
    subjectId = listing.id;
    subjectTitle = formatListingTitle(listing.maker, listing.model);
  } else {
    const { data: wanted } = await supabase
      .from('wanted_requests')
      .select('id, buyer_org_id, status, maker, model, categories(name)')
      .eq('id', wantedId)
      .eq('status', 'published')
      .single();

    if (!wanted) return json({ error: '買いたいリクエストが見つかりません' }, 404);
    if (wanted.buyer_org_id === profile.org_id) {
      return json({ error: '自分の買いたいにはコメントできません' }, 400);
    }
    buyerOrgId = wanted.buyer_org_id;
    sellerOrgId = profile.org_id;
    counterpartOrgId = wanted.buyer_org_id;
    senderType = 'seller';
    subjectId = wanted.id;
    subjectTitle =
      wanted.maker && wanted.model
        ? formatListingTitle(wanted.maker, wanted.model)
        : (wanted.categories as { name?: string } | null)?.name ?? '買いたい投稿';
  }

  const existingQuery = supabase
    .from('threads')
    .select('id')
    .eq('subject_type', subjectType)
    .eq('buyer_org_id', buyerOrgId)
    .eq('seller_org_id', sellerOrgId)
    .eq('kind', 'qa')
    .limit(1);
  const { data: existing } =
    subjectType === 'listing'
      ? await existingQuery.eq('listing_id', listingId).maybeSingle()
      : await existingQuery.eq('wanted_request_id', wantedId).maybeSingle();

  let threadId = existing?.id ?? null;
  let isNewThread = false;
  if (!threadId) {
    const { data: created, error: threadError } = await supabase
      .from('threads')
      .insert({
        subject_type: subjectType,
        listing_id: listingId || null,
        wanted_request_id: wantedId || null,
        buyer_org_id: buyerOrgId,
        seller_org_id: sellerOrgId,
        kind: 'qa',
        status: 'open',
      })
      .select('id')
      .single();
    if (threadError || !created) {
      return json({ error: threadError?.message ?? 'コメントの開始に失敗しました' }, 400);
    }
    threadId = created.id;
    isNewThread = true;
  }

  const { error: msgError } = await supabase.from('messages').insert({
    thread_id: threadId,
    sender_type: senderType,
    sender_user_id: profile.id,
    body: message,
    visible_to: 'all',
  });

  if (msgError) return json({ error: msgError.message }, 400);

  await notifyComment({
    locals,
    profile: { id: profile.id, org_id: profile.org_id },
    threadId,
    isNewThread,
    subjectType,
    counterpartOrgId,
    subjectId,
    subjectTitle,
    message,
  });

  return json({ success: true, thread_id: threadId, is_new: isNewThread });
};

async function notifyComment(params: {
  locals: unknown;
  profile: { id: string; org_id: string };
  threadId: string;
  isNewThread: boolean;
  subjectType: 'listing' | 'wanted';
  counterpartOrgId: string;
  subjectId: string;
  subjectTitle: string;
  message: string;
}) {
  const admin = createSupabaseAdminClient(params.locals as never);
  const siteUrl = getSiteUrl(params.locals as never);
  const threadUrl = `${siteUrl}/account/threads/${params.threadId}`;
  const preview =
    params.message.length > 120 ? `${params.message.slice(0, 120)}…` : params.message;

  const ownerEmail = await getOrgPrimaryEmail(admin, params.counterpartOrgId);
  if (ownerEmail) {
    const ownerTemplate = params.isNewThread
      ? emailTemplates.commentToOwner(siteUrl, {
          subjectTitle: params.subjectTitle,
          threadUrl,
        })
      : emailTemplates.newMessageToUser(siteUrl, { threadId: params.threadId });
    await sendUserEmail(ownerEmail, ownerTemplate.subject, ownerTemplate.html, params.locals as never);
  }

  if (params.isNewThread) {
    const actorEmail = await getUserEmail(admin, params.profile.id);
    if (actorEmail) {
      const ack = emailTemplates.commentAck(siteUrl, {
        subjectTitle: params.subjectTitle,
        threadUrl,
      });
      await sendUserEmail(actorEmail, ack.subject, ack.html, params.locals as never);
    }
  }

  const toAdmin = emailTemplates.commentToAdmin({
    threadId: params.threadId,
    subjectType: params.subjectType,
    subjectId: params.subjectId,
    subjectTitle: params.subjectTitle,
    preview,
    adminUrl: `${siteUrl}/admin/threads/${params.threadId}`,
  });
  await sendAdminEmail(toAdmin.subject, toAdmin.html, params.locals as never);
}
