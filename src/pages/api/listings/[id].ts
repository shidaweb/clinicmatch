import type { APIRoute } from 'astro';
import { readObject } from '~/lib/http';
import { uploadPostImage } from '~/lib/post-media';
import { getProfile } from '~/lib/auth';
import { createSupabaseServerClient, createSupabaseAdminClient } from '~/lib/supabase/server';
import { notifyListingSubmission } from '~/lib/emails/notify-submission';
import {
  classifyConsumable,
  parseListingKind,
  parseOpenState,
  validateConsumableSubmission,
  type ConsumableMasterRow,
} from '~/lib/consumables';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function buildListingPatchPayload(body: Record<string, unknown>, org: { prefecture?: string; city?: string } | null) {
  const payload: Record<string, unknown> = {};

  if ('category_slug' in body) payload.category_slug = String(body.category_slug ?? '');
  if ('maker' in body) payload.maker = String(body.maker ?? '').trim();
  if ('model' in body) payload.model = String(body.model ?? '').trim();
  if ('manufacture_year' in body) {
    payload.manufacture_year = body.manufacture_year ? Number(body.manufacture_year) : null;
  }
  if ('condition' in body) payload.condition = body.condition ? String(body.condition) : null;
  if ('asking_price' in body) payload.asking_price = body.asking_price ? Number(body.asking_price) : null;
  if ('location_prefecture' in body) {
    payload.location_prefecture = String(body.location_prefecture ?? org?.prefecture ?? '');
  }
  if ('location_city' in body) payload.location_city = String(body.location_city ?? org?.city ?? '');
  if ('has_accessories' in body) {
    payload.has_accessories = body.has_accessories === true || body.has_accessories === 'true';
  }
  if ('accessories_detail' in body) {
    payload.accessories_detail = body.accessories_detail ? String(body.accessories_detail) : null;
  }
  if ('maker_maintenance' in body) payload.maker_maintenance = body.maker_maintenance ?? 'unknown';
  if ('maintenance_transferable' in body) {
    payload.maintenance_transferable = body.maintenance_transferable ?? 'unknown';
  }
  if ('maintenance_notes' in body) {
    payload.maintenance_notes = body.maintenance_notes ? String(body.maintenance_notes) : null;
  }
  if ('description' in body) payload.description = body.description ? String(body.description) : null;
  if ('listing_kind' in body) payload.listing_kind = parseListingKind(body.listing_kind);
  if ('consumable_master_id' in body) {
    payload.consumable_master_id = body.consumable_master_id ? String(body.consumable_master_id) : null;
  }
  if ('quantity' in body) payload.quantity = body.quantity ? Number(body.quantity) : 1;
  if ('open_state' in body) payload.open_state = parseOpenState(body.open_state);
  if ('expiry_date' in body) payload.expiry_date = body.expiry_date ? String(body.expiry_date) : null;
  if ('remaining_shots' in body) {
    payload.remaining_shots =
      body.remaining_shots === '' || body.remaining_shots == null ? null : Number(body.remaining_shots);
  }
  if ('remaining_life' in body) payload.remaining_life = body.remaining_life ? String(body.remaining_life) : null;
  if ('lot_number' in body) payload.lot_number = body.lot_number ? String(body.lot_number) : null;
  if ('condition_note' in body) payload.condition_note = body.condition_note ? String(body.condition_note) : null;
  if ('negotiable' in body) payload.negotiable = body.negotiable === true || body.negotiable === 'true';
  if ('reuse_attestation' in body) {
    payload.reuse_attestation = body.reuse_attestation === true || body.reuse_attestation === 'true';
  }
  if (body.submit === true || body.submit === 'true') payload.status = 'pending_review';

  return payload;
}

