import type { APIRoute } from 'astro';
import { requireAdmin } from '~/lib/auth';
import { createSupabaseAdminClient } from '~/lib/supabase/server';
import { json, readObject, isUuid, cleanText } from '~/lib/http';
import { SOURCES, CRM_STATUSES, ACTIVITY_LABELS } from '~/lib/crm';
export const prerender = false;
export const PATCH: APIRoute = async ({ request, params, cookies, locals }) => {
  const { profile, error: authError } = await requireAdmin(cookies, locals as never);
  if (authError) return json({ error: '管理者権限が必要です' }, 403);
  if (!SOURCES.includes(params.source as (typeof SOURCES)[number]) || !isUuid(params.id))
    return json({ error: '案件の指定が不正です' }, 400);
  const body = await readObject(request);
  if (!body || !isUuid(body.request_id) || !Number.isInteger(body.version) || Number(body.version) < 0)
    return json({ error: '保存内容が不正です' }, 400);
  const status = cleanText(body.status),
    kind = cleanText(body.kind),
    note = cleanText(body.body),
    action = cleanText(body.next_action);
  const target = cleanText(body.contact_target),
    owner = cleanText(body.owner_id) || null;
  const due = body.due_at == null ? null : cleanText(body.due_at),
    occurred = cleanText(body.occurred_at);
  if (!Object.hasOwn(CRM_STATUSES, status) || !Object.hasOwn(ACTIVITY_LABELS, kind))
    return json({ error: '状態・記録種別が不正です' }, 400);
  if (!note || note.length > 10000 || action.length > 500 || target.length > 200 || (owner && !isUuid(owner)))
    return json({ error: '記録内容を確認してください' }, 400);
  if (
    !Number.isFinite(Date.parse(occurred)) ||
    Date.parse(occurred) > Date.now() + 60000 ||
    (due !== null && !Number.isFinite(Date.parse(due)))
  )
    return json({ error: '実施日時・期限を確認してください。連絡記録に未来の日時は指定できません' }, 400);
  if (['phone', 'email', 'line', 'meeting'].includes(kind) && !target)
    return json({ error: '連絡した相手を入力してください' }, 400);
  if (['in_progress', 'waiting'].includes(status) && (!action || !due || !owner))
    return json({ error: '対応中・返信待ちには担当者、次の対応、期限を設定してください' }, 400);
  const admin = createSupabaseAdminClient(locals as never);
  const { data, error } = await admin.rpc('save_crm_case', {
    p_source: params.source,
    p_source_id: params.id,
    p_actor: profile!.id,
    p_version: body.version,
    p_request: body.request_id,
    p_patch: {
      status,
      kind,
      body: note,
      next_action: status === 'completed' ? null : action,
      due_at: status === 'completed' ? null : due,
      owner_id: owner,
      contact_target: target || null,
      occurred_at: occurred,
    },
  });
  if (error)
    return json(
      {
        error: error.message.includes('version_conflict')
          ? '別の担当者が更新しました。再読み込みして内容を確認してください'
          : '保存できませんでした。入力を残したまま再試行してください',
      },
      error.message.includes('conflict') ? 409 : 503
    );
  return json({ success: true, id: data });
};
