// Offline guard tests for editing a published listing. No production connection.
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { baselineDatabase, migration } from '../fixtures/database.mjs';
const db = await baselineDatabase();
for (const name of (await readdir(new URL('../../supabase/migrations/', import.meta.url)))
  .sort()
  .filter((n) => /^001[1-9]_/.test(n)))
  await migration(db, name);
const ids = {
  user: '00000000-0000-4000-8000-000000000002',
  other: '00000000-0000-4000-8000-000000000007',
  org: '00000000-0000-4000-8000-000000000003',
  otherOrg: '00000000-0000-4000-8000-000000000008',
  listing: '00000000-0000-4000-8000-000000000004',
  reserved: '00000000-0000-4000-8000-000000000009',
};
await db.query(`insert into auth.users values ($1,'member@example.invalid'),($2,'other@example.invalid')`, [
  ids.user,
  ids.other,
]);
await db.query(
  `insert into organizations(id,corporate_number,name,prefecture,city) values($1,'1234567890123','Seller','東京都','渋谷区'),($2,'2234567890123','Other','大阪府','北区')`,
  [ids.org, ids.otherOrg]
);
await db.query(`insert into profiles(id,org_id,role) values($1,$3,'member'),($2,$4,'member')`, [
  ids.user,
  ids.other,
  ids.org,
  ids.otherOrg,
]);
await db.exec(`insert into categories values('hair-removal','脱毛',0) on conflict do nothing;`);
await db.query(
  `insert into listings(id,seller_org_id,category_slug,maker,model,location_prefecture,location_city,status,asking_price,published_at)
   values($1,$3,'hair-removal','Maker','Machine','東京都','渋谷区','published',1000000,now()),
         ($2,$3,'hair-removal','Maker','Machine','東京都','渋谷区','reserved',1000000,now())`,
  [ids.listing, ids.reserved, ids.org]
);
const before = (await db.query('select row_to_json(l) as row from listings l where id=$1', [ids.listing])).rows[0].row;

await db.exec('set role authenticated');
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids.user]);
await db.query(
  "update listings set asking_price=850000,negotiable=true,description='値下げしました',location_city='港区' where id=$1",
  [ids.listing]
);
const after = (await db.query('select row_to_json(l) as row from listings l where id=$1', [ids.listing])).rows[0].row;
assert.equal(after.asking_price, 850000, 'seller can change price while published');
assert.equal(after.status, 'published', 'listing stays published');
for (const key of Object.keys(before).filter(
  (k) => !['asking_price', 'negotiable', 'description', 'location_city'].includes(k)
))
  assert.deepEqual(after[key], before[key], `${key} untouched`);
await assert.rejects(
  db.query("update listings set model='Other machine' where id=$1", [ids.listing]),
  /published_field_locked/
);
await assert.rejects(
  db.query("update listings set category_slug='rf' where id=$1", [ids.listing]),
  /published_field_locked/
);
await assert.rejects(db.query("update listings set status='draft' where id=$1", [ids.listing]), /post_not_editable/);
await assert.rejects(db.query('update listings set archived_at=now() where id=$1', [ids.listing]), /post_not_editable/);
await assert.rejects(db.query('update listings set asking_price=1 where id=$1', [ids.reserved]), /post_not_editable/);

await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids.other]);
const foreign = await db.query('update listings set asking_price=1 where id=$1 returning id', [ids.listing]);
assert.equal(foreign.rows.length, 0, 'other organizations cannot edit');
await db.exec('reset role');
assert.equal(
  (await db.query('select asking_price from listings where id=$1', [ids.listing])).rows[0].asking_price,
  850000
);
console.log(
  'PASS: published listings accept price/terms edits only; identity, status and reserved listings stay locked.'
);
await db.close();
