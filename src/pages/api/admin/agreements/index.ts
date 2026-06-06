import type { APIRoute } from 'astro';
import { requireAdmin } from '~/lib/auth';
import { createSupabaseAdminClient } from '~/lib/supabase/server';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const { error: authError } = await requireAdmin(cookies, locals as never);
  if (authError === 'unauthorized') return json({ error: 'ログインが必要です' }, 401);
  if (authError === 'forbidden') return json({ error: '権限がありません' }, 403);

  const body = (await request.json()) as Record<string, unknown>;
  const sellerOrgId = String(body.seller_org_id ?? '');
  const listingId = body.listing_id ? String(body.listing_id) : null;
  const wantedId = body.wanted_request_id ? String(body.wanted_request_id) : null;

  if (!sellerOrgId) return json({ error: '売り手組織IDが必要です' }, 400);

  const admin = createSupabaseAdminClient(locals as never);

  const { data, error } = await admin
    .from('mediation_agreements')
    .insert({
      listing_id: listingId,
      wanted_request_id: wantedId,
      seller_org_id: sellerOrgId,
      commission_rate: 0.075,
      terms: body.terms ? String(body.terms) : '仲介手数料：成約額の7.5%（税別）',
      status: 'sent',
    })
    .select('id')
    .single();

  if (error) return json({ error: error.message }, 400);
  return json({ success: true, id: data.id });
};
