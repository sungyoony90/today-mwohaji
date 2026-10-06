import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTossIdentity } from '../toss-identity.js';
import { createMoaData } from '../data-service.js';
import { exchangeTossCode, identityDigest, connectIdentity } from '../supabase/functions/moa-user-session/identity-core.js';

test('Toss HTTP 200 business failures never become a login', async () => {
  await assert.rejects(exchangeTossCode('code', async () => ({ ok: true, json: async () => ({ resultType: 'FAIL', error: { errorCode: '4011' } }) }), {}), { code: 'CODE_EXPIRED' });
  await assert.rejects(exchangeTossCode('code', async () => ({ ok: true, json: async () => ({ resultType: 'FAIL', error: { errorCode: '4095' } }) }), {}), { code: 'RATE_LIMITED' });
  await assert.rejects(exchangeTossCode('code', async () => ({ ok: true, json: async () => ({ resultType: 'SUCCESS', success: {} }) }), {}), { code: 'INVALID_TOSS_RESPONSE' });
});

test('exchange sends only the one-time code to the fixed HTTPS endpoint', async () => {
  const httpClient = {};
  const key = await exchangeTossCode('one-time', async (url, options) => {
    assert.equal(url, 'https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/users/anon-key/exchange');
    assert.deepEqual(JSON.parse(options.body), { code: 'one-time' });
    assert.equal(options.client, httpClient);
    assert.equal(options.redirect, 'error');
    return { ok: true, json: async () => ({ resultType: 'SUCCESS', success: { anonKey: 'verified-key' } }) };
  }, httpClient);
  assert.equal(key, 'verified-key');
  const digest = await identityDigest(key);
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.equal(digest, await identityDigest(key));
  assert.notEqual(digest, await identityDigest('other-key'));
});

function fixture({ bound = null, other = null, records = false, canonical = null } = {}) {
  const calls = [];
  const currentUser = { id: 'old-user', is_anonymous: true };
  let binding = bound;
  let owner = canonical || { ...currentUser };
  const store = {
    byDigest: async () => binding,
    byUser: async () => other,
    claim: async (digest, id) => { calls.push(['claim', id]); return binding = { user_id: id }; },
    hasRecords: async () => records,
  };
  const admin = {
    getUser: async () => owner,
    upgrade: async (id, email) => { calls.push(['upgrade', id]); owner = { ...owner, email, is_anonymous: false }; },
  };
  const issueSession = async (_email, id) => ({ access_token: 'access', refresh_token: 'refresh', user: { id } });
  return { currentUser, digest: 'a'.repeat(64), store, admin, issueSession, calls };
}

test('first connection adopts existing anonymous UUID, never rewrites records', async () => {
  const f = fixture({ records: true });
  const result = await connectIdentity(f);
  assert.equal(result.user_id, 'old-user');
  assert.deepEqual(f.calls, [['claim', 'old-user'], ['upgrade', 'old-user']]);
});

test('empty new-device account recovers original UUID', async () => {
  const f = fixture({ bound: { user_id: 'original' }, canonical: { id: 'original', email: `${'a'.repeat(64)}@toss-users.invalid`, is_anonymous: false } });
  const result = await connectIdentity(f);
  assert.equal(result.user_id, 'original');
  assert.deepEqual(f.calls, []);
});

test('second account with records cannot be discarded or merged silently', async () => {
  const f = fixture({ bound: { user_id: 'original' }, records: true });
  await assert.rejects(connectIdentity(f), { code: 'ACCOUNT_CONFLICT', status: 409 });
  assert.deepEqual(f.calls, []);
});

test('already-bound or permanent user cannot be rebound to another Toss key', async () => {
  const f = fixture({ other: { user_id: 'old-user' } });
  await assert.rejects(connectIdentity(f), { code: 'ACCOUNT_CONFLICT' });
  f.store.byUser = async () => null;
  f.currentUser.is_anonymous = false;
  await assert.rejects(connectIdentity(f), { code: 'ACCOUNT_CONFLICT' });
  assert.deepEqual(f.calls, []);
});

