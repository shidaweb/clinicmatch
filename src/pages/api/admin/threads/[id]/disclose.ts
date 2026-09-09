import type { APIRoute } from 'astro';
import { readObject, cleanText } from '~/lib/http';
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
export const POST: APIRoute = async ({ params, cookies, locals, request }) => {
  const { profile, error: authError } = await requireAdmin(cookies, locals as never);
  if (authError === 'unauthorized') return json({ error: 'ログインが必要です' }, 401);
  if (authError === 'forbidden') return json({ error: '権限がありません' }, 403);

  const threadId = params.id;
  if (!threadId) return json({ error: 'スレッドIDが必要です' }, 400);

  const admin = createSupabaseAdminClient(locals as never);

  const body = await readObject(request);
  const buyer = cleanText(body?.buyer_evidence),
    seller = cleanText(body?.seller_evidence);
  if ([buyer, seller].some((v) => v.length < 5 || v.length > 2000))
    return json({ error: '売り手・買い手それぞれの合意を確認した日時・方法・記録先を入力してください' }, 400);
  const { data: thread, error } = await admin.rpc('disclose_mediation', {
    p_thread: threadId,
    p_actor: profile!.id,
    p_buyer: buyer,
    p_seller: seller,
  });
  if (error || !thread) return json({ error: '開示できません。合意記録とスレッドの状態を確認してください' }, 409);
  if (thread.duplicate) return json({ success: true });

  const siteUrl = getSiteUrl(locals as never);

  try {
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
  } catch {
    console.error('[disclose] notification failed; evidence retained', threadId);
  }
  return json({ success: true });
};
