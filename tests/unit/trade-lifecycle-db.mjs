// Offline integration test: real migrations and RLS, no network or customer emails.
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { baselineDatabase, migration } from '../fixtures/database.mjs';
const db = await baselineDatabase();
try {
  for (const name of (await readdir(new URL('../../supabase/migrations/', import.meta.url))).sort()) {
    if (/^00(1[1-9])_/.test(name)) await migration(db, name);
  }
  await db.exec("insert into categories values('hair-removal','脱毛',0) on conflict do nothing");
  const actors = {};
  for (const role of ['admin', 'seller', 'buyer', 'outsider']) {
    const user = crypto.randomUUID(),
      org = crypto.randomUUID();
    actors[role] = { user, org };
    await db.query('insert into auth.users values($1,$2)', [user, `${role}@example.invalid`]);
    await db.query(
      "insert into organizations(id,corporate_number,name,prefecture,city) values($1,$2,$3,'東京都','渋谷区')",
      [org, `123456789012${Object.keys(actors).length}`, role]
    );
    await db.query('insert into profiles(id,org_id,role) values($1,$2,$3)', [
      user,
      org,
      role === 'admin' ? 'admin' : 'member',
    ]);
  }
  async function asMember(role) {
    await db.exec('reset role; set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actors[role].user]);
  }
  async function asAdmin() {
    await db.exec('reset role; set role service_role');
  }
  for (const direction of ['listing', 'wanted']) {
    const listing = direction === 'listing';
    const source = listing ? 'listings' : 'wanted_requests';
    const owner = listing ? 'seller' : 'buyer';
    const actor = listing ? 'buyer' : 'seller';
    await asAdmin();
    const payload = listing
      ? {
          seller_org_id: actors.seller.org,
          submitted_by: actors.seller.user,
          category_slug: 'hair-removal',
          maker: 'Audit Maker',
          model: 'Audit Model',
          location_prefecture: '東京都',
          location_city: '渋谷区',
          status: 'pending_review',
        }
      : {
          buyer_org_id: actors.buyer.org,
          buyer_user_id: actors.buyer.user,
          category_slug: 'hair-removal',
          maker: 'Audit Maker',
          model: 'Audit Model',
          status: 'pending_review',
        };
    const created = (
      await db.query('select create_post_once($1,$2,$3,$4) as result', [
        source,
        actors[owner].user,
        crypto.randomUUID(),
        payload,
      ])
    ).rows[0].result;
    const id = created.id;
    await asMember('outsider');
    assert.equal(
      (await db.query(`select id from ${source} where id=$1`, [id])).rows.length,
      0,
      'pending post stays private'
    );
    await asAdmin();
    await db.query('select review_post($1,$2,$3,$4,$5)', [source, id, actors.admin.user, 'published', null]);
    await asMember(actor);
    assert.equal(
      (await db.query(`select id from ${source} where id=$1`, [id])).rows.length,
      1,
      'published post visible'
    );
    const approach = (
      await db.query(
        `insert into approaches(kind,${listing ? 'listing_id' : 'wanted_request_id'},from_org_id,from_user_id,message) values($1,$2,$3,$4,$5) returning id`,
        [listing ? 'interest' : 'offer', id, actors[actor].org, actors[actor].user, 'Private initial conditions']
      )
    ).rows[0].id;
    await asAdmin();
    const thread = (await db.query('select start_mediation($1,$2) as result', [approach, actors.admin.user])).rows[0]
      .result;
    assert.equal(thread.buyer_org_id, actors.buyer.org);
    assert.equal(thread.seller_org_id, actors.seller.org);
    const repeat = (await db.query('select start_mediation($1,$2) as result', [approach, actors.admin.user])).rows[0]
      .result;
    assert.equal(repeat.id, thread.id);
    assert.equal(repeat.duplicate, true);
    assert.equal(
      (await db.query('select body from messages where thread_id=$1', [thread.id])).rows.some(
        (m) => m.body === 'Private initial conditions'
      ),
      false
    );
    await db.query(
      "insert into messages(thread_id,sender_type,sender_user_id,body,visible_to) values($1,'operator',$2,'Seller only','seller_side'),($1,'operator',$2,'Buyer only','buyer_side')",
      [thread.id, actors.admin.user]
    );
    for (const party of ['seller', 'buyer']) {
      await asMember(party);
      const messages = (await db.query('select body from messages where thread_id=$1', [thread.id])).rows.map(
        (r) => r.body
      );
      assert.ok(messages.includes(party === 'seller' ? 'Seller only' : 'Buyer only'));
      assert.ok(!messages.includes(party === 'seller' ? 'Buyer only' : 'Seller only'));
      await db.query("insert into messages(thread_id,sender_type,sender_user_id,body) values($1,$2,$3,'Reply')", [
        thread.id,
        party,
        actors[party].user,
      ]);
    }
    await asMember('outsider');
    assert.equal((await db.query('select id from threads where id=$1', [thread.id])).rows.length, 0);
    assert.equal((await db.query('select id from messages where thread_id=$1', [thread.id])).rows.length, 0);
    await asAdmin();
    await assert.rejects(
      db.query('select disclose_mediation($1,$2,$3,$4)', [thread.id, actors.admin.user, '', '']),
      /check constraint/
    );
    await db.query('select disclose_mediation($1,$2,$3,$4)', [
      thread.id,
      actors.admin.user,
      'Buyer agreed: offline audit',
      'Seller agreed: offline audit',
    ]);
    await db.query('select disclose_mediation($1,$2,$3,$4)', [
      thread.id,
      actors.admin.user,
      'Buyer agreed: offline audit',
      'Seller agreed: offline audit',
    ]);
    assert.equal(
      (await db.query('select count(*)::int as n from disclosure_events where thread_id=$1', [thread.id])).rows[0].n,
      1
    );
    const agreement = (
      await db.query(
        `insert into mediation_agreements(${listing ? 'listing_id' : 'wanted_request_id'},seller_org_id,status) values($1,$2,'sent') returning id`,
        [id, actors.seller.org]
      )
    ).rows[0].id;
    const dealParams = [agreement, actors.seller.org, actors.buyer.org, 1000000];
    const createDeal = () =>
      db.query(
        'insert into deals(mediation_agreement_id,seller_org_id,buyer_org_id,agreed_price) values($1,$2,$3,$4) returning id',
        dealParams
      );
    await assert.rejects(createDeal(), /mediation/i);
    await db.query("update mediation_agreements set status='signed',signed_at=now() where id=$1", [agreement]);
    const deal = (await createDeal()).rows[0].id;
    await db.query(
      "update deals set status='contracted',contract_status='signed',concluded_at=now() where id=$1 and status='negotiating'",
      [deal]
    );
    const invoices = (await db.query('select * from commission_invoices where deal_id=$1', [deal])).rows;
    assert.equal(invoices.length, 1);
    assert.equal(invoices[0].amount, 75000);
    await db.query("update deals set status='contracted' where id=$1 and status='negotiating'", [deal]);
    assert.equal(
      (await db.query('select count(*)::int as n from commission_invoices where deal_id=$1', [deal])).rows[0].n,
      1
    );
    await db.query("update commission_invoices set status='paid',paid_at=now() where id=$1", [invoices[0].id]);
    console.log(
      `PASS ${direction}: submit -> publish -> ${listing ? 'interest' : 'offer'} -> mediation -> scoped messages -> consent -> signed agreement -> contract -> single invoice -> paid`
    );
    console.log(
      'AUDIT remaining state:',
      (
        await db.query(
          `select (select status from ${source} where id=$1) as post_status,(select status from approaches where id=$2) as approach_status,(select status from threads where id=$3) as thread_status,(select count(*)::int from crm_cases) as crm_cases`,
          [id, approach, thread.id]
        )
      ).rows[0]
    );
  }
} finally {
  await db.close();
}
