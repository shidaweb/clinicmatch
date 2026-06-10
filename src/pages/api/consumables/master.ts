import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '~/lib/supabase/server';

export const prerender = false;

type MasterRow = {
  id: string;
  category_slug: string;
  maker: string;
  model: string;
  name: string;
  item_type: string;
  contact_level: string;
  is_sterile_sud: boolean;
  is_shot_controlled: boolean;
  has_expiry: boolean;
  prohibit_reuse: boolean;
  shipping_flags: string[] | null;
  requires_manual_review: boolean;
  is_active: boolean;
};

export const GET: APIRoute = async ({ cookies, locals, url }) => {
  const supabase = createSupabaseServerClient(cookies, locals as never);
  const category = url.searchParams.get('category')?.trim() ?? '';
  const maker = url.searchParams.get('maker')?.trim() ?? '';
  const model = url.searchParams.get('model')?.trim() ?? '';

  let query = supabase
    .from('consumable_master')
    .select(
      'id, category_slug, maker, model, name, item_type, contact_level, is_sterile_sud, is_shot_controlled, has_expiry, prohibit_reuse, shipping_flags, requires_manual_review, is_active'
    )
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (category) query = query.eq('category_slug', category);
  if (maker) query = query.eq('maker', maker);
  if (model) query = query.eq('model', model);

  const { data, error } = await query.limit(100);
  if (error) return json({ error: error.message }, 400);

  return json({ items: (data ?? []) as MasterRow[] });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
