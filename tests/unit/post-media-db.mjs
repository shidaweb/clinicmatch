import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { baselineDatabase, migration } from '../fixtures/database.mjs';
const db = await baselineDatabase();
const user = crypto.randomUUID(),
  org = crypto.randomUUID(),
  other = crypto.randomUUID(),
  otherOrg = crypto.randomUUID();
await db.query("insert into auth.users values($1,'user@example.invalid'),($2,'other@example.invalid')", [user, other]);
await db.query(
  "insert into organizations(id,corporate_number,name,prefecture,city) values($1,'1234567890123','Existing','東京','港区'),($2,'9999999999999','Other','東京','港区')",
  [org, otherOrg]
);
await db.query("insert into profiles(id,org_id,role) values($1,$2,'member'),($3,$4,'member')", [
  user,
  org,
  other,
  otherOrg,
]);
for (const name of (await readdir(new URL('../../supabase/migrations/', import.meta.url)))
  .sort()
  .filter((n) => /^00(1[1-9])_/.test(n)))
  await migration(db, name);
await db.exec('set role service_role');
const body = {
  category_slug: 'rf',
  maker: 'Maker',
  model: 'Device',
  location_prefecture: '東京',
  location_city: '港区',
  status: 'draft',
};
const key = crypto.randomUUID();
const create = (source, requestId, data, actor = user) =>
  db.query('select create_post_once($1,$2,$3,$4) as r', [source, actor, requestId, data]);
const listing = (await create('listings', key, body)).rows[0].r.id;
assert.equal((await create('listings', key, body)).rows[0].r.duplicate, true);
await assert.rejects(create('listings', key, { ...body, model: 'Changed' }), /submission_conflict/);
const initial = (await db.query('select * from listings where id=$1', [listing])).rows[0];
assert.equal(initial.seller_org_id, org);
assert.equal(initial.submitted_by, user);
assert.equal(initial.quantity, 1);
assert.equal(initial.status, 'draft');
const invalidKey = crypto.randomUUID();
await assert.rejects(create('listings', invalidKey, { ...body, model: null }), /not-null/);
assert.equal(
  (await db.query('select count(*)::int n from post_creation_receipts where request_id=$1', [invalidKey])).rows[0].n,
  0
);
await assert.rejects(create('listings', crypto.randomUUID(), { ...body, status: 'published' }), /review_required/);
await assert.rejects(create('listings', crypto.randomUUID(), body, crypto.randomUUID()), /forbidden/);
const wanted = (
  await create('wanted_requests', crypto.randomUUID(), {
    category_slug: 'rf',
    buyer_org_id: otherOrg,
    buyer_user_id: other,
  })
).rows[0].r.id;
assert.equal(
  (await db.query('select buyer_org_id from wanted_requests where id=$1', [wanted])).rows[0].buyer_org_id,
  org
);
const imagePath = (id, n) => `media-v2/${id}/${String(n).padStart(64, '0')}.png`;
const media = async (source, id, payload, k = crypto.randomUUID(), actor = user) =>
  (await db.query('select edit_post_media($1,$2,$3,$4,$5) as r', [source, id, actor, k, payload])).rows[0].r;
const firstKey = crypto.randomUUID(),
  firstPayload = { action: 'attach', path: imagePath(listing, 1) };
const first = await media('listings', listing, firstPayload, firstKey);
assert.equal((await media('listings', listing, firstPayload, firstKey)).duplicate, true);
assert.equal(
  (await media('listings', listing, firstPayload)).image.id,
  first.image.id,
  'same bytes do not add a second active row'
);
await assert.rejects(
  media('listings', listing, { action: 'attach', path: imagePath(listing, 2) }, firstKey),
  /submission_conflict/
);
const second = await media('listings', listing, { action: 'attach', path: imagePath(listing, 2) });
const active = async () =>
  (
    await db.query('select * from listing_images where listing_id=$1 and archived_at is null order by sort_order,id', [
      listing,
    ])
  ).rows;
