import type { SupabaseClient } from '@supabase/supabase-js';

export const SOURCES = ['consultations', 'listings', 'wanted_requests', 'approaches', 'threads'] as const;
export type Source = (typeof SOURCES)[number];
export const SOURCE_LABELS: Record<Source, string> = {
  consultations: '相談',
  listings: '売りたい',
  wanted_requests: '買いたい',
  approaches: 'アプローチ',
  threads: '仲介・Q&A',
};
export const CRM_STATUSES: Record<string, string> = {
  untriaged: '未整理',
  in_progress: '対応中',
  waiting: '相手の返信待ち',
  on_hold: '保留',
  completed: '完了',
};
export const ACTIVITY_LABELS: Record<string, string> = {
  note: '内部メモ',
  phone: '電話',
  email: 'メール',
  line: 'LINE',
  meeting: '面談',
  review: '審査記録',
};
export type Row = Record<string, unknown> & { id: string };
export const str = (value: unknown): string => (typeof value === 'string' ? value : '');
export function formatDate(value: unknown) {
  const date = new Date(str(value));
  return Number.isNaN(date.getTime())
    ? '未設定'
    : new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
}
export type CrmItem = {
  source: Source;
  id: string;
  title: string;
  organization: string;
  person: string;
  email: string;
  phone: string;
  contactSource: string;
  memberIds: string[];
  orgId: string;
  publication: string;
  createdAt: string;
  raw: Row;
  crm?: Row;
};
export type CrmData = { items: CrmItem[]; members: Row[]; orgs: Row[]; issues: string[]; writable: boolean };
const sourceFk: Record<Source, string> = {
  consultations: 'consultation_id',
  listings: 'listing_id',
  wanted_requests: 'wanted_id',
  approaches: 'approach_id',
  threads: 'thread_id',
};

async function readAll(admin: SupabaseClient, table: string): Promise<{ rows: Row[]; error: string | null }> {
  const rows: Row[] = [];
  for (let start = 0; start < 5000; start += 200) {
    const { data, error } = await admin
      .from(table)
      .select('*')
      .order('id')
      .range(start, start + 199);
    if (error) return { rows: [], error: `${table}を取得できません（${error.code}）` };
    rows.push(...((data ?? []) as Row[]));
    if ((data?.length ?? 0) < 200) return { rows, error: null };
  }
  return { rows, error: `${table}は取得上限5000件です。集計は全件ではありません` };
}

export async function loadCrm(admin: SupabaseClient): Promise<CrmData> {
  const tables = [...SOURCES, 'organizations', 'profiles', 'crm_cases'];
  const results = await Promise.all(tables.map((table) => readAll(admin, table)));
  const byTable = Object.fromEntries(tables.map((table, i) => [table, results[i].rows]));
  const issues = results.flatMap((result) => (result.error ? [result.error] : []));
  const members = byTable.profiles;
  const orgs = byTable.organizations;
  const items: CrmItem[] = SOURCES.flatMap((source) =>
    byTable[source].map((raw) => {
      const orgId = str(raw.org_id || raw.seller_org_id || raw.buyer_org_id || raw.from_org_id);
      const org = orgs.find((o) => o.id === orgId);
      const exactUser = str(raw.submitted_by || raw.buyer_user_id || raw.from_user_id);
      const contacts = members.filter((m) => (exactUser ? m.id === exactUser : m.org_id === orgId));
      const name = str(raw.contact_name) || (contacts.length === 1 ? str(contacts[0].full_name) : '');
      const email = str(raw.contact_email) || str(org?.contact_email);
      const phone = str(raw.contact_phone) || str(org?.phone);
      let title = str(raw.maker) + ' ' + str(raw.model);
      if (source === 'consultations') title = str(raw.body).slice(0, 120);
      if (source === 'wanted_requests' && !title.trim())
        title = str(raw.requirements).slice(0, 100) || str(raw.category_slug);
      if (source === 'approaches' || source === 'threads') {
        const listing = byTable.listings.find((l) => l.id === raw.listing_id);
        const wanted = byTable.wanted_requests.find((w) => w.id === raw.wanted_request_id);
        title = listing
          ? `${str(listing.maker)} ${str(listing.model)}`
          : wanted
            ? `${str(wanted.maker)} ${str(wanted.model) || str(wanted.category_slug)}`
            : '対象案件を確認';
      }
      return {
        source,
        id: raw.id,
        title: title.trim() || '内容未設定',
        orgId,
        organization: str(org?.name) || str((raw.form_payload as Record<string, unknown> | null)?.clinicName),
        person: name,
        email,
        phone,
        memberIds: contacts.map((c) => c.id),
        contactSource:
          raw.contact_email || raw.contact_phone
            ? '相談で指定された連絡先'
            : email || phone
              ? '組織の連絡先'
              : contacts.length
                ? '会員情報（詳細で確認）'
                : '返信先未登録',
        publication: str(raw.status),
        createdAt: str(raw.created_at),
        raw,
        crm: byTable.crm_cases.find((c) => c[sourceFk[source]] === raw.id),
      };
    })
  );
  return { items, members, orgs, issues, writable: !results[results.length - 1].error };
}

export function crmPriority(item: CrmItem, now = new Date()) {
  if (item.raw.archived_at || item.crm?.status === 'completed' || item.publication === 'draft') return 9;
  const due = Date.parse(str(item.crm?.due_at));
  if (Number.isFinite(due)) {
    if (due < now.getTime()) return 0;
    const day = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(date);
    return day(new Date(due)) === day(now) ? 1 : 4;
  }
  return item.crm ? 3 : 2;
}

export function filterCrm(items: CrmItem[], params: URLSearchParams, todayOnly: boolean, now = new Date()) {
  const q = (params.get('q') ?? '').trim().toLowerCase();
  const source = params.get('source');
  const status = params.get('status');
  const owner = params.get('owner');
  return items
    .filter((item) => {
      if (todayOnly && crmPriority(item, now) >= 4) return false;
      if (source && item.source !== source) return false;
      if (status && (item.crm?.status ?? 'untriaged') !== status) return false;
      if (owner === 'unassigned' && item.crm?.owner_id) return false;
      if (owner && owner !== 'unassigned' && item.crm?.owner_id !== owner) return false;
      return (
        !q ||
        [item.title, item.person, item.organization, item.email, item.id].some((text) => text.toLowerCase().includes(q))
      );
    })
    .sort(
      (a, b) =>
        crmPriority(a, now) - crmPriority(b, now) ||
        (Date.parse(str(a.crm?.due_at)) || Infinity) - (Date.parse(str(b.crm?.due_at)) || Infinity) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id)
    );
}

export async function resolveMemberContacts(admin: SupabaseClient, ids: string[]) {
  return Promise.all(
    ids.map(async (id) => {
      const { data, error } = await admin.auth.admin.getUserById(id);
      return { id, email: error ? null : (data.user?.email ?? null), error: Boolean(error) };
    })
  );
}