export const PATCH: APIRoute = async ({ params, request, cookies, locals }) => {
  const profile = await getProfile(cookies, locals as never);
  if (!profile) return json({ error: 'ログインが必要です' }, 401);

  const id = params.id;
  if (!id) return json({ error: 'IDが必要です' }, 400);

  const body = await readObject(request);
  if (!body) return json({ error: '入力内容の形式が不正です' }, 400);
  if (body.restore === true) {
    const admin = createSupabaseAdminClient(locals as never);
    const { data, error } = await admin
      .from('listings')
      .update({ archived_at: null })
      .eq('id', params.id!)
      .eq('seller_org_id', profile.org_id)
      .in('status', ['draft', 'rejected'])
      .not('archived_at', 'is', null)
      .select('id');
    return error || !data?.length ? json({ error: '復元できませんでした' }, 409) : json({ success: true });
  }
  const org = profile.organizations as { prefecture?: string; city?: string; verified_at?: string | null } | null;
  const payload = buildListingPatchPayload(body, org);
  for (const key of ['asking_price', 'budget', 'manufacture_year', 'quantity']) {
    if (
      key in payload &&
      payload[key] != null &&
      (!Number.isFinite(Number(payload[key])) || Number(payload[key]) < 0 || !Number.isInteger(Number(payload[key])))
    )
      return json({ error: '価格・数量は0以上の整数で入力してください' }, 400);
  }
  if (Object.keys(payload).length === 0) return json({ error: '更新する項目がありません' }, 400);
  if ('remaining_shots' in payload) {
    const shots = payload.remaining_shots as number | null;
    if (shots != null && (Number.isNaN(shots) || shots < 0)) {
      return json({ error: '残ショット数は0以上で入力してください' }, 400);
    }
  }
  if ('quantity' in payload) {
    const quantity = Number(payload.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return json({ error: '数量は1以上で入力してください' }, 400);
    }
  }

  const supabase = createSupabaseServerClient(cookies, locals as never);

  const { data: existing } = await supabase
    .from('listings')
    .select(
      'id, status, seller_org_id, category_slug, maker, model, listing_kind, consumable_master_id, open_state, expiry_date, remaining_shots'
    )
    .eq('id', id)
    .is('archived_at', null)
    .single();

  if (!existing || existing.seller_org_id !== profile.org_id) {
    return json({ error: '出品が見つかりません' }, 404);
  }
  if (!['draft', 'rejected'].includes(existing.status)) {
    return json({ error: '審査中・公開中・取引中の出品は編集できません。運営にお問い合わせください。' }, 400);
  }

  const submit = body.submit === true || body.submit === 'true';
  const mergedListingKind = parseListingKind(payload.listing_kind ?? existing.listing_kind);
  const mergedMasterId = String(
    (Object.hasOwn(payload, 'consumable_master_id') ? payload.consumable_master_id : existing.consumable_master_id) ??
      ''
  );
  const mergedOpenState = (Object.hasOwn(payload, 'open_state') ? payload.open_state : existing.open_state) as
    | 'sealed'
    | 'opened'
    | 'used'
    | null;
  const mergedExpiry = (Object.hasOwn(payload, 'expiry_date') ? payload.expiry_date : existing.expiry_date) as
    | string
    | null;
  const mergedShots = (
    Object.hasOwn(payload, 'remaining_shots') ? payload.remaining_shots : existing.remaining_shots
  ) as number | null;
  const mergedMaker = String(payload.maker ?? existing.maker ?? '');
  const mergedModel = String(payload.model ?? existing.model ?? '');
  const mergedCategory = String(payload.category_slug ?? existing.category_slug ?? '');

  if (!mergedMaker.trim() || !mergedModel.trim() || !mergedCategory)
    return json({ error: 'カテゴリ・メーカー・機種名は必須です' }, 400);

  if (mergedListingKind !== 'device' && submit && !org?.verified_at) {
    return json({ error: '消耗品を審査提出するには法人確認が必要です。設定画面から運営へお問い合わせください。' }, 400);
  }

  if (mergedListingKind !== 'device') {
    if (!mergedMasterId) return json({ error: '消耗品マスタの選択が必要です' }, 400);
    const { data: master, error: masterError } = await supabase
      .from('consumable_master')
      .select(
        'id, category_slug, maker, model, name, item_type, contact_level, is_sterile_sud, is_shot_controlled, has_expiry, prohibit_reuse, shipping_flags, requires_manual_review, is_active'
      )
      .eq('id', mergedMasterId)
      .eq('is_active', true)
      .single();
    if (masterError || !master) return json({ error: '消耗品マスタが見つかりません' }, 400);
    if (mergedCategory && master.category_slug !== mergedCategory) {
      return json({ error: 'カテゴリと消耗品マスタの組み合わせが一致しません' }, 400);
    }

    const masterRow = master as ConsumableMasterRow;
    const result = submit
      ? validateConsumableSubmission({
          master: masterRow,
          listingKind: mergedListingKind,
          openState: mergedOpenState,
          expiryDate: mergedExpiry,
          remainingShots: mergedShots,
          reuseAttestation: Boolean(payload.reuse_attestation),
          searchText: [mergedMaker, mergedModel, payload.description, payload.condition_note]
            .map((v) => String(v ?? ''))
            .join(' '),
        })
      : {
          errors: [],
          classify: classifyConsumable(masterRow, {
            listingKind: mergedListingKind,
            openState: mergedOpenState,
            expiryDate: mergedExpiry,
            remainingShots: mergedShots,
          }),
        };

    if (result.errors.length > 0) return json({ error: result.errors[0] }, 400);
    payload.consumable_master_id = master.id;
    payload.listing_kind = result.classify.listingKind;
    payload.clinical_use = result.classify.clinicalUse;
    payload.shipping_flags = master.shipping_flags ?? [];
    payload.compliance_note =
      result.classify.reasons.length > 0
        ? `自動補正: ${result.classify.reasons.join(' / ')}`
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

  const { data: updated, error } = await supabase
    .from('listings')
    .update(payload)
    .eq('id', id)
    .eq('status', existing.status)
    .is('archived_at', null)
    .select('id');
  if (error) return json({ error: error.message }, 400);

  if (!updated?.length) return json({ error: '状態が変更されました。再読み込みしてください' }, 409);

  if (payload.status === 'pending_review' && existing.status !== 'pending_review') {
    const admin = createSupabaseAdminClient(locals as never);
    await notifyListingSubmission(admin, locals as never, {
      id,
      maker: String(payload.maker ?? existing.maker),
      model: String(payload.model ?? existing.model),
      orgId: profile.org_id,
      userId: profile.id,
    });
  }

  return json({ success: true, id });
};

export const POST: APIRoute = uploadPostImage('listings');

export const DELETE: APIRoute = async ({ params, cookies, locals }) => {
  const profile = await getProfile(cookies, locals as never);
  if (!profile) return json({ error: 'ログインが必要です' }, 401);
  const admin = createSupabaseAdminClient(locals as never);
  const { data, error } = await admin
    .from('listings')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', params.id!)
    .eq('seller_org_id', profile.org_id)
    .in('status', ['draft', 'rejected'])
    .is('archived_at', null)
    .select('id');
  if (error) return json({ error: '保管できませんでした。投稿は削除していません。' }, 503);
  if (!data?.length) return json({ error: '下書き・差し戻しの投稿のみ保管できます。' }, 409);
  return json({ success: true, id: params.id });
};
