// Offline PostgreSQL-compatible regression tests. Never connects to Supabase.
// PGLITE_MODULE may point to an isolated installation; no production credentials are used.
import assert from 'node:assert/strict';
import { baselineDatabase, migration } from '../fixtures/database.mjs';
const db = await baselineDatabase();
const ids = {
  admin: '00000000-0000-4000-8000-000000000001',
  user: '00000000-0000-4000-8000-000000000002',
  org: '00000000-0000-4000-8000-000000000003',
  listing: '00000000-0000-4000-8000-000000000004',
  key: '00000000-0000-4000-8000-000000000005',
  req: '00000000-0000-4000-8000-000000000006',
};
await db.query(`insert into auth.users values ($1,'admin@example.invalid'),($2,'member@example.invalid')`, [
  ids.admin,
  ids.user,
]);
await db.query(
  `insert into public.organizations(id,corporate_number,name,prefecture,city) values($1,'1234567890123','Existing org','東京','渋谷')`,
  [ids.org]
);
await db.query(`insert into public.profiles(id,org_id,role) values($1,$3,'admin'),($2,$3,'member')`, [
  ids.admin,
  ids.user,
  ids.org,
]);
await db.exec(`insert into public.categories values('hair-removal','脱毛',0) on conflict do nothing;`);
await db.query(
  `insert into public.listings(id,seller_org_id,category_slug,maker,model,location_prefecture,location_city,status) values($1,$2,'hair-removal','Maker','Machine','東京','渋谷','pending_review')`,
  [ids.listing, ids.org]
);
await db.query("insert into listing_images(listing_id,storage_path,is_cover) values($1,'legacy-original.jpg',true)", [
  ids.listing,
]);
const oldImage = (await db.query('select row_to_json(i) as row from listing_images i')).rows[0].row;
const before = (await db.query('select row_to_json(l) as row from public.listings l')).rows[0].row;
await migration(db, '0011_intake_crm.sql');
await migration(db, '0012_workflow_guards.sql');
await migration(db, '0013_mediation_transactions.sql');
await migration(db, '0014_disclosure_evidence.sql');
await migration(db, '0015_post_creation_replay.sql');
await migration(db, '0016_media_transactions.sql');
await migration(db, '0017_comment_trigger_compatibility.sql');
const after = (await db.query('select row_to_json(l) as row from public.listings l')).rows[0].row;
for (const [key, value] of Object.entries(before))
  assert.deepEqual(after[key], value, `existing listing ${key} retained`);
const retainedImage = (await db.query('select row_to_json(i) as row from listing_images i')).rows[0].row;
for (const [key, value] of Object.entries(oldImage))
  assert.deepEqual(retainedImage[key], value, `existing image ${key} retained`);
await db.exec('set role service_role');
const receipt = {
  topic: 'buy',
  body: 'Existing data is retained',
  contact_email: 'sample@example.invalid',
  source: 'contact_buy',
};
const received = await db.query('select receive_consultation($1,$2,$3) as result', [ids.key, 'hash', receipt]);
const cid = received.rows[0].result.id;
assert.equal(received.rows[0].result.duplicate, false);
assert.equal(
  (await db.query('select receive_consultation($1,$2,$3) as result', [ids.key, 'hash', receipt])).rows[0].result
    .duplicate,
  true
);
await assert.rejects(
  db.query('select receive_consultation($1,$2,$3)', [ids.key, 'changed', receipt]),
  /submission_conflict/
);
assert.equal((await db.query('select count(*)::int as n from consultations')).rows[0].n, 1);
const patch = {
  status: 'in_progress',
  owner_id: ids.admin,
  next_action: 'Call buyer',
  due_at: '2026-09-10T03:00:00Z',
  kind: 'phone',
  contact_target: 'Buyer',
  body: 'Confirmed budget',
  occurred_at: '2026-09-09T01:00:00Z',
};
const save = () =>
  db.query('select save_crm_case($1,$2,$3,$4,$5,$6) as id', ['consultations', cid, ids.admin, 0, ids.req, patch]);