test('unexpected email and wrong generated session owner are rejected', async () => {
  const f = fixture({ bound: { user_id: 'old-user' }, canonical: { id: 'old-user', email: 'someone@example.com' } });
  await assert.rejects(connectIdentity(f), { code: 'ACCOUNT_CONFLICT' });
  const g = fixture();
  g.issueSession = async () => ({ access_token: 'access', refresh_token: 'refresh', user: { id: 'wrong-owner' } });
  await assert.rejects(connectIdentity(g), { code: 'SESSION_FAILED' });
});

function clientFixture({ existing = true, replies = null } = {}) {
  const calls = [];
  const session = { access_token: 'old-access', user: { id: 'old-user' } };
  const client = { auth: {
    getSession: async () => ({ data: { session: existing ? session : null } }),
    signInAnonymously: async () => { calls.push('anonymous'); return { data: { session } }; },
    setSession: async () => { calls.push('setSession'); return { data: { user: { id: 'old-user' } } }; },
  } };
  let count = 0;
  const ensure = createTossIdentity({ client, url: 'https://example.test', publishableKey: 'public',
    getAuthCode: async () => { calls.push('code'); return { code: 'one-time' }; },
    fetcher: async (url, options) => {
      calls.push('fetch');
      assert.deepEqual(JSON.parse(options.body), { code: 'one-time' });
      assert.equal(options.headers.Authorization, 'Bearer old-access');
      const reply = replies?.[count++] || { access_token: 'new-access', refresh_token: 'refresh', user_id: 'old-user' };
      return { ok: !reply.error, json: async () => reply };
    },
  });
  return { client, ensure, calls };
}

test('parallel client operations share one verification and keep original session', async () => {
  const f = clientFixture();
  const [a, b] = await Promise.all([f.ensure(), f.ensure()]);
  assert.equal(a.id, 'old-user'); assert.equal(b.id, a.id);
  assert.equal(a.moaRetainLocal, true);
  await f.ensure();
  assert.deepEqual(f.calls, ['code', 'fetch', 'setSession']);
});

test('new device creates one anonymous session before verifying; expired code retries once', async () => {
  const f = clientFixture({ existing: false, replies: [{ error: 'CODE_EXPIRED' }] });
  const restored = await f.ensure();
  assert.equal(restored.id, 'old-user');
  assert.equal(restored.moaRetainLocal, false);
  assert.deepEqual(f.calls, ['anonymous', 'code', 'fetch', 'code', 'fetch', 'setSession']);
});

test('conflicts and network failures never replace the local session', async () => {
  const f = clientFixture({ replies: [{ error: 'ACCOUNT_CONFLICT' }] });
  await assert.rejects(f.ensure(), /기록은 그대로/);
  assert.ok(!f.calls.includes('setSession'));
  const g = clientFixture();
  g.client.auth.setSession = async () => ({ error: new Error('raw secret'), data: {} });
  await assert.rejects(g.ensure(), error => !error.message.includes('secret'));
});

test('identity bindings and rate limiter are server-only; secrets absent from web imports', () => {
  const sql = readFileSync(new URL('../supabase/toss-identity.sql', import.meta.url), 'utf8');
  assert.match(sql, /unique references auth.users/);
  assert.match(sql, /enable row level security/g);
  assert.match(sql, /from public, anon, authenticated/);
  assert.doesNotMatch(sql, /security definer|create policy/i);
  const runtime = readFileSync(new URL('../runtime-entry.js', import.meta.url), 'utf8');
  assert.match(runtime, /User.createAnonymousKeyAuthCode/);
  assert.doesNotMatch(runtime, /TOSS_MTLS|identity-core|sb_secret_|service_role/);
  const server = readFileSync(new URL('../supabase/functions/moa-user-session/index.ts', import.meta.url), 'utf8');
  assert.match(server, /admin.auth.getUser/);
  assert.match(server, /request.method !== 'POST'/);
  assert.match(server, /allowedOrigins.has/);
  assert.doesNotMatch(server, /console\.(log|error)|user_metadata/);
});

test('native writes cannot race the initial identity restore', async () => {
  let verified = 0;
  const data = createMoaData({}, () => {}, { ensureIdentity: async () => { verified++; return { id: 'owner' }; } });
  await assert.rejects(data.savePreferences({ saved_spots: [] }), /기록을 불러온 뒤/);
  await assert.rejects(data.setLike('moment', true), /기록을 불러온 뒤/);
  await assert.rejects(data.addVisit({ photo: 'photo' }), /기록을 불러온 뒤/);
  assert.equal(verified, 0);
});
