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

/** Mark thread as agreed and disclose contact info */
export const POST: APIRoute = async ({ params, cookies, locals }) => {
  const { error: authError } = await requireAdmin(cookies, locals as never);
  if (authError === 'unauthorized') return json({ error: 'ログインが必要です' }, 401);
  if (authError === 'forbidden') return json({ error: '権限がありません' }, 403);

  const threadId = params.id;
  if (!threadId) return json({ error: 'スレッドIDが必要です' }, 400);

  const admin = createSupabaseAdminClient(locals as never);

  const { data: thread, error } = await admin
    .from('threads')
    .update({ contact_disclosed: true })
    .eq('id', threadId)
    .select('id, approach_id, buyer_org_id, seller_org_id')
    .single();

  if (error || !thread) return json({ error: error?.message ?? '更新に失敗しました' }, 400);

  if (thread.approach_id) {
    await admin.from('approaches').update({ status: 'agreed' }).eq('id', thread.approach_id);
  }

  await admin.from('messages').insert({
    thread_id: threadId,
    sender_type: 'operator',
    body: '双方の合意が確認されました。連絡先が開示されました。',
    visible_to: 'all',
  });

  const siteUrl = getSiteUrl(locals as never);

  for (const orgId of [thread.buyer_org_id, thread.seller_org_id]) {
    const email = await getOrgPrimaryEmail(admin, orgId);
    if (email) {
      const t = emailTemplates.discloseToParty(siteUrl, { threadId });
      await sendUserEmail(email, t.subject, t.html, locals as never);
    }
  }

  const a = emailTemplates.discloseToAdmin({
    threadId,
    adminUrl: `${siteUrl}/admin/threads/${threadId}`,
  });
  await sendAdminEmail(a.subject, a.html, locals as never);

  return json({ success: true });
};
