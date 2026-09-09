// Local-only UI fixture, no external requests and no production data.
import http from 'node:http';
const uid = '00000000-0000-4000-8000-000000000001',
  org = '00000000-0000-4000-8000-000000000002',
  cid = '00000000-0000-4000-8000-000000000003';
const user = {
  id: uid,
  email: 'admin@example.invalid',
  role: 'authenticated',
  aud: 'authenticated',
  email_confirmed_at: new Date().toISOString(),
  identities: [{ id: uid }],
  user_metadata: {},
};
const company = {
  id: org,
  name: '検証用クリニック',
  contact_email: 'contact@example.invalid',
  phone: '000-0000-0000',
  prefecture: '東京都',
  city: '渋谷区',
};
const tables = {
  organizations: [company],
  profiles: [
    { id: uid, org_id: org, full_name: '検証担当', role: 'admin', display_name: '検証担当', organizations: company },
  ],
  consultations: [
    {
      id: cid,
      topic: 'buy',
      body: '【架空データ】ピコレーザーの購入相談。予算と導入時期を確認する。',
      contact_name: null,
      contact_email: null,
      contact_phone: null,
      org_id: org,
      status: 'new',
      created_at: '2026-09-08T11:00:00Z',
      notification_status: 'failed',
    },
  ],
  listings: [],
  wanted_requests: [],
  approaches: [],
  threads: [],
  crm_cases: [],
  crm_activities: [],
  post_review_events: [],
  categories: [],
  disclosure_events: [],
};
const token = [
  { alg: 'HS256', typ: 'JWT' },
  { sub: uid, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 },
  'fixture',
]
  .map((v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url'))
  .join('.');
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:54329');
  let raw = '';
  for await (const b of req) raw += b;
  let payload = {};
  try {
    payload = JSON.parse(raw || '{}');
  } catch {}
  const send = (data, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(data));
  };
  if (url.pathname === '/auth/v1/token')
    return send({
      access_token: token,
      refresh_token: 'fixture-refresh',
      token_type: 'bearer',
      expires_in: 3600,
      user,
    });
  if (url.pathname === '/auth/v1/user' || url.pathname.startsWith('/auth/v1/admin/users/')) return send(user);
  if (url.pathname === '/rest/v1/rpc/save_crm_case') {
    let c = tables.crm_cases.find((c) => c.consultation_id === payload.p_source_id);
    if ((c?.version || 0) !== payload.p_version) return send({ message: 'version_conflict' }, 409);
    if (!c) {
      c = { id: crypto.randomUUID(), consultation_id: payload.p_source_id, version: 0 };
      tables.crm_cases.push(c);
    }
    Object.assign(c, payload.p_patch, { version: c.version + 1, updated_at: new Date().toISOString() });
    if (payload.p_patch.kind !== 'note') c.last_contact_at = payload.p_patch.occurred_at;
    tables.crm_activities.push({
      id: crypto.randomUUID(),
      case_id: c.id,
      actor_id: uid,
      ...payload.p_patch,
      created_at: new Date().toISOString(),
    });
    return send(c.id);
  }
  const table = url.pathname.split('/').pop();
  let rows = [...(tables[table] || [])];
  for (const [k, v] of url.searchParams) {
    if (v.startsWith('eq.')) rows = rows.filter((r) => String(r[k]) === v.slice(3));
    if (v === 'is.null') rows = rows.filter((r) => r[k] == null);
  }
  if (req.method === 'PATCH') {
    for (const r of rows) Object.assign(r, payload);
  }
  if (req.headers.accept?.includes('application/vnd.pgrst.object+json'))
    return rows.length === 1 ? send(rows[0]) : send({ code: 'PGRST116', message: 'not found' }, 406);
  return send(rows);
});
server.listen(54329, '127.0.0.1', () => console.log('CRM fixture listening on loopback:54329; fictional data only'));