const originalImages = await active();
await assert.rejects(
  media('listings', listing, { action: 'order', order: [first.image.id, first.image.id] }),
  /image_set_conflict/
);
assert.deepEqual(await active(), originalImages, 'invalid reorder is atomic');
await media('listings', listing, {
  action: 'order',
  order: [second.image.id, first.image.id],
  cover_id: second.image.id,
});
assert.equal((await active())[0].id, second.image.id);
assert.equal((await active()).filter((i) => i.is_cover).length, 1);
await media('listings', listing, { action: 'archive', image_id: second.image.id });
assert.equal((await active()).length, 1);
assert.equal((await active())[0].is_cover, true);
assert.ok(
  (await db.query('select archived_at from listing_images where id=$1', [second.image.id])).rows[0].archived_at,
  'original image row retained'
);
await media('listings', listing, { action: 'restore', image_id: second.image.id });
assert.equal((await active()).length, 2);
assert.equal((await active()).filter((i) => i.is_cover).length, 1);
for (let n = 3; n <= 10; n++) await media('listings', listing, { action: 'attach', path: imagePath(listing, n) });
await assert.rejects(media('listings', listing, { action: 'attach', path: imagePath(listing, 11) }), /image_limit/);
assert.equal((await active()).length, 10);
await assert.rejects(
  media('listings', listing, { action: 'archive', image_id: first.image.id }, crypto.randomUUID(), other),
  /forbidden/
);
const wantedKey = crypto.randomUUID(),
  wantedFirst = { action: 'attach', path: imagePath(wanted, 1) };
await media('wanted_requests', wanted, wantedFirst, wantedKey);
await media('wanted_requests', wanted, { action: 'attach', path: imagePath(wanted, 2) });
await media('wanted_requests', wanted, wantedFirst, wantedKey);
assert.equal(
  (await db.query('select reference_image_path from wanted_requests where id=$1', [wanted])).rows[0]
    .reference_image_path,
  imagePath(wanted, 2),
  'stale replay must not restore an older image'
);
assert.ok(
  (await db.query('select previous_value from post_media_receipts where post_id=$1', [wanted])).rows.some(
    (r) => r.previous_value.reference_image_path === imagePath(wanted, 1)
  )
);
// Even with legacy permissive Storage policies present, members cannot overwrite or delete post objects.
await db.query("insert into storage.objects(bucket_id,name,owner) values('listing-images',$1,$2)", [
  imagePath(listing, 1),
  user,
]);
await db.exec('reset role; set role authenticated');
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
await assert.rejects(
  db.query("insert into storage.objects(bucket_id,name,owner) values('listing-images','elsewhere/fake.png',$1)", [
    user,
  ]),
  /row-level security/
);
await db.query("update storage.objects set name='replaced' where bucket_id='listing-images'");
await db.query("delete from storage.objects where bucket_id='listing-images'");
await assert.rejects(db.query('delete from listing_images where listing_id=$1', [listing]), /permission denied/);
await assert.rejects(
  db.query('update wanted_requests set reference_image_path=$1 where id=$2', ['forged.png', wanted]),
  /image_requires_server/
);
await db.query("insert into storage.objects(bucket_id,name,owner) values('avatars',$1,$2)", [
  `${user}/avatar.png`,
  user,
]);
await db.exec('reset role; set role service_role');
assert.equal(
  (await db.query("select name from storage.objects where bucket_id='listing-images'")).rows[0].name,
  imagePath(listing, 1)
);
await db.query("update listings set status='pending_review' where id=$1", [listing]);
assert.equal((await media('listings', listing, firstPayload, firstKey)).duplicate, true);
await assert.rejects(media('listings', listing, { action: 'archive', image_id: first.image.id }), /post_not_editable/);
await assert.rejects(media('listings', listing, { action: 'order', cover_id: first.image.id }), /post_not_editable/);
assert.equal((await active()).length, 10);
console.log(
  'PASS: post creation replay/conflict/rollback/defaults/ownership; image replay, stale replacement, atomic ordering, archive/restore, limit, review guard; legacy Storage bypass blocked; avatars unaffected.'
);
await db.close();
