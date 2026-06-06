import type { APIRoute } from 'astro';
import { getProfile } from '~/lib/auth';
import { createSupabaseServerClient } from '~/lib/supabase/server';
import { sendAdminEmail, escapeHtml } from '~/lib/notifications';
import { resolveSenderType } from '~/lib/threads';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
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

  await sendAdminEmail(
    '【クリニックマッチ】新着メッセージ',
    `<p>スレッド: ${escapeHtml(threadId)}</p><p>${escapeHtml(messageBody)}</p>`,
    locals as never
  );

  return json({ success: true, message });
};
