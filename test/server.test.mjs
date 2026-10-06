import assert from "node:assert/strict";
import test from "node:test";
import { getSeoulCrowdForSpot, seoulCrowdAreaBySpotId } from "../server.mjs";

const now = Date.parse("2026-09-27T03:10:00Z");
const successPayload = (overrides = {}) => ({
  RESULT: { "RESULT.CODE": "INFO-000", "RESULT.MESSAGE": "정상 처리되었습니다" },
  "SeoulRtd.citydata_ppltn": [{
    AREA_NM: "서울숲공원",
    AREA_CONGEST_LVL: "보통",
    PPLTN_TIME: "2026-09-27 12:00",
    ...overrides,
  }],
});

test("only explicitly mapped spots can request crowd data", async () => {
  let called = false;
  const result = await getSeoulCrowdForSpot("not-supported", "key", async () => { called = true; });
  assert.equal(result.status, 404);
  assert.equal(called, false);
  assert.equal(seoulCrowdAreaBySpotId["seoul-forest"], "서울숲공원");
});

test("API key stays server-side and is required", async () => {
  const result = await getSeoulCrowdForSpot("seoul-forest", "", async () => assert.fail("must not fetch"));
  assert.equal(result.status, 503);
});

test("returns fresh area-level congestion without ranking fields", async () => {
  const result = await getSeoulCrowdForSpot("seoul-forest", "test-key", async (url) => {
    assert.match(url.pathname, /\/test-key\/json\/citydata_ppltn\/1\/1\//);
    return { ok: true, json: async () => successPayload() };
  }, now);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    area: "서울숲공원",
    level: "보통",
    observedAt: "2026-09-27T03:00:00.000Z",
    source: "서울특별시 실시간 도시데이터",
    affectsRanking: false,
  });
});

test("rejects stale or mismatched area data", async () => {
  const stale = await getSeoulCrowdForSpot("ddp-night", "test-key", async () => ({
    ok: true,
    json: async () => successPayload({ AREA_NM: "DDP(동대문디자인플라자)", PPLTN_TIME: "2026-09-27 10:00" }),
  }), now);
  assert.equal(stale.status, 502);

  const mismatch = await getSeoulCrowdForSpot("ddp-night", "test-key", async () => ({
    ok: true,
    json: async () => successPayload(),
  }), now + 61_000);
  assert.equal(mismatch.status, 502);
});

test("delayed population observation is explicitly marked and never called live", async () => {
  const result = await getSeoulCrowdForSpot("ddp-night", "test-key", async () => ({
    ok: true,
    json: async () => successPayload({ AREA_NM: "DDP(동대문디자인플라자)", PPLTN_TIME: "2026-09-27 11:30" }),
  }), now + 122_000);
  assert.equal(result.status, 200);
  assert.equal(result.body.freshness, "delayed");
  assert.equal(result.body.observedAt, "2026-09-27T02:30:00.000Z");
});
