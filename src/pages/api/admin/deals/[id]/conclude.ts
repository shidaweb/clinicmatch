import type { APIRoute } from 'astro';
import { requireAdmin } from '~/lib/auth';
import { createSupabaseAdminClient } from '~/lib/supabase/server';
import { sendAdminEmail, sendUserEmail } from '~/lib/notifications';
import { getOrgPrimaryEmail } from '~/lib/emails/recipients';
import { getSiteUrl } from '~/lib/emails/helpers';
import * as emailTemplates from '~/lib/emails/templates';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Conclude deal → triggers commission invoice via DB trigger */
export const POST: APIRoute = async ({ params, cookies, locals }) => {
  const { error: authError } = await requireAdmin(cookies, locals as never);
  if (authError === 'unauthorized') return json({ error: 'ログインが必要です' }, 401);
  if (authError === 'forbidden') return json({ error: '権限がありません' }, 403);

  const dealId = params.id;
  if (!dealId) return json({ error: 'deal IDが必要です' }, 400);

  const admin = createSupabaseAdminClient(locals as never);
  const now = new Date().toISOString();

  const { data: deal, error } = await admin
    .from('deals')
    .update({
      status: 'contracted',
      contract_status: 'signed',
      concluded_at: now,
    })
    .eq('id', dealId)
    .eq('status', 'negotiating')
    .select('id, agreed_price, commission_amount, seller_org_id, buyer_org_id')
    .single();

  if (error || !deal) return json({ error: error?.message ?? '成約処理に失敗しました' }, 400);

  const { data: invoice } = await admin
    .from('commission_invoices')
    .select('id, amount')
    .eq('deal_id', dealId)
    .maybeSingle();

  const commissionAmount = invoice?.amount ?? deal.commission_amount ?? 0;
  const agreedPrice = deal.agreed_price ?? 0;
  const siteUrl = getSiteUrl(locals as never);

  const sellerEmail = await getOrgPrimaryEmail(admin, deal.seller_org_id);
  if (sellerEmail) {
    const t = emailTemplates.concludeToSeller(siteUrl, {
      dealId,
      agreedPrice,
      commissionAmount,
    });
    await sendUserEmail(sellerEmail, t.subject, t.html, locals as never);
  }

  const buyerEmail = await getOrgPrimaryEmail(admin, deal.buyer_org_id);
  if (buyerEmail) {
    const t = emailTemplates.concludeToBuyer(siteUrl);
    await sendUserEmail(buyerEmail, t.subject, t.html, locals as never);
  }

  const a = emailTemplates.concludeToAdmin({
    dealId,
    agreedPrice,
    commissionAmount,
    adminUrl: `${siteUrl}/admin/deals`,
  });
  await sendAdminEmail(a.subject, a.html, locals as never);

  return json({ success: true, deal, invoice });
};
