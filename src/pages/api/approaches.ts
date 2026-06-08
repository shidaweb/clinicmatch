import type { APIRoute } from 'astro';
import { createSupabaseAdminClient, createSupabaseServerClient } from '~/lib/supabase/server';
import { getProfile } from '~/lib/auth';
import { sendAdminEmail, sendUserEmail } from '~/lib/notifications';
import { getUserEmail, getOrgPrimaryEmail } from '~/lib/emails/recipients';
import {
  getSiteUrl,
  formatAnonArea,
  formatListingTitle,
  formatWantedTitle,
} from '~/lib/emails/helpers';
import * as emailTemplates from '~/lib/emails/templates';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const profile = await getProfile(cookies, locals as never);
  if (!profile) return json({ error: 'ログインが必要です' }, 401);

  const body = (await request.json()) as Record<string, unknown>;
  const kind = body.kind as string;

  if (!['interest', 'offer'].includes(kind)) {
    return json({ error: '不正なアプローチ種別です' }, 400);
  }

  const supabase = createSupabaseServerClient(cookies, locals as never);

  const payload = {
    kind,
    listing_id: kind === 'interest' ? String(body.listing_id ?? '') : null,
    wanted_request_id: kind === 'offer' ? String(body.wanted_request_id ?? '') : null,
    from_org_id: profile.org_id,
    from_user_id: profile.id,
    budget: body.budget ? Number(body.budget) : null,
    price: body.price ? Number(body.price) : null,
    message: body.message ? String(body.message) : null,
    status: 'new',
  };

  if (kind === 'interest' && !payload.listing_id) return json({ error: '出品IDが必要です' }, 400);
  if (kind === 'offer' && !payload.wanted_request_id) return json({ error: '買いたいIDが必要です' }, 400);

  const { data, error } = await supabase.from('approaches').insert(payload).select('id').single();
  if (error) return json({ error: error.message }, 400);

  const admin = createSupabaseAdminClient(locals as never);
  const siteUrl = getSiteUrl(locals as never);
  const adminUrl = `${siteUrl}/admin/approaches`;

  if (kind === 'interest' && payload.listing_id) {
    const { data: listing } = await admin
      .from('listings')
      .select('id, maker, model, category_slug, location_city, seller_org_id, categories(name)')
      .eq('id', payload.listing_id)
      .single();

    if (listing) {
      const category =
        (listing.categories as { name?: string } | null)?.name ?? listing.category_slug;
      const title = formatListingTitle(listing.maker, listing.model);
      const area = formatAnonArea(listing.location_city);

      const actorEmail = await getUserEmail(admin, profile.id);
      if (actorEmail) {
        const t = emailTemplates.interestToBuyer(siteUrl, { listingTitle: title });
        await sendUserEmail(actorEmail, t.subject, t.html, locals as never);
      }

      const sellerEmail = await getOrgPrimaryEmail(admin, listing.seller_org_id);
      if (sellerEmail) {
        const t = emailTemplates.interestToSeller(siteUrl, { listingTitle: title, category, area });
        await sendUserEmail(sellerEmail, t.subject, t.html, locals as never);
      }

      const a = emailTemplates.interestToAdmin({
        approachId: data.id,
        listingId: listing.id,
        fromOrgId: profile.org_id,
        listingTitle: title,
        category,
        area,
        message: payload.message ?? undefined,
        adminUrl,
      });
      await sendAdminEmail(a.subject, a.html, locals as never);
    }
  } else if (kind === 'offer' && payload.wanted_request_id) {
    const { data: wanted } = await admin
      .from('wanted_requests')
      .select('id, maker, model, category_slug, area_city, buyer_org_id, categories(name)')
      .eq('id', payload.wanted_request_id)
      .single();

    if (wanted) {
      const category =
        (wanted.categories as { name?: string } | null)?.name ?? wanted.category_slug;
      const title = formatWantedTitle(wanted.maker, wanted.model, category);
      const area = wanted.area_city ? formatAnonArea(wanted.area_city) : '指定エリアの医療機関';

      const actorEmail = await getUserEmail(admin, profile.id);
      if (actorEmail) {
        const t = emailTemplates.offerToSeller(siteUrl, { wantedTitle: title });
        await sendUserEmail(actorEmail, t.subject, t.html, locals as never);
      }

      const buyerEmail = await getOrgPrimaryEmail(admin, wanted.buyer_org_id);
      if (buyerEmail) {
        const t = emailTemplates.offerToBuyer(siteUrl, { wantedTitle: title, category, area });
        await sendUserEmail(buyerEmail, t.subject, t.html, locals as never);
      }

      const a = emailTemplates.offerToAdmin({
        approachId: data.id,
        wantedId: wanted.id,
        fromOrgId: profile.org_id,
        wantedTitle: title,
        category,
        area,
        message: payload.message ?? undefined,
        adminUrl,
      });
      await sendAdminEmail(a.subject, a.html, locals as never);
    }
  }

  return json({ success: true, id: data.id });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
