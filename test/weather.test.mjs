import assert from "node:assert/strict";
import { test } from "node:test";
import { getRegionWeather } from "../server.mjs";

const now = Date.parse("2026-09-27T04:00:00.000Z");
const kmaPayload = ({ pty = "0", sky = "1" } = {}) => ({
  response: {
    header: { resultCode: "00", resultMsg: "NORMAL_SERVICE" },
    body: { items: { item: [
      { category: "PTY", fcstDate: "20260927", fcstTime: "1300", fcstValue: pty },
      { category: "SKY", fcstDate: "20260927", fcstTime: "1300", fcstValue: sky },
    ] } },
  },
});
const openMeteoPayload = (code, time = "2026-09-27T12:45") => ({ current: { weather_code: code, time } });

test("uses KMA first with a representative grid and keeps the key server-side", async () => {
  let requested;
  const result = await getRegionWeather("서울", "test-kma-key", async (url) => {
    requested = url;
    return { ok: true, json: async () => kmaPayload() };
  }, now);
  assert.equal(result.status, 200);
  assert.equal(result.body.kind, "clear");
  assert.equal(result.body.source, "기상청 단기예보 조회서비스");
  assert.equal(result.body.scope, "region-representative");
  assert.equal(requested.hostname, "apis.data.go.kr");
  assert.equal(requested.searchParams.get("nx"), "60");
  assert.equal(requested.searchParams.get("ny"), "127");
  assert.equal(requested.searchParams.get("serviceKey"), "test-kma-key");
  assert.equal(requested.searchParams.has("latitude"), false);
});

test("does not label KMA snow as rain", async () => {
  const result = await getRegionWeather("강원", "test-kma-key", async () => ({ ok: true, json: async () => kmaPayload({ pty: "3", sky: "4" }) }), now);
  assert.equal(result.body.kind, "snow");
  assert.equal(result.body.source, "기상청 단기예보 조회서비스");
});

test("falls back to Open-Meteo when KMA is unavailable", async () => {
  const hosts = [];
  const result = await getRegionWeather("인천", "test-kma-key", async (url) => {
    hosts.push(url.hostname);
    if (url.hostname === "apis.data.go.kr") return { ok: false, json: async () => ({}) };
    return { ok: true, json: async () => openMeteoPayload(61) };
  }, now);
  assert.equal(result.status, 200);
  assert.equal(result.body.kind, "rain");
  assert.equal(result.body.source, "Open-Meteo");
  assert.deepEqual(hosts, ["apis.data.go.kr", "api.open-meteo.com"]);
});

test("falls back when the region is unsupported or every value is stale", async () => {
  assert.equal((await getRegionWeather("내 스팟", "test-kma-key", async () => assert.fail("must not fetch"), now)).status, 400);
  const result = await getRegionWeather("제주", "", async () => ({ ok: true, json: async () => openMeteoPayload(0, "2026-09-27T08:00") }), now);
  assert.equal(result.status, 502);
});
