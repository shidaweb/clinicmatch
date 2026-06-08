import type { APIRoute } from 'astro';
import { requireAdmin } from '~/lib/auth';
import { createSupabaseAdminClient } from '~/lib/supabase/server';
import { sendAdminEmail, sendUserEmail } from '~/lib/notifications';
import { getOrgPrimaryEmail } from '~/lib/emails/recipients';
import { getSiteUrl } from '~/lib/emails/helpers';
import * as emailTemplates from '~/lib/emails/templates';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Start mediation thread from an approach */
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const { profile, error: authError } = await requireAdmin(cookies, locals as never);
  if (authError === 'unauthorized') return json({ error: 'ログインが必要です' }, 401);
  if (authError === 'forbidden') return json({ error: '権限がありません' }, 403);

  const body = (await request.json()) as Record<string, unknown>;
  const approachId = String(body.approach_id ?? '');
  if (!approachId) return json({ error: 'アプローチIDが必要です' }, 400);

  const admin = createSupabaseAdminClient(locals as never);

  const { data: approach } = await admin
    .from('approaches')
    .select('id, kind, listing_id, wanted_request_id, from_org_id, message, status')
    .eq('id', approachId)
    .single();

  if (!approach) return json({ error: 'アプローチが見つかりません' }, 404);

  let buyerOrgId: string;
  let sellerOrgId: string;
  let subjectType: 'listing' | 'wanted';
  let listingId: string | null = null;
  let wantedId: string | null = null;

  if (approach.kind === 'interest' && approach.listing_id) {
    const { data: listing } = await admin
      .from('listings')
      .select('seller_org_id')
      .eq('id', approach.listing_id)
      .single();
    if (!listing) return json({ error: '出品が見つかりません' }, 404);
    buyerOrgId = approach.from_org_id;
    sellerOrgId = listing.seller_org_id;
    subjectType = 'listing';
    listingId = approach.listing_id;
  } else if (approach.kind === 'offer' && approach.wanted_request_id) {
    const { data: wanted } = await admin
      .from('wanted_requests')
      .select('buyer_org_id')
      .eq('id', approach.wanted_request_id)
      .single();
    if (!wanted) return json({ error: '買いたいが見つかりません' }, 404);
    buyerOrgId = wanted.buyer_org_id;
    sellerOrgId = approach.from_org_id;
    subjectType = 'wanted';
    wantedId = approach.wanted_request_id;
  } else {
    return json({ error: '不正なアプローチです' }, 400);
  }

  const { data: thread, error: threadError } = await admin
    .from('threads')
    .insert({
      subject_type: subjectType,
      listing_id: listingId,
      wanted_request_id: wantedId,
      approach_id: approachId,
      buyer_org_id: buyerOrgId,
      seller_org_id: sellerOrgId,
      operator_id: profile!.id,
      kind: 'mediation',
      status: 'open',
    })
    .select('id')
    .single();

  if (threadError || !thread) return json({ error: threadError?.message ?? 'スレッド作成に失敗しました' }, 400);

  await admin.from('approaches').update({ status: 'in_mediation' }).eq('id', approachId);

  const intro = String(body.message ?? '運営が仲介を開始しました。匿名のままやり取りいただけます。');
  await admin.from('messages').insert({
    thread_id: thread.id,
    sender_type: 'operator',
    sender_user_id: profile!.id,
    body: intro,
    visible_to: 'all',
  });

  if (approach.message) {
    await admin.from('messages').insert({
      thread_id: thread.id,
      sender_type: 'operator',
      sender_user_id: profile!.id,
      body: `（アプローチ原文）${approach.message}`,
      visible_to: 'operator',
    });
  }

  const siteUrl = getSiteUrl(locals as never);

  for (const orgId of [buyerOrgId, sellerOrgId]) {
    const email = await getOrgPrimaryEmail(admin, orgId);
    if (email) {
      const t = emailTemplates.mediationStartToParty(siteUrl, { threadId: thread.id });
      await sendUserEmail(email, t.subject, t.html, locals as never);
    }
  }

  const a = emailTemplates.mediationStartToAdmin({
    approachId,
    threadId: thread.id,
    adminUrl: `${siteUrl}/admin/threads/${thread.id}`,
  });
  await sendAdminEmail(a.subject, a.html, locals as never);

  return json({ success: true, thread_id: thread.id });
};
