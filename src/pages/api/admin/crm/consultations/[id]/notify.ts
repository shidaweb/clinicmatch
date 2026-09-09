import type { APIRoute } from 'astro';
import { requireAdmin } from '~/lib/auth';
import { createSupabaseAdminClient } from '~/lib/supabase/server';
import { notifyIntake } from '~/lib/receive-intake';
import { json, isUuid } from '~/lib/http';
export const prerender = false;
export const POST: APIRoute = async ({ params, cookies, locals }) => {
  const { error } = await requireAdmin(cookies, locals as never);
  if (error) return json({ error: '管理者権限が必要です' }, 403);
  if (!isUuid(params.id)) return json({ error: '案件の指定が不正です' }, 400);
  const admin = createSupabaseAdminClient(locals as never);
  // Recover a worker interrupted mid-send. Delivery may already have happened: manual retry only.
  await admin
    .from('consultations')
    .update({ notification_status: 'failed' })
    .eq('id', params.id)
    .eq('notification_status', 'sending')
    .lt('notification_attempted_at', new Date(Date.now() - 10 * 60000).toISOString());
  try {
    const sent = await notifyIntake(admin, params.id, locals as never);
    return json(
      sent ? { success: true } : { error: '送信済み・送信中、または通知に失敗しました。状態を再確認してください' },
      sent ? 200 : 409
    );
  } catch {
    return json({ error: '通知できませんでした。受付データは保存されています' }, 503);
  }
};
