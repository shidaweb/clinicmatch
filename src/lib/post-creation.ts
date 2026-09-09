import { isUuid, json } from '~/lib/http';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function createPostOnce(
  admin: SupabaseClient,
  request: Request,
  source: 'listings' | 'wanted_requests',
  actor: string,
  payload: Record<string, unknown>
) {
  const key = request.headers.get('Idempotency-Key');
  if (!key || !isUuid(key))
    return { response: json({ error: '受付キーがありません。画面を開き直してください。' }, 400) };
  const { data, error } = await admin.rpc('create_post_once', {
    p_source: source,
    p_actor: actor,
    p_key: key,
    p_data: payload,
  });
  if (error || !data?.id) {
    const conflict = error?.message?.includes('submission_conflict');
    const invalid = /^(22|23)/.test(error?.code ?? '');
    console.error('[post] create failed', error?.code);
    return {
      response: json(
        {
          error: conflict
            ? '送信済みの内容と異なります。保存済みの下書きを確認してください。'
            : '保存を確認できませんでした。入力を残したまま再度お試しください。',
        },
        conflict ? 409 : invalid ? 400 : 503
      ),
    };
  }
  return { id: String(data.id), duplicate: Boolean(data.duplicate) };
}
