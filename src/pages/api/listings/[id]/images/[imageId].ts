import type { APIRoute } from 'astro';
import { getProfile } from '~/lib/auth';
import { createSupabaseAdminClient, createSupabaseServerClient } from '~/lib/supabase/server';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const DELETE: APIRoute = async ({ params, cookies, locals }) => {
  const profile = await getProfile(cookies, locals as never);
  if (!profile) return json({ error: 'ログインが必要です' }, 401);

  const listingId = params.id;
  const imageId = params.imageId;
  if (!listingId || !imageId) return json({ error: 'IDが必要です' }, 400);

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
    return json({ error: '公開中の出品は編集できません。運営にお問い合わせください。' }, 400);
  }

  const { data: image } = await supabase
    .from('listing_images')
    .select('id, storage_path, is_cover')
    .eq('id', imageId)
    .eq('listing_id', listingId)
    .single();

  if (!image) return json({ error: '画像が見つかりません' }, 404);

  const { error: dbDeleteError } = await supabase
    .from('listing_images')
    .delete()
    .eq('id', imageId)
    .eq('listing_id', listingId);

  if (dbDeleteError) return json({ error: dbDeleteError.message }, 400);

  await admin.storage.from('listing-images').remove([image.storage_path]);

  const { data: remaining } = await supabase
    .from('listing_images')
    .select('id')
    .eq('listing_id', listingId)
    .order('sort_order', { ascending: true });

  for (let index = 0; index < (remaining ?? []).length; index += 1) {
    const target = remaining![index];
    await supabase.from('listing_images').update({ sort_order: index }).eq('id', target.id);
  }

  if (image.is_cover && remaining?.length) {
    await supabase
      .from('listing_images')
      .update({ is_cover: false })
      .eq('listing_id', listingId);
    await supabase.from('listing_images').update({ is_cover: true }).eq('id', remaining[0].id);
  }

  return json({ success: true });
};
