// Offline guard tests for editing a post while it waits for review. No production connection.
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { baselineDatabase, migration } from '../fixtures/database.mjs';
const db = await baselineDatabase();
for (const name of (await readdir(new URL('../../supabase/migrations/', import.meta.url)))
  .sort()
  .filter((n) => /^(001[1-9]|002[01])_/.test(n)))
  await migration(db, name);
const ids = {
  user: '00000000-0000-4000-8000-000000000002',
  other: '00000000-0000-4000-8000-000000000007',
  org: '00000000-0000-4000-8000-000000000003',
  otherOrg: '00000000-0000-4000-8000-000000000008',
  listing: '00000000-0000-4000-8000-000000000004',
  reserved: '00000000-0000-4000-8000-000000000009',
  wanted: '00000000-0000-4000-8000-000000000005',
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
await db.exec(`insert into categories values('hair-removal','脱毛',0),('rf','RF',1) on conflict do nothing;`);
await db.query(
  `insert into listings(id,seller_org_id,category_slug,maker,model,location_prefecture,location_city,status,asking_price,published_at)
   values($1,$3,'hair-removal','Maker','Machine','東京都','渋谷区','pending_review',1000000,null),
         ($2,$3,'hair-removal','Maker','Machine','東京都','渋谷区','reserved',1000000,now())`,
  [ids.listing, ids.reserved, ids.org]
);
await db.query(
  `insert into wanted_requests(id,buyer_org_id,buyer_user_id,category_slug,status) values($1,$2,$3,'hair-removal','pending_review')`,
  [ids.wanted, ids.org, ids.user]
);

await db.exec('set role authenticated');
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids.user]);
await db.query("update listings set asking_price=900000,model='Fixed machine',category_slug='rf' where id=$1", [
  ids.listing,
]);
await db.query("update wanted_requests set requirements='修正しました',budget=500000 where id=$1", [ids.wanted]);
await assert.rejects(
  db.query("update listings set status='published' where id=$1", [ids.listing]),
  /post_not_editable/,
  'member cannot publish their own post'
);
await assert.rejects(
  db.query("update wanted_requests set status='rejected' where id=$1", [ids.wanted]),
  /post_not_editable/
);
await assert.rejects(db.query('update listings set archived_at=now() where id=$1', [ids.listing]), /post_not_editable/);
await assert.rejects(db.query('update listings set published_at=now() where id=$1', [ids.listing]), /review_required/);
await assert.rejects(
  db.query('update listings set seller_org_id=$2 where id=$1', [ids.listing, ids.otherOrg]),
  /owner_is_immutable/
);
await assert.rejects(db.query('update listings set asking_price=1 where id=$1', [ids.reserved]), /post_not_editable/);
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids.other]);
const foreign = await db.query('update listings set asking_price=1 where id=$1 returning id', [ids.listing]);
assert.equal(foreign.rows.length, 0, 'other organizations cannot edit');

await db.exec('reset role; set role service_role');
const media = async (source, id, payload) =>
  (await db.query('select edit_post_media($1,$2,$3,$4,$5) as r', [source, id, ids.user, crypto.randomUUID(), payload]))
    .rows[0].r;
const path = (id) => `media-v2/${id}/${'b'.repeat(64)}.png`;
const image = await media('listings', ids.listing, { action: 'attach', path: path(ids.listing) });
assert.equal(image.image.is_cover, true, 'listing under review accepts a new image');
await media('wanted_requests', ids.wanted, { action: 'attach', path: path(ids.wanted) });
await db.exec('reset role');

const listing = (
  await db.query('select status,asking_price,model,published_at from listings where id=$1', [ids.listing])
).rows[0];
assert.equal(listing.status, 'pending_review', 'listing stays in review after edits');
assert.equal(listing.asking_price, 900000);
assert.equal(listing.model, 'Fixed machine');
assert.equal(listing.published_at, null);
const wanted = (
  await db.query('select status,requirements,reference_image_path from wanted_requests where id=$1', [ids.wanted])
).rows[0];
assert.equal(wanted.status, 'pending_review', 'wanted request stays in review after edits');
assert.equal(wanted.requirements, '修正しました');
assert.equal(wanted.reference_image_path, path(ids.wanted), 'wanted request under review accepts an image');
console.log(
  'PASS: posts under review accept content and image edits and stay in review; publishing, archiving, ownership and reserved listings stay locked.'
);
await db.close();
