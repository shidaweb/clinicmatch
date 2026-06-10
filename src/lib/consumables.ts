export const LISTING_KINDS = ['device', 'consumable_valid', 'consumable_expired'] as const;
export const CLINICAL_USE = ['patient_ok', 'training_only'] as const;
export const OPEN_STATES = ['sealed', 'opened', 'used'] as const;

export type ListingKind = (typeof LISTING_KINDS)[number];
export type ClinicalUse = (typeof CLINICAL_USE)[number];
export type OpenState = (typeof OPEN_STATES)[number];

export type ConsumableMasterRow = {
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

export type ConsumableClassifyInput = {
  listingKind: ListingKind;
  openState: OpenState | null;
  expiryDate: string | null;
  remainingShots: number | null;
};

export function parseListingKind(value: unknown): ListingKind {
  return LISTING_KINDS.includes(value as ListingKind) ? (value as ListingKind) : 'device';
}

export function parseOpenState(value: unknown): OpenState | null {
  if (!value) return null;
  return OPEN_STATES.includes(value as OpenState) ? (value as OpenState) : null;
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const dt = new Date(`${value}T00:00:00+09:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function startOfTodayJst(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function classifyConsumable(master: ConsumableMasterRow, input: ConsumableClassifyInput) {
  let listingKind = input.listingKind;
  let clinicalUse: ClinicalUse = 'patient_ok';
  const reasons: string[] = [];
  const today = startOfTodayJst();
  const expiry = parseDate(input.expiryDate);

  const expired = !!(master.has_expiry && expiry && expiry < today);
  const shotEmpty = !!(master.is_shot_controlled && (input.remainingShots ?? 0) <= 0);
  const openedSensitive = !!(
    (master.is_sterile_sud || master.is_shot_controlled) &&
    (input.openState === 'opened' || input.openState === 'used')
  );

  if (listingKind === 'consumable_expired') {
    clinicalUse = 'training_only';
    reasons.push('期限切れ・研修用カテゴリのため');
  }
  if (expired) reasons.push('有効期限を過ぎているため');
  if (shotEmpty) reasons.push('残ショットが0のため');
  if (openedSensitive) reasons.push('開封済み/使用済みのため');

  if (expired || shotEmpty || openedSensitive) clinicalUse = 'training_only';

  if (clinicalUse === 'training_only' && listingKind !== 'device') {
    listingKind = 'consumable_expired';
  }

  return {
    listingKind,
    clinicalUse,
    reasons,
    expired,
    shotEmpty,
    openedSensitive,
  };
}

const REUSE_BLOCK_KEYWORDS = [
  'リセット',
  'ショット復活',
  '改造',
  '非純正改造',
  '再生チップ',
  '再利用チップ',
];

export function hasReuseBlockedKeyword(text: string): boolean {
  return REUSE_BLOCK_KEYWORDS.some((keyword) => text.includes(keyword));
}

export function validateConsumableSubmission(args: {
  master: ConsumableMasterRow;
  listingKind: ListingKind;
  openState: OpenState | null;
  expiryDate: string | null;
  remainingShots: number | null;
  reuseAttestation: boolean;
  searchText: string;
}) {
  const errors: string[] = [];
  const { master, listingKind, openState, expiryDate, remainingShots, reuseAttestation, searchText } = args;
  const classify = classifyConsumable(master, { listingKind, openState, expiryDate, remainingShots });

  if (master.has_expiry && !expiryDate) errors.push('この消耗品は有効期限が必須です。');
  if (master.is_shot_controlled && (remainingShots == null || Number.isNaN(remainingShots))) {
    errors.push('この消耗品は残ショット数が必須です。');
  }
  if (remainingShots != null && remainingShots < 0) errors.push('残ショット数は0以上で入力してください。');

  if (master.prohibit_reuse && !reuseAttestation) {
    errors.push('再利用/改造品ではない確認が必要です。');
  }
  if (master.prohibit_reuse && hasReuseBlockedKeyword(searchText)) {
    errors.push('再利用や改造を示唆する文言は登録できません。');
  }

  if (
    listingKind === 'consumable_valid' &&
    (classify.expired || classify.shotEmpty || classify.openedSensitive)
  ) {
    errors.push('期限内の消耗品としては登録できません。期限切れ・研修用で登録してください。');
  }

  return { errors, classify };
}