const caseId = (await save()).rows[0].id;
assert.equal((await save()).rows[0].id, caseId);
assert.equal((await db.query('select count(*)::int as n from crm_activities')).rows[0].n, 1);
await assert.rejects(
  db.query('select save_crm_case($1,$2,$3,$4,$5,$6)', ['consultations', cid, ids.admin, 0, crypto.randomUUID(), patch]),
  /version_conflict/
);
await assert.rejects(
  db.query('select save_crm_case($1,$2,$3,$4,$5,$6)', ['consultations', cid, ids.user, 1, crypto.randomUUID(), patch]),
  /forbidden/
);
const original = (await db.query('select * from consultations where id=$1', [cid])).rows[0];
assert.equal(original.status, 'new', 'CRM update does not overwrite original receipt');
await db.query('select review_post($1,$2,$3,$4,$5)', ['listings', ids.listing, ids.admin, 'rejected', 'Need photo']);
assert.equal((await db.query('select reason from post_review_events')).rows[0].reason, 'Need photo');
await assert.rejects(
  db.query('select review_post($1,$2,$3,$4,$5)', ['listings', ids.listing, ids.admin, 'published', null]),
  /not_pending_review/
);
const oldOrg = (await db.query('select register_member($1,$2) as id', [ids.user, {}])).rows[0].id;
assert.equal(oldOrg, ids.org, 'repeat onboarding preserves organization');
await db.exec('reset role; set role authenticated');
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids.user]);
await assert.rejects(
  db.query("update profiles set role='admin' where id=$1", [ids.user]),
  /profile_identity_is_immutable/
);
await assert.rejects(
  db.query('update organizations set verified_at=now() where id=$1', [ids.org]),
  /organization_verification_requires_admin/
);
await assert.rejects(
  db.query("update listings set status='published' where id=$1", [ids.listing]),
  /post_not_editable/
);
await db.query("update listings set model='Member revised',status='pending_review' where id=$1", [ids.listing]);
assert.equal((await db.query('select model from listings where id=$1', [ids.listing])).rows[0].model, 'Member revised');
await assert.rejects(
  db.query("update listings set model='After submission' where id=$1", [ids.listing]),
  /post_not_editable/
);
await assert.rejects(
  db.query("insert into wanted_requests(buyer_org_id,buyer_user_id,category_slug) values($1,$2,'hair-removal')", [
    ids.org,
    ids.admin,
  ]),
  /invalid_author/
);
assert.equal((await db.query('select * from crm_cases')).rows.length, 0, 'member cannot read CRM');
await assert.rejects(
  db.query('select save_crm_case($1,$2,$3,$4,$5,$6)', ['consultations', cid, ids.admin, 1, crypto.randomUUID(), patch]),
  /permission denied/
);
await db.exec('reset role');
// Separate parties and an approach for mediation/disclosure replay tests.
const sellerOrg = crypto.randomUUID(),
  appro = crypto.randomUUID();
await db.query(
  "insert into organizations(id,corporate_number,name,prefecture,city) values($1,'9999999999999','Seller','東京','新宿')",
  [sellerOrg]
);
await db.query("update listings set seller_org_id=$1,status='published' where id=$2", [sellerOrg, ids.listing]);
await db.query("insert into approaches(id,kind,listing_id,from_org_id,from_user_id) values($1,'interest',$2,$3,$4)", [
  appro,
  ids.listing,
  ids.org,
  ids.user,
]);
await db.exec('set role service_role');
const med = (await db.query('select start_mediation($1,$2) as result', [appro, ids.admin])).rows[0].result;
assert.equal(med.duplicate, false);
assert.equal((await db.query('select start_mediation($1,$2) as result', [appro, ids.admin])).rows[0].result.id, med.id);
assert.equal((await db.query('select count(*)::int as n from threads')).rows[0].n, 1);
await assert.rejects(
  db.query('select disclose_mediation($1,$2,$3,$4)', [med.id, ids.admin, '', '']),
  /check constraint/
);
assert.equal(
  (await db.query('select contact_disclosed from threads')).rows[0].contact_disclosed,
  false,
  'invalid consent rolls back'
);
const disclosure = [med.id, ids.admin, '2026-09-09 email confirmation ref A', '2026-09-09 phone confirmation ref B'];
await db.query('select disclose_mediation($1,$2,$3,$4)', disclosure);
await db.query('select disclose_mediation($1,$2,$3,$4)', disclosure);
assert.equal((await db.query('select count(*)::int as n from disclosure_events')).rows[0].n, 1);
assert.equal((await db.query('select count(*)::int as n from messages')).rows[0].n, 2);
await db.exec('reset role');
assert.equal((await db.query('select count(*)::int as n from listings')).rows[0].n, 1);
console.log(
  'PASS: additive migrations retain existing values; receipt replay/conflict; CRM atomic save/replay/conflict; moderation history; onboarding replay; RLS and privilege guards.'
);
await db.close();
