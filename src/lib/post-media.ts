import type { APIRoute } from 'astro';
import { getProfile } from '~/lib/auth';
import { createSupabaseAdminClient } from '~/lib/supabase/server';
import { isUuid, json } from '~/lib/http';

export function imageFormat(bytes: Uint8Array): { extension: string; mime: string } | null {
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return { extension: 'jpg', mime: 'image/jpeg' };
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b))
    return { extension: 'png', mime: 'image/png' };
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  )
    return { extension: 'webp', mime: 'image/webp' };
  return null;
}
export function mediaError(message = '') {
  const text = message.includes('image_limit')
    ? '画像は最大10枚までです。'
    : message.includes('post_not_editable')
      ? '審査中・公開中・保管済みの投稿は画像を変更できません。'
      : message.includes('forbidden')
        ? '投稿が見つからないか、変更する権限がありません。'
        : /submission_conflict|image_set_conflict/.test(message)
          ? '画像の状態が変わりました。再読み込みして確認してください。'
          : '画像の保存結果を確認できませんでした。既存の画像は削除していません。同じ操作を再試行できます。';
  return json(
    { error: text },
    /image_limit|post_not_editable|submission_conflict|image_set_conflict|image_not_found/.test(message)
      ? 409
      : message.includes('forbidden')
        ? 403
        : 503
  );
}
export function uploadPostImage(source: 'listings' | 'wanted_requests'): APIRoute {
  return async ({ params, request, cookies, locals }) => {
    const profile = await getProfile(cookies, locals as never);
    if (!profile) return json({ error: 'ログインが必要です' }, 401);
    const id = params.id,
      key = request.headers.get('Idempotency-Key');
    if (!id || !isUuid(id) || !key || !isUuid(key))
      return json({ error: '受付キーまたは投稿IDが不正です。画面を開き直してください。' }, 400);
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return json({ error: '画像を選択してください' }, 400);
    }
    const file = form.get('file');
    if (!(file instanceof File) || !file.size || file.size > 8 * 1024 * 1024)
      return json({ error: '8MB以下の画像を選択してください' }, 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const format = imageFormat(bytes);
    if (!format) return json({ error: 'JPEG・PNG・WebPの画像ファイルを選択してください' }, 400);
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) =>
      b.toString(16).padStart(2, '0')
    ).join('');
    const path = `media-v2/${id}/${hash}.${format.extension}`;
    const payload = { action: 'attach', path };
    const admin = createSupabaseAdminClient(locals as never);
    const { data: previous, error: receiptError } = await admin
      .from('post_media_receipts')
      .select('source,post_id,payload,result')
      .eq('actor_id', profile.id)
      .eq('request_id', key)
      .maybeSingle();
    if (receiptError) return mediaError();
    if (previous) {
      if (previous.source !== source || previous.post_id !== id || previous.payload?.path !== path)
        return mediaError('submission_conflict');
      return json({ success: true, ...previous.result, duplicate: true });
    }
    const ownerColumn = source === 'listings' ? 'seller_org_id' : 'buyer_org_id';
    const { data: post, error: postError } = await admin
      .from(source)
      .select('id,status,archived_at')
      .eq('id', id)
      .eq(ownerColumn, profile.org_id)
      .maybeSingle();
    if (postError) return mediaError();
    if (!post) return mediaError('forbidden');
    if (post.archived_at || !['draft', 'rejected'].includes(post.status)) return mediaError('post_not_editable');
    const bucket = source === 'listings' ? 'listing-images' : 'wanted-images';
    const { error: uploadError } = await admin.storage
      .from(bucket)
      .upload(path, bytes, { contentType: format.mime, upsert: false });
    // Content-addressed paths are immutable and writable only by the server.
    // A retry may find the already-uploaded object after a lost response.
    if (uploadError && String((uploadError as { statusCode?: string }).statusCode) !== '409') return mediaError();
    const { data, error } = await admin.rpc('edit_post_media', {
      p_source: source,
      p_id: id,
      p_actor: profile.id,
      p_key: key,
      p_data: payload,
    });
    if (error || !data) return mediaError(error?.message);
    // Never delete storage on an uncertain DB response: the transaction may have committed.
    return json({ success: true, ...data });
  };
}
