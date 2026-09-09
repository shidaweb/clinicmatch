import type { APIRoute } from 'astro';
import { requireAdmin } from '~/lib/auth';
import { createSupabaseAdminClient } from '~/lib/supabase/server';
import { renderContractPreview } from '~/lib/contracts';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const { error: authError } = await requireAdmin(cookies, locals as never);
  if (authError) return json({ error: '権限がありません' }, authError === 'unauthorized' ? 401 : 403);

  const body = (await request.json()) as Record<string, unknown>;
  const dealId = String(body.deal_id ?? '');

  if (!dealId) return json({ error: 'deal_id が必要です' }, 400);

  const admin = createSupabaseAdminClient(locals as never);
  const { data: deal } = await admin.from('deals').select('*').eq('id', dealId).single();
  if (!deal) return json({ error: 'deal が見つかりません' }, 404);

  const { data: mediation } = await admin
    .from('mediation_agreements')
    .select('listing_id')
    .eq('id', deal.mediation_agreement_id)
    .single();

  let listing: {
    maker?: string;
    model?: string;
    maker_maintenance?: string;
    maintenance_transferable?: string;
    has_accessories?: boolean;
    accessories_detail?: string;
  } | null = null;
  if (mediation?.listing_id) {
    const { data } = await admin.from('listings').select('*').eq('id', mediation.listing_id).single();
    listing = data;
  }

  const [{ data: sellerOrg }, { data: buyerOrg }] = await Promise.all([
    admin.from('organizations').select('prefecture, city').eq('id', deal.seller_org_id).single(),
    admin.from('organizations').select('prefecture, city').eq('id', deal.buyer_org_id).single(),
  ]);

  const text = renderContractPreview(deal.contract_template_key ?? 'maintenance_unknown', {
    maker: listing?.maker ?? '（機器名）',
    model: listing?.model ?? '',
    agreedPrice: deal.agreed_price,
    makerMaintenance: listing?.maker_maintenance,
    maintenanceTransferable: listing?.maintenance_transferable,
    hasAccessories: listing?.has_accessories,
    accessoriesDetail: listing?.accessories_detail,
    sellerPrefecture: sellerOrg?.prefecture,
    sellerCity: sellerOrg?.city,
    buyerPrefecture: buyerOrg?.prefecture,
    buyerCity: buyerOrg?.city,
  });

  return json({ preview: text });
};
