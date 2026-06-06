import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '~/lib/supabase/server';
import { getProfile } from '~/lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const profile = await getProfile(cookies, locals as never);
  if (!profile) return json({ error: 'ログインが必要です' }, 401);

  const body = (await request.json()) as Record<string, unknown>;
  const supabase = createSupabaseServerClient(cookies, locals as never);

  const org = profile.organizations as { prefecture?: string; city?: string } | null;

  const payload = {
    seller_org_id: profile.org_id,
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
    status: body.submit === true || body.submit === 'true' ? 'pending_review' : 'draft',
  };

  if (!payload.category_slug || !payload.maker || !payload.model) {
    return json({ error: 'カテゴリ・メーカー・型番は必須です' }, 400);
  }

  const { data, error } = await supabase.from('listings').insert(payload).select('id').single();
  if (error) return json({ error: error.message }, 400);

  return json({ success: true, id: data.id });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
