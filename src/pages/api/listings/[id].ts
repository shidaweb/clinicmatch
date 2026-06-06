import type { APIRoute } from 'astro';
import { getProfile } from '~/lib/auth';
import { createSupabaseServerClient, createSupabaseAdminClient } from '~/lib/supabase/server';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function buildListingPayload(body: Record<string, unknown>, org: { prefecture?: string; city?: string } | null) {
  return {
    category_slug: String(body.category_slug ?? ''),
    maker: String(body.maker ?? '').trim(),
    model: String(body.model ?? '').trim(),
    manufacture_year: body.manufacture_year ? Number(body.manufacture_year) : null,
    condition: body.condition ? String(body.condition) : null,
    asking_price: body.asking_price ? Number(body.asking_price) : null,
    location_prefecture: String(body.location_prefecture ?? org?.prefecture ?? ''),
    location_city: String(body.location_city ?? org?.city ?? ''),
    has_accessories: body.has_accessories === true || body.has_accessories === 'true',
    accessories_detail: body.accessories_detail ? String(body.accessories_detail) : null,
    maker_maintenance: body.maker_maintenance ?? 'unknown',
    maintenance_transferable: body.maintenance_transferable ?? 'unknown',
    maintenance_notes: body.maintenance_notes ? String(body.maintenance_notes) : null,
    description: body.description ? String(body.description) : null,
    ...(body.submit === true || body.submit === 'true' ? { status: 'pending_review' as const } : {}),
  };
}

export const PATCH: APIRoute = async ({ params, request, cookies, locals }) => {
  const profile = await getProfile(cookies, locals as never);
  if (!profile) return json({ error: 'ログインが必要です' }, 401);

  const id = params.id;
  if (!id) return json({ error: 'IDが必要です' }, 400);

  const body = (await request.json()) as Record<string, unknown>;
  const org = profile.organizations as { prefecture?: string; city?: string } | null;
  const payload = buildListingPayload(body, org);

  const supabase = createSupabaseServerClient(cookies, locals as never);

  const { data: existing } = await supabase
    .from('listings')
    .select('id, status, seller_org_id')
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
    .select('id, seller_org_id')
    .eq('id', listingId)
    .single();

  if (!listing || listing.seller_org_id !== profile.org_id) {
    return json({ error: '出品が見つかりません' }, 404);
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File) || !file.size) {
    return json({ error: '画像ファイルが必要です' }, 400);
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
