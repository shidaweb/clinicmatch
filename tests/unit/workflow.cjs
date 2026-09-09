const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
function load(file, mocks = {}, cache = {}) {
  const full = path.join(root, file);
  if (cache[full]) return cache[full];
  const exports = {};
  cache[full] = exports;
  const source = ts.transpileModule(fs.readFileSync(full, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(
    source,
    {
      exports,
      Response,
      Request,
      File,
      FormData,
      URLSearchParams,
      crypto,
      TextEncoder,
      console,
      Date,
      require(name) {
        if (Object.hasOwn(mocks, name)) return mocks[name];
        if (name.startsWith('~/')) return load('src/' + name.slice(2) + '.ts', mocks, cache);
        throw new Error('Unexpected dependency ' + name);
      },
    },
    { filename: file }
  );
  return exports;
}
(async () => {
  const { parseIntake } = load('src/lib/intake.ts');
  assert.ok(parseIntake({ topic: 'buy', body: 'Inmode' }, false, null).error, 'anonymous contact required');
  assert.equal(
    parseIntake({ topic: 'buy', body: 'PicoWay' }, false, 'member@example.invalid').value.contact_email,
    'member@example.invalid'
  );
  assert.ok(parseIntake({ formType: 'other', email: 'bad', name: 'Test' }, true, null).error);
  const parsed = parseIntake(
    { formType: 'buy', email: 'person@example.invalid', name: 'Test', budgetRange: '3-5', clinicName: 'Example' },
    true,
    null
  );
  assert.match(parsed.value.body, /300〜500万円/);
  assert.match(parsed.value.body, /Example/);
  const { filterCrm, crmPriority } = load('src/lib/crm.ts');
  const now = new Date('2026-09-09T01:00:00Z');
  const make = (id, overrides = {}) => ({
    id,
    source: 'wanted_requests',
    title: 'Pico',
    organization: 'Org',
    person: 'Buyer',
    email: '',
    publication: 'published',
    raw: {},
    createdAt: '2026-09-01',
    ...overrides,
  });
  const items = [
    make('draft', { publication: 'draft' }),
    make('public'),
    make('done', { crm: { status: 'completed' } }),
    make('due', { crm: { status: 'waiting', due_at: '2026-09-09T00:00:00Z' } }),
  ];
  assert.equal(crmPriority(items[3], now), 0);
  assert.equal(crmPriority(make('archived', { raw: { archived_at: '2026-09-08' } }), now), 9);
  assert.equal(
    filterCrm(items, new URLSearchParams(), true, now)
      .map((i) => i.id)
      .join(','),
    'due,public'
  );
  assert.equal(filterCrm(items, new URLSearchParams('q=Org'), false, now).length, 4);
  const mocks = {
    '~/lib/supabase/server': {
      createSupabaseServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
      createSupabaseAdminClient: () => admin,
    },
    '~/lib/emails/helpers': { getSiteUrl: () => 'https://example.invalid' },
    '~/lib/notifications': { sendAdminEmail: async () => false },
  };
  const calls = [];
  const admin = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: { id: 'receipt', duplicate: false }, error: null };
    },
    from: () => ({
      update: () => ({
        eq: () => ({
          in: () => ({ select: () => ({ maybeSingle: async () => ({ data: { id: 'receipt' }, error: null }) }) }),
          then: (resolve) => resolve({ error: null }),
        }),
      }),
    }),
  };
  const route = load('src/lib/receive-intake.ts', mocks).receiveIntake(true);
  const response = await route({
    request: new Request('https://example.invalid/api/contact', {
      method: 'POST',
      body: JSON.stringify({ formType: 'buy', name: 'Person', email: 'person@example.invalid', budgetRange: '3-5' }),
    }),
    cookies: {},
    locals: {},
  });
  assert.equal(response.status, 200, 'saved receipt succeeds despite notification failure');
  assert.equal(calls[0].name, 'receive_consultation');
  assert.equal(calls[0].args.p_data.contact_email, 'person@example.invalid');
  admin.rpc = async () => ({ data: null, error: { code: 'test', message: 'DB failure' } });
  const failed = await route({
    request: new Request('https://example.invalid/api/contact', {
      method: 'POST',
      body: JSON.stringify({ formType: 'buy', name: 'Person', email: 'person@example.invalid', budgetRange: '3-5' }),
    }),
    cookies: {},
    locals: {},
  });
  assert.equal(failed.status, 503, 'DB failure is not success');
  const malformed = await route({
    request: new Request('https://example.invalid', { method: 'POST', body: 'null' }),
    cookies: {},
    locals: {},
  });
  assert.equal(malformed.status, 400);
  // Storage can succeed before the metadata response is lost. Never delete that object.
  let uploads = 0,
    commits = 0;
  let rpcFails = true;
  let uploadDuplicate = false;
  let existingReceipt = null;
  const mediaAdmin = {
    from(table) {
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => ({
          data:
            table === 'post_media_receipts'
              ? existingReceipt
              : { id: '00000000-0000-4000-8000-000000000020', status: 'draft', archived_at: null },
          error: null,
        }),
      };
      return q;
    },
    storage: {
      from: () => ({
        upload: async () => {
          uploads++;
          return { error: uploadDuplicate ? { statusCode: '409' } : null };
        },
        remove: () => {
          throw new Error('Storage deletion must never run');
        },
      }),
    },
    rpc: async () => {
      commits++;
      return rpcFails
        ? { data: null, error: { message: 'response lost' } }
        : { data: { image: { id: 'image' } }, error: null };
    },
  };
  const mediaModule = load('src/lib/post-media.ts', {
    '~/lib/auth': { getProfile: async () => ({ id: 'actor', org_id: 'org' }) },
    '~/lib/supabase/server': { createSupabaseAdminClient: () => mediaAdmin },
  });
  assert.equal(mediaModule.imageFormat(new TextEncoder().encode('<svg></svg>')), null);
  const mediaRoute = mediaModule.uploadPostImage('listings');
  const uploadRequest = (bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])) => {
    const fd = new FormData();
    fd.append('file', new File([bytes], 'image.png', { type: 'image/png' }));
    return {
      request: new Request('https://example.invalid/api/listings/id', {
        method: 'POST',
        headers: { 'Idempotency-Key': '00000000-0000-4000-8000-000000000021' },
        body: fd,
      }),
      params: { id: '00000000-0000-4000-8000-000000000020' },
      cookies: {},
      locals: {},
    };
  };
  assert.equal((await mediaRoute(uploadRequest())).status, 503);
  rpcFails = false;
  uploadDuplicate = true;
  assert.equal((await mediaRoute(uploadRequest())).status, 200, 'storage duplicate permits metadata retry');
  assert.equal(uploads, 2);
  assert.equal(commits, 2);
  assert.equal((await mediaRoute(uploadRequest(new TextEncoder().encode('<svg></svg>')))).status, 400);
  assert.equal(uploads, 2, 'invalid file never reaches Storage');
  // Auth authorization must use the server-verified user, not the cookie session's user.
  let verified = false;
  const auth = load('src/lib/auth.ts', {
    '~/lib/supabase/server': {
      createSupabaseServerClient: () => ({
        auth: {
          getUser: async () => {
            verified = true;
            return { data: { user: null }, error: null };
          },
          getSession: () => {
            throw new Error('Unverified session used');
          },
        },
      }),
    },
  });
  assert.equal(await auth.getProfile({}, {}), null);
  assert.equal(verified, true);
  console.log(
    'PASS: contact validation/fallback, malformed requests, persisted intake despite notification failure, DB error state, CRM priority/filtering, verified authentication.'
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
