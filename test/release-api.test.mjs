import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('release API blocks unknown callers and validates public read requests', async () => {
  const source = await readFile(new URL('../supabase/functions/moa-public-api/index.ts', import.meta.url), 'utf8');
  let handler;
  globalThis.Deno = { env: { get: () => undefined }, serve: callback => { handler = callback; } };
  try {
    await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    const base = 'https://example.test/moa-public-api/api/';
    const headers = { apikey: 'sb_publishable_example_for_course_submission' };
    assert.equal((await handler(new Request(base + 'weather?region=서울'))).status, 403);
    assert.equal((await handler(new Request(base + 'weather', { method: 'POST', headers }))).status, 405);
    assert.equal((await handler(new Request(base + 'weather?region=unknown', { headers }))).status, 400);
    assert.equal((await handler(new Request(base + 'origins?query=서울숲', { headers }))).status, 503);
    assert.equal((await handler(new Request(base + 'crowd?spotId=unknown', { headers }))).status, 404);
    const preflight = await handler(new Request(base + 'weather', { method: 'OPTIONS' }));
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), '*');
  } finally {
    delete globalThis.Deno;
  }
});

test('release runtime uses HTTPS API and the SDK 3 Device URL bridge', async () => {
  const source = await readFile(new URL('../runtime-entry.js', import.meta.url), 'utf8');
  assert.match(source, /functions\/v1\/moa-public-api/);
  assert.match(source, /Device\.openURL\(url\)/);
  assert.doesNotMatch(source, /Screen\.openURL/);
  assert.doesNotMatch(source, /service_role|sb_secret_/);
});
