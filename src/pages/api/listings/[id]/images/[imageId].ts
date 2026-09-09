import type { APIRoute } from 'astro';
import { getProfile } from '~/lib/auth';
import { createSupabaseAdminClient } from '~/lib/supabase/server';
import { isUuid, json } from '~/lib/http';
import { mediaError } from '~/lib/post-media';
export const prerender = false;
function imageAction(action: 'archive' | 'restore'): APIRoute {
  return async ({ params, request, cookies, locals }) => {
    const profile = await getProfile(cookies, locals as never);
    if (!profile) return json({ error: 'ログインが必要です' }, 401);
    const key = request.headers.get('Idempotency-Key');
    if (!params.id || !isUuid(params.id) || !params.imageId || !isUuid(params.imageId) || !key || !isUuid(key))
      return json({ error: '画像IDまたは受付キーが不正です' }, 400);
    const admin = createSupabaseAdminClient(locals as never);
    const { data, error } = await admin.rpc('edit_post_media', {
      p_source: 'listings',
      p_id: params.id,
      p_actor: profile.id,
      p_key: key,
      p_data: { action, image_id: params.imageId },
    });
    return error || !data ? mediaError(error?.message) : json({ success: true, ...data });
  };
}
export const DELETE = imageAction('archive');
export const PATCH = imageAction('restore');
