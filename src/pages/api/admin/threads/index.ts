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

  const { data: result, error: mediationError } = await admin.rpc('start_mediation', {
    p_approach: approachId,
    p_actor: profile!.id,
  });
  if (mediationError || !result?.id)
    return json({ error: '仲介を開始できません。対象案件の公開状態と当事者を確認してください。' }, 409);
  if (result.duplicate) return json({ success: true, thread_id: result.id });
  const thread = { id: result.id };
  const buyerOrgId = result.buyer_org_id;
  const sellerOrgId = result.seller_org_id;

  const siteUrl = getSiteUrl(locals as never);

  try {
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
  } catch {
    console.error('[mediation] notification failed; thread retained', thread.id);
  }
  return json({ success: true, thread_id: thread.id });
};
