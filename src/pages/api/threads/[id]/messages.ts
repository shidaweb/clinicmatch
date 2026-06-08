import type { APIRoute } from 'astro';
import { getProfile } from '~/lib/auth';
import { createSupabaseAdminClient, createSupabaseServerClient } from '~/lib/supabase/server';
import { sendAdminEmail, sendUserEmail } from '~/lib/notifications';
import { getOrgPrimaryEmail } from '~/lib/emails/recipients';
import { getSiteUrl } from '~/lib/emails/helpers';
import * as emailTemplates from '~/lib/emails/templates';
import { resolveSenderType } from '~/lib/threads';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function notifyOrg(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  orgId: string,
  siteUrl: string,
  threadId: string,
  locals: unknown
) {
  const email = await getOrgPrimaryEmail(admin, orgId);
  if (email) {
    const t = emailTemplates.newMessageToUser(siteUrl, { threadId });
    await sendUserEmail(email, t.subject, t.html, locals as never);
  }
}

export const POST: APIRoute = async ({ params, request, cookies, locals }) => {
  const profile = await getProfile(cookies, locals as never);
  if (!profile) return json({ error: 'ログインが必要です' }, 401);

  const threadId = params.id;
  if (!threadId) return json({ error: 'スレッドIDが必要です' }, 400);

  const body = (await request.json()) as Record<string, unknown>;
  const messageBody = String(body.body ?? '').trim();
  if (!messageBody) return json({ error: 'メッセージを入力してください' }, 400);

  const supabase = createSupabaseServerClient(cookies, locals as never);

  const { data: thread } = await supabase
    .from('threads')
    .select('id, buyer_org_id, seller_org_id, status')
    .eq('id', threadId)
    .single();

  if (!thread) return json({ error: 'スレッドが見つかりません' }, 404);
  if (thread.status === 'closed') return json({ error: 'このスレッドは終了しています' }, 400);

  const senderType = resolveSenderType(profile.org_id, thread, profile.role === 'admin');
  if (!senderType) return json({ error: 'このスレッドに投稿する権限がありません' }, 403);

  const visibleTo =
    senderType === 'operator' && body.visible_to
      ? (String(body.visible_to) as 'all' | 'buyer_side' | 'seller_side')
      : 'all';

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      thread_id: threadId,
      sender_type: senderType,
      sender_user_id: profile.id,
      body: messageBody,
      visible_to: senderType === 'operator' ? visibleTo : 'all',
    })
    .select('id, created_at')
    .single();

  if (error) return json({ error: error.message }, 400);

  const admin = createSupabaseAdminClient(locals as never);
  const siteUrl = getSiteUrl(locals as never);
  const preview = messageBody.length > 120 ? `${messageBody.slice(0, 120)}…` : messageBody;

  if (senderType === 'buyer') {
    await notifyOrg(admin, thread.seller_org_id, siteUrl, threadId, locals);
  } else if (senderType === 'seller') {
    await notifyOrg(admin, thread.buyer_org_id, siteUrl, threadId, locals);
  } else if (senderType === 'operator') {
    if (visibleTo === 'all' || visibleTo === 'buyer_side') {
      await notifyOrg(admin, thread.buyer_org_id, siteUrl, threadId, locals);
    }
    if (visibleTo === 'all' || visibleTo === 'seller_side') {
      await notifyOrg(admin, thread.seller_org_id, siteUrl, threadId, locals);
    }
  }

  const a = emailTemplates.newMessageToAdmin({
    threadId,
    senderType,
    preview,
    adminUrl: `${siteUrl}/admin/threads/${threadId}`,
  });
  await sendAdminEmail(a.subject, a.html, locals as never);

  return json({ success: true, message });
};
