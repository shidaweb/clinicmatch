import type { SupabaseClient } from '@supabase/supabase-js';
import { sendAdminEmail, sendUserEmail } from '~/lib/notifications';
import { getUserEmail } from './recipients';
import { getSiteUrl, formatListingTitle, formatWantedTitle } from './helpers';
import * as emailTemplates from './templates';

type RuntimeLocals = {
  runtime?: {
    env?: Record<string, string | undefined>;
  };
};

export async function notifyListingSubmission(
  admin: SupabaseClient,
  locals: RuntimeLocals | undefined,
  params: { id: string; maker: string; model: string; orgId: string; userId: string }
) {
  const siteUrl = getSiteUrl(locals);
  const title = formatListingTitle(params.maker, params.model);

  const actorEmail = await getUserEmail(admin, params.userId);
  if (actorEmail) {
    const t = emailTemplates.submissionToActor(siteUrl, { type: 'listing', title });
    await sendUserEmail(actorEmail, t.subject, t.html, locals);
  }

  const a = emailTemplates.submissionToAdmin({
    type: 'listing',
    id: params.id,
    title,
    orgId: params.orgId,
    adminUrl: `${siteUrl}/admin/posts`,
  });
  await sendAdminEmail(a.subject, a.html, locals);
}

export async function notifyWantedSubmission(
  admin: SupabaseClient,
  locals: RuntimeLocals | undefined,
  params: {
    id: string;
    maker: string | null;
    model: string | null;
    category: string;
    orgId: string;
    userId: string;
  }
) {
  const siteUrl = getSiteUrl(locals);
  const title = formatWantedTitle(params.maker, params.model, params.category);

  const actorEmail = await getUserEmail(admin, params.userId);
  if (actorEmail) {
    const t = emailTemplates.submissionToActor(siteUrl, { type: 'wanted', title });
    await sendUserEmail(actorEmail, t.subject, t.html, locals);
  }

  const a = emailTemplates.submissionToAdmin({
    type: 'wanted',
    id: params.id,
    title,
    orgId: params.orgId,
    adminUrl: `${siteUrl}/admin/posts`,
  });
  await sendAdminEmail(a.subject, a.html, locals);
}

export async function notifyPostPublished(
  admin: SupabaseClient,
  locals: RuntimeLocals | undefined,
  params: {
    type: 'listing' | 'wanted';
    id: string;
    title: string;
    orgId: string;
  }
) {
  const siteUrl = getSiteUrl(locals);
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('org_id', params.orgId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!profile) return;

  const email = await getUserEmail(admin, profile.id);
  if (!email) return;

  const t = emailTemplates.postPublishedToApplicant(siteUrl, {
    type: params.type,
    title: params.title,
    id: params.id,
  });
  await sendUserEmail(email, t.subject, t.html, locals);
}
