// Offline checks for listing price ranges. No production connection.
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { baselineDatabase, migration } from '../fixtures/database.mjs';
const db = await baselineDatabase();
for (const name of (await readdir(new URL('../../supabase/migrations/', import.meta.url)))
  .sort()
  .filter((n) => /^(001[1-9]|0020)_/.test(n)))
  await migration(db, name);
const user = '00000000-0000-4000-8000-000000000002';
const org = '00000000-0000-4000-8000-000000000003';
await db.query(`insert into auth.users values ($1,'member@example.invalid')`, [user]);
await db.query(
  `insert into organizations(id,corporate_number,name,prefecture,city) values($1,'1234567890123','Seller','東京都','渋谷区')`,
  [org]
);
await db.query(`insert into profiles(id,org_id,role) values($1,$2,'member')`, [user, org]);
await db.exec(`insert into categories values('hair-removal','脱毛',0) on conflict do nothing;`);
const legacy = await db.query(
  `insert into listings(seller_org_id,category_slug,maker,model,location_prefecture,location_city,asking_price)
   values($1,'hair-removal','Maker','Old','東京都','渋谷区',500000) returning asking_price_max`,
  [org]
);
assert.equal(legacy.rows[0].asking_price_max, null, 'existing single prices are kept');
await db.exec('set role service_role');
const created = await db.query('select create_post_once($1,$2,$3,$4) as r', [
  'listings',
  user,
  crypto.randomUUID(),
  {
    category_slug: 'hair-removal',
    maker: 'Maker',
    model: 'Range',
    location_prefecture: '東京都',
    location_city: '渋谷区',
    asking_price: 800000,
    asking_price_max: 1000000,
  },
]);
const row = await db.query('select asking_price,asking_price_max from listings where id=$1', [created.rows[0].r.id]);
assert.deepEqual(row.rows[0], { asking_price: 800000, asking_price_max: 1000000 }, 'new listing stores the range');
await db.exec('reset role');
await assert.rejects(
  db.query("update listings set asking_price_max=100 where model='Range'"),
  /listings_asking_price_range_check/
);
await assert.rejects(
  db.query("update listings set asking_price=null where model='Range'"),
  /listings_asking_price_range_check/
);
console.log(
  'PASS: price ranges are stored on create, legacy single prices kept, inverted or open-ended ranges rejected.'
);
await db.close();
