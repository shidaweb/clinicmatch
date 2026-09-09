import type { APIRoute } from 'astro';
import { requireAdmin } from '~/lib/auth';
import { createSupabaseAdminClient } from '~/lib/supabase/server';
import { notifyPostPublished } from '~/lib/emails/notify-submission';
import { getOrgPrimaryEmail } from '~/lib/emails/recipients';
import { sendUserEmail } from '~/lib/notifications';
import { renderEmail, escapeHtml } from '~/lib/emails/layout';
import { getSiteUrl } from '~/lib/emails/helpers';
import { json, readObject, isUuid, cleanText } from '~/lib/http';
export function reviewPost(decision: 'published' | 'rejected'): APIRoute {
  return async ({ params, cookies, locals, request }) => {
    const { profile, error: authError } = await requireAdmin(cookies, locals as never);
    if (authError) return json({ error: '管理者権限が必要です' }, 403);
    if (!['listings', 'wanted'].includes(params.type || '') || !isUuid(params.id))
      return json({ error: '不正な案件です' }, 400);
    const reason = decision === 'rejected' ? cleanText((await readObject(request))?.reason) : null;
    if (decision === 'rejected' && (!reason || reason.length > 2000))
      return json({ error: '差し戻し理由を1〜2000文字で入力してください' }, 400);
    const table = params.type === 'listings' ? 'listings' : 'wanted_requests';
    const admin = createSupabaseAdminClient(locals as never);
    const { data: post, error } = await admin.rpc('review_post', {
      p_source: table,
      p_id: params.id,
      p_actor: profile!.id,
      p_decision: decision,
      p_reason: reason,
    });
    if (error)
      return json(
        {
          error: error.message.includes('not_pending_review')
            ? '審査待ちではありません。最新の状態を確認してください。'
            : '審査結果を保存できませんでした',
        },
        error.message.includes('not_pending_review') ? 409 : 503
      );
    let notificationFailed = false;
    try {
      const orgId = post.seller_org_id || post.buyer_org_id;
      if (decision === 'published')
        await notifyPostPublished(admin, locals as never, {
          type: table === 'listings' ? 'listing' : 'wanted',
          id: params.id,
          title: [post.maker, post.model || post.category_slug].filter(Boolean).join(' '),
          orgId,
        });
      else {
        const email = await getOrgPrimaryEmail(admin, orgId);
        notificationFailed =
          !email ||
          !(await sendUserEmail(
            email,
            '【クリニックマッチ】投稿内容の確認をお願いします',
            renderEmail({
              heading: '投稿を差し戻しました',
              paragraphs: [escapeHtml(reason!)],
              button: { label: '投稿を確認', url: `${getSiteUrl(locals as never)}/account/${params.type}` },
            }),
            locals as never
          ));
      }
    } catch {
      notificationFailed = true;
    }
    return json({ success: true, notificationFailed });
  };
}
