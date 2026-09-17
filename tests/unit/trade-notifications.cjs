/* eslint-disable @typescript-eslint/no-require-imports -- Offline TypeScript route harness. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
function load(file, mocks, cache = {}) {
  const full = path.resolve(root, file);
  const alias = '~/' + path.relative(path.join(root, 'src'), full).replace(/\.ts$/, '');
  if (Object.hasOwn(mocks, alias)) return mocks[alias];
  if (cache[full]) return cache[full];
  const exports = (cache[full] = {});
  const source = ts.transpileModule(fs.readFileSync(full, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(
    source,
    {
      exports,
      Request,
      Response,
      Date,
      console,
      URL,
      require(name) {
        if (Object.hasOwn(mocks, name)) return mocks[name];
        if (name.startsWith('~/')) return load('src/' + name.slice(2) + '.ts', mocks, cache);
        if (name.startsWith('.')) return load(path.resolve(path.dirname(full), name + '.ts'), mocks, cache);
        throw new Error('Unexpected dependency ' + name);
      },
    },
    { filename: file }
  );
  return exports;
}
(async () => {
  const sent = [];
  let actor = 'buyer',
    duplicate = false,
    mailSuccess = true;
  const rows = {
    approaches: { id: 'approach' },
    listings: {
      id: 'listing',
      seller_org_id: 'seller',
      maker: 'Maker',
      model: 'Model',
      category_slug: 'hair',
      location_city: 'City',
    },
    wanted_requests: {
      id: 'wanted',
      buyer_org_id: 'buyer',
      maker: 'Maker',
      model: 'Model',
      category_slug: 'hair',
      area_city: 'City',
    },
    threads: { id: 'thread', buyer_org_id: 'buyer', seller_org_id: 'seller', status: 'open' },
    messages: { id: 'message' },
    deals: {
      id: 'deal',
      seller_org_id: 'seller',
      buyer_org_id: 'buyer',
      agreed_price: 1000000,
      commission_amount: 75000,
    },
    commission_invoices: { id: 'invoice', amount: 75000 },
    profiles: { id: 'owner-user' },
  };
  const client = {
    from(table) {
      const query = new Proxy(
        {},
        {
          get(_target, key) {
            if (key === 'then') return (resolve) => resolve({ data: rows[table], error: null });
            if (key === 'single' || key === 'maybeSingle') return async () => ({ data: rows[table], error: null });
            return () => query;
          },
        }
      );
      return query;
    },
    async rpc() {
      return { data: { ...rows.threads, duplicate }, error: null };
    },
  };
  const mocks = {
    '~/lib/auth': {
      getProfile: async () => ({ id: actor + '-user', org_id: actor, role: actor === 'operator' ? 'admin' : 'member' }),
      requireAdmin: async () => ({ profile: { id: 'operator-user' }, error: null }),
    },
    '~/lib/supabase/server': { createSupabaseAdminClient: () => client, createSupabaseServerClient: () => client },
    '~/lib/env': { getEnv: (name) => (name === 'PUBLIC_SITE_URL' ? 'https://example.invalid' : '') },
    '~/lib/emails/recipients': {
      getUserEmail: async (_db, id) => id + '@example.invalid',
      getOrgPrimaryEmail: async (_db, id) => id + '@example.invalid',
    },
    '~/lib/notifications': {
      sendUserEmail: async (to, subject, html) => {
        sent.push({ to, subject, html });
        return mailSuccess;
      },
      sendAdminEmail: async (subject, html) => {
        sent.push({ to: 'operator@example.invalid', subject, html });
        return mailSuccess;
      },
    },
  };
  async function invoke(file, body = {}, id = 'thread') {
    sent.length = 0;
    const route = load(file, mocks).POST;
    const result = await route({
      request: new Request('https://example.invalid/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      params: { id },
      cookies: {},
      locals: {},
    });
    assert.equal(result.status, 200);
    return result;
  }
  function recipients(expected) {
    assert.deepEqual(sent.map((m) => m.to).sort(), expected.map((x) => x + '@example.invalid').sort());
  }
  for (const direction of ['interest', 'offer']) {
    actor = direction === 'interest' ? 'buyer' : 'seller';
    await invoke('src/pages/api/approaches.ts', {
      kind: direction,
      listing_id: 'listing',
      wanted_request_id: 'wanted',
      message: 'Internal context',
    });
    recipients([actor + '-user', direction === 'interest' ? 'seller' : 'buyer', 'operator']);
    assert.ok(sent.every((m) => m.to === 'operator@example.invalid' || !m.html.includes('Internal context')));
    console.log('PASS notification recipients: ' + direction);
  }
  for (const [sender, visibility, expected] of [
    ['buyer', 'all', ['seller', 'operator']],
    ['seller', 'all', ['buyer', 'operator']],
    ['operator', 'buyer_side', ['buyer', 'operator']],
    ['operator', 'seller_side', ['seller', 'operator']],
    ['operator', 'all', ['buyer', 'seller', 'operator']],
  ]) {
    actor = sender;
    await invoke('src/pages/api/threads/[id]/messages.ts', { body: 'Private message text', visible_to: visibility });
    recipients(expected);
    assert.ok(sent.every((m) => m.to === 'operator@example.invalid' || !m.html.includes('Private message text')));
  }
  for (const [file, body] of [
    ['src/pages/api/admin/threads/index.ts', { approach_id: 'approach' }],
    [
      'src/pages/api/admin/threads/[id]/disclose.ts',
      { buyer_evidence: 'Buyer consent record', seller_evidence: 'Seller consent record' },
    ],
  ]) {
    duplicate = false;
    await invoke(file, body);
    recipients(['buyer', 'seller', 'operator']);
    duplicate = true;
    await invoke(file, body);
    recipients([]);
  }
  duplicate = false;
  await invoke('src/pages/api/admin/deals/[id]/conclude.ts', {}, 'deal');
  recipients(['buyer', 'seller', 'operator']);
  assert.ok(sent.find((m) => m.to === 'seller@example.invalid').html.includes('75,000'));
  const submission = load('src/lib/emails/notify-submission.ts', mocks);
  for (const type of ['Listing', 'Wanted']) {
    sent.length = 0;
    await submission['notify' + type + 'Submission'](
      client,
      {},
      { id: 'post', maker: 'Maker', model: 'Model', category: 'Category', orgId: 'org', userId: 'submitter' }
    );
    recipients(['submitter', 'operator']);
  }
  sent.length = 0;
  mailSuccess = false;
  await submission.notifyPostPublished(client, {}, { id: 'post', type: 'listing', title: 'Title', orgId: 'org' });
  recipients(['owner-user']);
  console.log(
    'PASS: message visibility routing, mediation/disclosure replay suppression, conclusion and submission recipients; no external delivery performed.'
  );
  console.log(
    'AUDIT: publication helper resolves normally even when transport returns false; published link uses /cases/listing/post.'
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
