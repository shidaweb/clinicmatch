import type { APIRoute } from 'astro';
import { requireAdmin } from '~/lib/auth';
import { createSupabaseAdminClient } from '~/lib/supabase/server';
import { sendAdminEmail, escapeHtml } from '~/lib/notifications';

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
    .select('id, agreed_price, commission_amount, seller_org_id')
    .single();

  if (error || !deal) return json({ error: error?.message ?? '成約処理に失敗しました' }, 400);

  const { data: invoice } = await admin
    .from('commission_invoices')
    .select('id, amount')
    .eq('deal_id', dealId)
    .maybeSingle();

  await sendAdminEmail(
    '【クリニックマッチ】売買成約・手数料請求発行',
    `<p>Deal: ${escapeHtml(dealId)}</p>
     <p>成約額: ${deal.agreed_price?.toLocaleString()}円</p>
     <p>手数料(7.5%): ${(invoice?.amount ?? deal.commission_amount)?.toLocaleString()}円</p>`,
    locals as never
  );

  return json({ success: true, deal, invoice });
};
