import type { APIRoute } from 'astro';
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

function buildListingPatchPayload(
  body: Record<string, unknown>,
  org: { prefecture?: string; city?: string } | null
) {
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

  const body = (await request.json()) as Record<string, unknown>;
  const org = profile.organizations as { prefecture?: string; city?: string; verified_at?: string | null } | null;
  const payload = buildListingPatchPayload(body, org);
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
    .single();

  if (!existing || existing.seller_org_id !== profile.org_id) {
    return json({ error: '出品が見つかりません' }, 404);
  }
  if (existing.status === 'published') {
    return json({ error: '公開中の出品は編集できません。運営にお問い合わせください。' }, 400);
  }

  const submit = body.submit === true || body.submit === 'true';
  const mergedListingKind = parseListingKind(payload.listing_kind ?? existing.listing_kind);
  const mergedMasterId = String(payload.consumable_master_id ?? existing.consumable_master_id ?? '');
  const mergedOpenState = (payload.open_state ?? existing.open_state) as 'sealed' | 'opened' | 'used' | null;
  const mergedExpiry = (payload.expiry_date ?? existing.expiry_date) as string | null;
  const mergedShots = (payload.remaining_shots ?? existing.remaining_shots) as number | null;
  const mergedMaker = String(payload.maker ?? existing.maker ?? '');
  const mergedModel = String(payload.model ?? existing.model ?? '');
  const mergedCategory = String(payload.category_slug ?? existing.category_slug ?? '');

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

  const { error } = await supabase.from('listings').update(payload).eq('id', id);
  if (error) return json({ error: error.message }, 400);

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

export const POST: APIRoute = async ({ params, request, cookies, locals }) => {
  const profile = await getProfile(cookies, locals as never);
  if (!profile) return json({ error: 'ログインが必要です' }, 401);

  const listingId = params.id;
  if (!listingId) return json({ error: 'IDが必要です' }, 400);

  const supabase = createSupabaseServerClient(cookies, locals as never);
  const { data: listing } = await supabase
    .from('listings')
    .select('id, seller_org_id, status')
    .eq('id', listingId)
    .single();

  if (!listing || listing.seller_org_id !== profile.org_id) {
    return json({ error: '出品が見つかりません' }, 404);
  }
  if (listing.status === 'published') {
    return json({ error: '公開中の出品には画像を追加できません。運営にお問い合わせください。' }, 400);
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File) || !file.size) {
    return json({ error: '画像ファイルが必要です' }, 400);
  }
  if (file.size > 8 * 1024 * 1024) {
    return json({ error: '画像サイズは8MB以下にしてください' }, 400);
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const allowed = ['jpg', 'jpeg', 'png', 'webp'];
  if (!allowed.includes(ext)) return json({ error: 'JPEG/PNG/WebP のみ対応しています' }, 400);

  const storagePath = `${listingId}/${Date.now()}.${ext}`;
  const buffer = new Uint8Array(await file.arrayBuffer());

  const admin = createSupabaseAdminClient(locals as never);
  const { error: uploadError } = await admin.storage
    .from('listing-images')
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) return json({ error: uploadError.message }, 400);

  const { count } = await supabase
    .from('listing_images')
    .select('*', { count: 'exact', head: true })
    .eq('listing_id', listingId);

  if ((count ?? 0) >= 10) {
    return json({ error: '画像は最大10枚までです' }, 400);
  }

  const isCover = (count ?? 0) === 0;

  const { data: imageRow, error: dbError } = await supabase
    .from('listing_images')
    .insert({
      listing_id: listingId,
      storage_path: storagePath,
      sort_order: count ?? 0,
      is_cover: isCover,
    })
    .select('id, storage_path, is_cover')
    .single();

  if (dbError) {
    await admin.storage.from('listing-images').remove([storagePath]);
    return json({ error: dbError.message }, 400);
  }

  return json({ success: true, image: imageRow });
};

export const DELETE: APIRoute = async ({ params, cookies, locals }) => {
  const profile = await getProfile(cookies, locals as never);
  if (!profile) return json({ error: 'ログインが必要です' }, 401);

  const listingId = params.id;
  if (!listingId) return json({ error: 'IDが必要です' }, 400);

  const supabase = createSupabaseServerClient(cookies, locals as never);
  const admin = createSupabaseAdminClient(locals as never);

  const { data: listing } = await supabase
    .from('listings')
    .select('id, seller_org_id, status')
    .eq('id', listingId)
    .single();

  if (!listing || listing.seller_org_id !== profile.org_id) {
    return json({ error: '出品が見つかりません' }, 404);
  }
  if (listing.status === 'published') {
    return json({ error: '公開中の出品は削除できません。運営にお問い合わせください。' }, 400);
  }

  const { data: images, error: imageError } = await supabase
    .from('listing_images')
    .select('storage_path')
    .eq('listing_id', listingId);
  if (imageError) return json({ error: imageError.message }, 400);

  const storagePaths = (images ?? [])
    .map((img) => img.storage_path)
    .filter((path): path is string => Boolean(path));
  if (storagePaths.length > 0) {
    await admin.storage.from('listing-images').remove(storagePaths);
  }

  // 注意: listings テーブルには delete の RLS ポリシーがなく、ユーザークライアントで
  // delete すると「0行削除」のまま成功扱いになり、一覧に復活して見えるバグがあった。
  // 所有権・ステータスは上で検証済みのため、削除は admin クライアントで確実に実行し、
  // 実際に削除された行数を検証する。
  const { data: deletedRows, error: deleteError } = await admin
    .from('listings')
    .delete()
    .eq('id', listingId)
    .eq('seller_org_id', profile.org_id)
    .neq('status', 'published')
    .select('id');
  if (deleteError) return json({ error: deleteError.message }, 400);
  if (!deletedRows || deletedRows.length === 0) {
    return json({ error: '削除できませんでした。時間をおいて再度お試しください。' }, 409);
  }

  return json({ success: true, id: listingId });
};
