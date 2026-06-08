import type { APIRoute } from 'astro';
import { getProfile } from '~/lib/auth';
import { createSupabaseServerClient } from '~/lib/supabase/server';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const PATCH: APIRoute = async ({ params, request, cookies, locals }) => {
  const profile = await getProfile(cookies, locals as never);
  if (!profile) return json({ error: 'ログインが必要です' }, 401);

  const listingId = params.id;
  if (!listingId) return json({ error: 'IDが必要です' }, 400);

  const body = (await request.json()) as { order?: string[]; coverId?: string };
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
    return json({ error: '公開中の出品は編集できません。運営にお問い合わせください。' }, 400);
  }

  const { data: images, error: imagesError } = await supabase
    .from('listing_images')
    .select('id')
    .eq('listing_id', listingId)
    .order('sort_order', { ascending: true });

  if (imagesError) return json({ error: imagesError.message }, 400);
  const imageIds = new Set((images ?? []).map((item) => item.id as string));

  if (Array.isArray(body.order) && body.order.length > 0) {
    if (!body.order.every((id) => imageIds.has(id))) {
      return json({ error: '並び順に不正な画像IDが含まれています' }, 400);
    }
    for (let index = 0; index < body.order.length; index += 1) {
      const id = body.order[index];
      const { error } = await supabase
        .from('listing_images')
        .update({ sort_order: index })
        .eq('id', id)
        .eq('listing_id', listingId);
      if (error) return json({ error: error.message }, 400);
    }
  }

  if (body.coverId) {
    if (!imageIds.has(body.coverId)) {
      return json({ error: '表紙画像が見つかりません' }, 400);
    }
    const { error: clearError } = await supabase
      .from('listing_images')
      .update({ is_cover: false })
      .eq('listing_id', listingId);
    if (clearError) return json({ error: clearError.message }, 400);

    const { error: coverError } = await supabase
      .from('listing_images')
      .update({ is_cover: true })
      .eq('listing_id', listingId)
      .eq('id', body.coverId);
    if (coverError) return json({ error: coverError.message }, 400);
  }

  return json({ success: true });
};
