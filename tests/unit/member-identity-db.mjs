// Offline registration migration tests. No production connection or emails.
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { baselineDatabase, migration } from '../fixtures/database.mjs';
const db = await baselineDatabase();
for (const name of (await readdir(new URL('../../supabase/migrations/', import.meta.url)))
  .sort()
  .filter((n) => /^001[1-7]_/.test(n)))
  await migration(db, name);
const legacy = (
  await db.query(
    "insert into organizations(corporate_number,name,prefecture,city) values('1234567890123','Legacy','東京都','港区') returning *"
  )
).rows[0];
await migration(db, '0018_member_identity.sql');
const retained = (await db.query('select * from organizations where id=$1', [legacy.id])).rows[0];
for (const key of Object.keys(legacy)) assert.deepEqual(retained[key], legacy[key]);
assert.equal(retained.account_type, 'corporate');
assert.equal(retained.invoice_registration_number, null);
const ids = Array.from({ length: 8 }, (_, i) => `00000000-0000-4000-8000-${String(i + 101).padStart(12, '0')}`);
for (const id of ids) await db.query('insert into auth.users values($1,$2)', [id, `${id}@example.invalid`]);
const base = {
  name: 'Test business',
  prefecture: '東京都',
  city: '港区',
  email: 'test@example.invalid',
  full_name: 'Test',
  display_name: 'Test',
  trade_side: 'both',
};
await db.exec('set role service_role');
const register = (id, data) => db.query('select register_member($1,$2) as id', [id, { ...base, ...data }]);
const corpId = (await register(ids[0], { account_type: 'corporate', corporate_number: '1234567890123' })).rows[0].id;
const individualId = (
  await register(ids[1], { account_type: 'individual', invoice_registration_number: 'T1234567890123' })
).rows[0].id;
const individual = (await db.query('select * from organizations where id=$1', [individualId])).rows[0];
assert.equal(individual.corporate_number, null);
assert.equal(individual.invoice_registration_number, 'T1234567890123');
assert.equal(individual.verified_at, null);
assert.equal(
  (await register(ids[1], { account_type: 'corporate', corporate_number: '9999999999999' })).rows[0].id,
  individualId,
  'retry never rewrites an existing identity'
);
assert.equal(
  (await db.query('select account_type from organizations where id=$1', [individualId])).rows[0].account_type,
  'individual'
);
await register(ids[2], { corporate_number: '1111111111111' }); // Old deployed API remains compatible.
for (const data of [
  { account_type: 'individual' },
  { account_type: 'individual', invoice_registration_number: '1234567890123' },
  { account_type: 'individual', invoice_registration_number: 'T123456789012' },
  { account_type: 'individual', invoice_registration_number: 'T1234567890123', corporate_number: '1234567890123' },
  { account_type: 'corporate' },
  { account_type: 'corporate', corporate_number: 'not-a-number' },
  { account_type: 'unknown', corporate_number: '1234567890123' },
])
  await assert.rejects(register(ids[3], data), /check constraint/);
const before = (await db.query('select count(*)::int as n from organizations')).rows[0].n;
await assert.rejects(
  register(ids[4], {
    account_type: 'individual',
    invoice_registration_number: 'T1111111111111',
    trade_side: 'invalid',
  }),
  /check constraint/
);
assert.equal(
  (await db.query('select count(*)::int as n from organizations')).rows[0].n,
  before,
  'profile failure rolls back new organization'
);
await db.exec('reset role; set role authenticated');
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids[1]]);
await assert.rejects(
  db.query("update organizations set invoice_registration_number='T9999999999999' where id=$1", [individualId]),
  /organization_verification_requires_admin/
);
await assert.rejects(
  db.query(
    "update organizations set account_type='corporate',corporate_number='1234567890123',invoice_registration_number=null where id=$1",
    [individualId]
  ),
  /organization_verification_requires_admin/
);
await assert.rejects(db.query('select register_member($1,$2)', [ids[5], base]), /permission denied/);
assert.equal(
  (await db.query('select id from organizations where id=$1', [corpId])).rows.length,
  0,
  'cannot read another member identity'
);
await db.query("update organizations set phone='03-0000-0000' where id=$1", [individualId]);
await db.exec('reset role; set role anon');
await db.query("select set_config('request.jwt.claim.sub','',false)");
assert.equal((await db.query('select * from organizations')).rows.length, 0, 'identifiers stay private');
console.log(
  'PASS: corporate/individual registration, legacy preservation, constraints, atomic rollback, idempotent resume, private identifiers and immutable identity.'
);
await db.close();
