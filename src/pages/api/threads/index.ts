import type { APIRoute } from 'astro';
import { getProfile } from '~/lib/auth';
import { createSupabaseServerClient } from '~/lib/supabase/server';
import { sendAdminEmail, escapeHtml } from '~/lib/notifications';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Create Q&A thread from listing (buyer asks about maintenance/accessories) */
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const profile = await getProfile(cookies, locals as never);
  if (!profile) return json({ error: 'ログインが必要です' }, 401);

  const body = (await request.json()) as Record<string, unknown>;
  const listingId = String(body.listing_id ?? '');
  const message = String(body.message ?? '').trim();

  if (!listingId || !message) return json({ error: '出品IDとメッセージは必須です' }, 400);

  const supabase = createSupabaseServerClient(cookies, locals as never);

  const { data: listing } = await supabase
    .from('listings')
    .select('id, seller_org_id, status')
    .eq('id', listingId)
    .eq('status', 'published')
    .single();

  if (!listing) return json({ error: '出品が見つかりません' }, 404);
  if (listing.seller_org_id === profile.org_id) {
    return json({ error: '自分の出品にはQ&Aできません' }, 400);
  }

  const { data: thread, error: threadError } = await supabase
    .from('threads')
    .insert({
      subject_type: 'listing',
      listing_id: listingId,
      buyer_org_id: profile.org_id,
      seller_org_id: listing.seller_org_id,
      kind: 'qa',
      status: 'open',
    })
    .select('id')
    .single();

  if (threadError || !thread) return json({ error: threadError?.message ?? 'スレッド作成に失敗しました' }, 400);

  const { error: msgError } = await supabase.from('messages').insert({
    thread_id: thread.id,
    sender_type: 'buyer',
    sender_user_id: profile.id,
    body: message,
    visible_to: 'all',
  });

  if (msgError) return json({ error: msgError.message }, 400);

  await sendAdminEmail(
    '【クリニックマッチ】保守Q&Aが開始されました',
    `<p>出品ID: ${escapeHtml(listingId)}</p><p>${escapeHtml(message)}</p>`,
    locals as never
  );

  return json({ success: true, thread_id: thread.id });
};
