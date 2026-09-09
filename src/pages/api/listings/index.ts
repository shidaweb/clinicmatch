import type { APIRoute } from 'astro';
import { readObject } from '~/lib/http';
import { createPostOnce } from '~/lib/post-creation';
import { createSupabaseAdminClient, createSupabaseServerClient } from '~/lib/supabase/server';
import { getProfile } from '~/lib/auth';
import { notifyListingSubmission } from '~/lib/emails/notify-submission';
import {
  parseListingKind,
  parseOpenState,
  validateConsumableSubmission,
  type ConsumableMasterRow,
} from '~/lib/consumables';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const profile = await getProfile(cookies, locals as never);
  if (!profile) return json({ error: 'ログインが必要です' }, 401);

  const body = await readObject(request);
  if (!body) return json({ error: '入力内容の形式が不正です' }, 400);
  for (const key of ['asking_price', 'budget', 'quantity', 'manufacture_year', 'min_remaining_shots']) {
    const value = body[key];
    if (
      value != null &&
      value !== '' &&
      (!Number.isFinite(Number(value)) || Number(value) < 0 || !Number.isInteger(Number(value)))
    ) {
      return json({ error: '価格・予算・数量は0以上の整数で入力してください' }, 400);
    }
  }

  const supabase = createSupabaseServerClient(cookies, locals as never);

  const org = profile.organizations as { prefecture?: string; city?: string; verified_at?: string | null } | null;
  const listingKind = parseListingKind(body.listing_kind);
  const submit = body.submit === true || body.submit === 'true';

  const payload: Record<string, unknown> = {
    seller_org_id: profile.org_id,
    submitted_by: profile.id,
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
    listing_kind: listingKind,
    quantity: Number(body.quantity ?? 1) > 0 ? Number(body.quantity ?? 1) : 1,
    open_state: parseOpenState(body.open_state),
    expiry_date: body.expiry_date ? String(body.expiry_date) : null,
    remaining_shots: body.remaining_shots === '' || body.remaining_shots == null ? null : Number(body.remaining_shots),
    remaining_life: body.remaining_life ? String(body.remaining_life).trim() : null,
    lot_number: body.lot_number ? String(body.lot_number).trim() : null,
    condition_note: body.condition_note ? String(body.condition_note).trim() : null,
    negotiable: body.negotiable === true || body.negotiable === 'true',
    reuse_attestation: body.reuse_attestation === true || body.reuse_attestation === 'true',
    status: submit ? 'pending_review' : 'draft',
  };

  if (!payload.category_slug || !payload.maker || !payload.model) {
    return json({ error: 'カテゴリ・メーカー・機種名は必須です' }, 400);
  }
  if (
    payload.remaining_shots != null &&
    (Number.isNaN(payload.remaining_shots as number) || Number(payload.remaining_shots) < 0)
  ) {
    return json({ error: '残ショット数は0以上で入力してください' }, 400);
  }
  if (listingKind !== 'device' && submit && !org?.verified_at) {
    return json({ error: '消耗品を審査提出するには法人確認が必要です。設定画面から運営へお問い合わせください。' }, 400);
  }

  if (listingKind !== 'device') {
    const consumableMasterId = String(body.consumable_master_id ?? '');
    if (!consumableMasterId) return json({ error: '消耗品マスタの選択が必要です' }, 400);
    const { data: master, error: masterError } = await supabase
      .from('consumable_master')
      .select(
        'id, category_slug, maker, model, name, item_type, contact_level, is_sterile_sud, is_shot_controlled, has_expiry, prohibit_reuse, shipping_flags, requires_manual_review, is_active'
      )
      .eq('id', consumableMasterId)
      .eq('is_active', true)
      .single();
    if (masterError || !master) return json({ error: '消耗品マスタが見つかりません' }, 400);
    if (master.category_slug !== payload.category_slug) {
      return json({ error: 'カテゴリと消耗品マスタの組み合わせが一致しません' }, 400);
    }

    const masterRow = master as ConsumableMasterRow;
    const { errors, classify } = validateConsumableSubmission({
      master: masterRow,
      listingKind,
      openState: payload.open_state as 'sealed' | 'opened' | 'used' | null,
      expiryDate: payload.expiry_date as string | null,
      remainingShots: payload.remaining_shots as number | null,
      reuseAttestation: Boolean(payload.reuse_attestation),
      searchText: [payload.maker, payload.model, payload.description, payload.condition_note]
        .map((v) => String(v ?? ''))
        .join(' '),
    });
    if (errors.length > 0) return json({ error: errors[0] }, 400);

    payload.consumable_master_id = master.id;
    payload.listing_kind = classify.listingKind;
    payload.clinical_use = classify.clinicalUse;
    payload.shipping_flags = master.shipping_flags ?? [];
    payload.compliance_note =
      classify.reasons.length > 0
        ? `自動補正: ${classify.reasons.join(' / ')}`
        : master.requires_manual_review
          ? '自動判定: 手動審査対象'
          : null;
  } else {
    payload.consumable_master_id = null;
    payload.open_state = null;
    payload.expiry_date = null;
    payload.remaining_shots = null;
    payload.remaining_life = null;
    payload.lot_number = null;
    payload.reuse_attestation = null;
    payload.clinical_use = 'patient_ok';
    payload.shipping_flags = [];
    payload.compliance_note = null;
  }

  const admin = createSupabaseAdminClient(locals as never);
  const created = await createPostOnce(admin, request, 'listings', profile.id, payload);
  if (created.response) return created.response;
  const data = { id: created.id! };

  if (payload.status === 'pending_review' && !created.duplicate) {
    const admin = createSupabaseAdminClient(locals as never);
    await notifyListingSubmission(admin, locals as never, {
      id: data.id,
      maker: String(payload.maker),
      model: String(payload.model),
      orgId: profile.org_id,
      userId: profile.id,
    });
  }

  return json({ success: true, id: data.id });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
