import type { APIRoute } from 'astro';
import { createSupabaseAdminClient, createSupabaseServerClient } from '~/lib/supabase/server';
import { parseIntake } from '~/lib/intake';
import { json, readObject, isUuid } from '~/lib/http';
import { renderEmail } from '~/lib/emails/layout';
import { sendAdminEmail } from '~/lib/notifications';
import { getSiteUrl } from '~/lib/emails/helpers';

type Admin = ReturnType<typeof createSupabaseAdminClient>;
type Locals = Parameters<typeof createSupabaseAdminClient>[0];

export async function notifyIntake(admin: Admin, id: string, locals: Locals) {
  const { data, error } = await admin
    .from('consultations')
    .update({ notification_status: 'sending', notification_attempted_at: new Date().toISOString() })
    .eq('id', id)
    .in('notification_status', ['pending', 'failed'])
    .select('id')
    .maybeSingle();
  if (error || !data) return false;
  let sent = false;
  try {
    sent = await sendAdminEmail(
      '【クリニックマッチ】相談を受け付けました',
      renderEmail({
        heading: '新しい相談があります',
        paragraphs: ['連絡先と相談内容を運営CRMで確認してください。'],
        button: { label: '案件を確認', url: `${getSiteUrl(locals)}/admin/crm/consultations/${id}` },
      }),
      locals
    );
  } finally {
    const { error: updateError } = await admin
      .from('consultations')
      .update({ notification_status: sent ? 'sent' : 'failed' })
      .eq('id', id);
    if (updateError) console.error('[intake] notification status update failed', id, updateError.code);
  }
  return sent;
}

export function receiveIntake(legacy: boolean): APIRoute {
  return async ({ request, cookies, locals }) => {
    const body = await readObject(request);
    if (!body) return json({ error: '入力内容の形式を確認してください' }, 400);
    const key = request.headers.get('Idempotency-Key') || crypto.randomUUID();
    if (!isUuid(key)) return json({ error: '受付キーが不正です。画面を再読み込みしてください' }, 400);
    const client = createSupabaseServerClient(cookies, locals as never);
    const {
      data: { user },
    } = await client.auth.getUser();
    const parsed = parseIntake(body, legacy, user?.email ?? null);
    if (!parsed.value) return json({ error: parsed.error }, 400);
    const admin = createSupabaseAdminClient(locals as never);
    let orgId: string | null = null;
    if (user) {
      const { data: member, error } = await admin.from('profiles').select('org_id').eq('id', user.id).maybeSingle();
      if (error) return json({ error: '会員情報を確認できません。再度お試しください' }, 503);
      orgId = member?.org_id ?? null;
    }
    const payload = { ...parsed.value, org_id: orgId };
    for (const [table, id] of [
      ['listings', payload.related_listing_id],
      ['wanted_requests', payload.related_wanted_id],
    ]) {
      if (!id) continue;
      const { data, error } = await client.from(String(table)).select('id').eq('id', id).maybeSingle();
      if (error || !data) return json({ error: '関連案件を確認できません。相談ページを開き直してください' }, 400);
    }
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) =>
      b.toString(16).padStart(2, '0')
    ).join('');
    const { data, error } = await admin.rpc('receive_consultation', { p_key: key, p_hash: hash, p_data: payload });
    if (error || !data?.id) {
      console.error('[intake] save failed', error?.code);
      const conflict = error?.message?.includes('submission_conflict');
      return json(
        {
          error: conflict
            ? '送信済みの内容と異なります。ページを開き直して新しい相談として送信してください'
            : '相談を保存できませんでした。内容を残したまま、再度お試しください',
        },
        conflict ? 409 : 503
      );
    }
    if (!data.duplicate) {
      try {
        await notifyIntake(admin, data.id, locals as never);
      } catch {
        console.error('[intake] notification failed; receipt retained', data.id);
      }
    }
    return json({ success: true, id: data.id });
  };
}
