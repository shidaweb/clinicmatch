import type { APIRoute } from 'astro';
import { getProfile } from '~/lib/auth';
import { createSupabaseServerClient, createSupabaseAdminClient } from '~/lib/supabase/server';
import { notifyListingSubmission } from '~/lib/emails/notify-submission';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function buildListingPatchPayload(
  body: Record<string, unknown>,
  org: { prefecture?: string; city?: string } | null
) {
  const payload: Record<string, unknown> = {};

  if ('category_slug' in body) payload.category_slug = String(body.category_slug ?? '');
  if ('maker' in body) payload.maker = String(body.maker ?? '').trim();
  if ('model' in body) payload.model = String(body.model ?? '').trim();
  if ('manufacture_year' in body) {
    payload.manufacture_year = body.manufacture_year ? Number(body.manufacture_year) : null;
  }
  if ('condition' in body) payload.condition = body.condition ? String(body.condition) : null;
  if ('asking_price' in body) payload.asking_price = body.asking_price ? Number(body.asking_price) : null;
  if ('location_prefecture' in body) {
    payload.location_prefecture = String(body.location_prefecture ?? org?.prefecture ?? '');
  }
  if ('location_city' in body) payload.location_city = String(body.location_city ?? org?.city ?? '');
  if ('has_accessories' in body) {
    payload.has_accessories = body.has_accessories === true || body.has_accessories === 'true';
  }
  if ('accessories_detail' in body) {
    payload.accessories_detail = body.accessories_detail ? String(body.accessories_detail) : null;
  }
  if ('maker_maintenance' in body) payload.maker_maintenance = body.maker_maintenance ?? 'unknown';
  if ('maintenance_transferable' in body) {
    payload.maintenance_transferable = body.maintenance_transferable ?? 'unknown';
  }
  if ('maintenance_notes' in body) {
    payload.maintenance_notes = body.maintenance_notes ? String(body.maintenance_notes) : null;
  }
  if ('description' in body) payload.description = body.description ? String(body.description) : null;
  if (body.submit === true || body.submit === 'true') payload.status = 'pending_review';

  return payload;
}

export const PATCH: APIRoute = async ({ params, request, cookies, locals }) => {
  const profile = await getProfile(cookies, locals as never);
  if (!profile) return json({ error: 'ログインが必要です' }, 401);

  const id = params.id;
  if (!id) return json({ error: 'IDが必要です' }, 400);

  const body = (await request.json()) as Record<string, unknown>;
  const org = profile.organizations as { prefecture?: string; city?: string } | null;
  const payload = buildListingPatchPayload(body, org);
  if (Object.keys(payload).length === 0) return json({ error: '更新する項目がありません' }, 400);

  const supabase = createSupabaseServerClient(cookies, locals as never);

  const { data: existing } = await supabase
    .from('listings')
    .select('id, status, seller_org_id, maker, model')
    .eq('id', id)
    .single();

  if (!existing || existing.seller_org_id !== profile.org_id) {
    return json({ error: '出品が見つかりません' }, 404);
  }
  if (existing.status === 'published') {
    return json({ error: '公開中の出品は編集できません。運営にお問い合わせください。' }, 400);
  }

  const { error } = await supabase.from('listings').update(payload).eq('id', id);
  if (error) return json({ error: error.message }, 400);

  if (payload.status === 'pending_review' && existing.status !== 'pending_review') {
    const admin = createSupabaseAdminClient(locals as never);
    await notifyListingSubmission(admin, locals as never, {
      id,
      maker: String(payload.maker ?? existing.maker),
      model: String(payload.model ?? existing.model),
      orgId: profile.org_id,
      userId: profile.id,
    });
  }

  return json({ success: true, id });
};

export const POST: APIRoute = async ({ params, request, cookies, locals }) => {
  const profile = await getProfile(cookies, locals as never);
  if (!profile) return json({ error: 'ログインが必要です' }, 401);

  const listingId = params.id;
  if (!listingId) return json({ error: 'IDが必要です' }, 400);

  const supabase = createSupabaseServerClient(cookies, locals as never);
  const { data: listing } = await supabase
    .from('listings')
    .select('id, seller_org_id, status')
    .eq('id', listingId)
    .single();

  if (!listing || listing.seller_org_id !== profile.org_id) {
    return json({ error: '出品が見つかりません' }, 404);
  }
  if (listing.status === 'published') {
    return json({ error: '公開中の出品には画像を追加できません。運営にお問い合わせください。' }, 400);
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File) || !file.size) {
    return json({ error: '画像ファイルが必要です' }, 400);
  }
  if (file.size > 8 * 1024 * 1024) {
    return json({ error: '画像サイズは8MB以下にしてください' }, 400);
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const allowed = ['jpg', 'jpeg', 'png', 'webp'];
  if (!allowed.includes(ext)) return json({ error: 'JPEG/PNG/WebP のみ対応しています' }, 400);

  const storagePath = `${listingId}/${Date.now()}.${ext}`;
  const buffer = new Uint8Array(await file.arrayBuffer());

  const admin = createSupabaseAdminClient(locals as never);
  const { error: uploadError } = await admin.storage
    .from('listing-images')
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) return json({ error: uploadError.message }, 400);

  const { count } = await supabase
    .from('listing_images')
    .select('*', { count: 'exact', head: true })
    .eq('listing_id', listingId);

  if ((count ?? 0) >= 10) {
    return json({ error: '画像は最大10枚までです' }, 400);
  }

  const isCover = (count ?? 0) === 0;

  const { data: imageRow, error: dbError } = await supabase
    .from('listing_images')
    .insert({
      listing_id: listingId,
      storage_path: storagePath,
      sort_order: count ?? 0,
      is_cover: isCover,
    })
    .select('id, storage_path, is_cover')
    .single();

  if (dbError) {
    await admin.storage.from('listing-images').remove([storagePath]);
    return json({ error: dbError.message }, 400);
  }

  return json({ success: true, image: imageRow });
};

export const DELETE: APIRoute = async ({ params, cookies, locals }) => {
  const profile = await getProfile(cookies, locals as never);
  if (!profile) return json({ error: 'ログインが必要です' }, 401);

  const listingId = params.id;
  if (!listingId) return json({ error: 'IDが必要です' }, 400);

  const supabase = createSupabaseServerClient(cookies, locals as never);
  const admin = createSupabaseAdminClient(locals as never);

  const { data: listing } = await supabase
    .from('listings')
    .select('id, seller_org_id, status')
    .eq('id', listingId)
    .single();

  if (!listing || listing.seller_org_id !== profile.org_id) {
    return json({ error: '出品が見つかりません' }, 404);
  }
  if (listing.status === 'published') {
    return json({ error: '公開中の出品は削除できません。運営にお問い合わせください。' }, 400);
  }

  const { data: images, error: imageError } = await supabase
    .from('listing_images')
    .select('storage_path')
    .eq('listing_id', listingId);
  if (imageError) return json({ error: imageError.message }, 400);

  const storagePaths = (images ?? [])
    .map((img) => img.storage_path)
    .filter((path): path is string => Boolean(path));
  if (storagePaths.length > 0) {
    await admin.storage.from('listing-images').remove(storagePaths);
  }

  const { error: deleteError } = await supabase.from('listings').delete().eq('id', listingId);
  if (deleteError) return json({ error: deleteError.message }, 400);

  return json({ success: true, id: listingId });
};
