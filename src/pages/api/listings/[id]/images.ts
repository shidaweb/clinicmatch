import type { APIRoute } from 'astro';
import { getProfile } from '~/lib/auth';
import { createSupabaseAdminClient } from '~/lib/supabase/server';
import { isUuid, json, readObject } from '~/lib/http';
import { mediaError } from '~/lib/post-media';
export const prerender = false;
export const PATCH: APIRoute = async ({ params, request, cookies, locals }) => {
  const profile = await getProfile(cookies, locals as never);
  if (!profile) return json({ error: 'ログインが必要です' }, 401);
  const key = request.headers.get('Idempotency-Key');
  const body = await readObject(request);
  if (!body || !params.id || !isUuid(params.id) || !key || !isUuid(key))
    return json({ error: '入力内容を確認してください' }, 400);
  const payload: Record<string, unknown> = { action: 'order' };
  if ('order' in body) {
    if (
      !Array.isArray(body.order) ||
      !body.order.length ||
      body.order.length > 10 ||
      !body.order.every(isUuid) ||
      new Set(body.order).size !== body.order.length
    )
      return json({ error: '画像の並び順が不正です' }, 400);
    payload.order = body.order;
  }
  if ('coverId' in body) {
    if (!isUuid(body.coverId)) return json({ error: '表紙の画像IDが不正です' }, 400);
    payload.cover_id = body.coverId;
  }
  if (Object.keys(payload).length === 1) return json({ error: '変更する画像を選んでください' }, 400);
  const admin = createSupabaseAdminClient(locals as never);
  const { data, error } = await admin.rpc('edit_post_media', {
    p_source: 'listings',
    p_id: params.id,
    p_actor: profile.id,
    p_key: key,
    p_data: payload,
  });
  return error || !data ? mediaError(error?.message) : json({ success: true, ...data });
};
