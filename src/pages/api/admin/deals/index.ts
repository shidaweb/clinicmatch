import type { APIRoute } from 'astro';
import { requireAdmin } from '~/lib/auth';
import { createSupabaseAdminClient } from '~/lib/supabase/server';
import { calcCommission } from '~/lib/deals';

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
  const mediationId = String(body.mediation_agreement_id ?? '');
  const buyerOrgId = String(body.buyer_org_id ?? '');
  const sellerOrgId = String(body.seller_org_id ?? '');
  const agreedPrice = Number(body.agreed_price);

  if (!mediationId || !buyerOrgId || !sellerOrgId || !agreedPrice) {
    return json({ error: '仲介契約ID・買い手・売り手・成約額は必須です' }, 400);
  }

  const admin = createSupabaseAdminClient(locals as never);

  const { data: mediation } = await admin
    .from('mediation_agreements')
    .select('id, status, commission_rate')
    .eq('id', mediationId)
    .single();

  if (!mediation || mediation.status !== 'signed') {
    return json({ error: '仲介契約が成立していません（signed 必須）' }, 400);
  }

  const rate = Number(mediation.commission_rate) || 0.075;

  const { data, error } = await admin
    .from('deals')
    .insert({
      mediation_agreement_id: mediationId,
      buyer_org_id: buyerOrgId,
      seller_org_id: sellerOrgId,
      agreed_price: agreedPrice,
      commission_amount: calcCommission(agreedPrice, rate),
      contract_template_key: body.contract_template_key ? String(body.contract_template_key) : 'maintenance_unknown',
      contract_status: 'sent',
      status: 'negotiating',
    })
    .select('id')
    .single();

  if (error) return json({ error: error.message }, 400);
  return json({ success: true, id: data.id });
};
