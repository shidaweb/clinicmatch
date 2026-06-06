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

export const POST: APIRoute = async ({ params, cookies, locals }) => {
  const { error: authError } = await requireAdmin(cookies, locals as never);
  if (authError) return json({ error: '権限がありません' }, authError === 'unauthorized' ? 401 : 403);

  const invoiceId = params.id;
  if (!invoiceId) return json({ error: 'IDが必要です' }, 400);

  const admin = createSupabaseAdminClient(locals as never);
  const { error } = await admin
    .from('commission_invoices')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', invoiceId);

  if (error) return json({ error: error.message }, 400);
  return json({ success: true });
};
