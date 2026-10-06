import assert from "node:assert/strict";
import test from "node:test";
import { lookupRegionFromCoords } from "../server.mjs";

test("rejects invalid or unsupported coordinates before contacting Kakao", async () => {
  let called = false;
  const fetcher = async () => { called = true; };
  assert.equal((await lookupRegionFromCoords("", "", "test-key", fetcher)).status, 400);
  assert.equal((await lookupRegionFromCoords(40, 127, "test-key", fetcher)).status, 400);
  assert.equal(called, false);
});

test("requires a server-side key", async () => {
  assert.equal((await lookupRegionFromCoords(35.16, 129.16, "", async () => assert.fail("must not fetch"))).status, 503);
});

test("maps current coordinates to a nationwide supported region without returning coordinates", async () => {
  const result = await lookupRegionFromCoords(35.16, 129.16, "test-key", async (url, options) => {
    assert.equal(url.hostname, "dapi.kakao.com");
    assert.equal(url.pathname, "/v2/local/geo/coord2regioncode.json");
    assert.equal(url.searchParams.get("x"), "129.16");
    assert.equal(url.searchParams.get("y"), "35.16");
    assert.equal(options.headers.Authorization, "KakaoAK test-key");
    return { ok: true, json: async () => ({ documents: [{ region_type: "H", region_1depth_name: "부산광역시", region_2depth_name: "해운대구" }] }) };
  });
  assert.deepEqual(result, { status: 200, body: { region: "부산", label: "부산 해운대구" } });
});

test("does not invent a region when Kakao has no supported match", async () => {
  const result = await lookupRegionFromCoords(37, 127, "test-key", async () => ({ ok: true, json: async () => ({ documents: [] }) }));
  assert.equal(result.status, 422);
});
