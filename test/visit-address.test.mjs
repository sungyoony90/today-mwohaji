import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const block = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function context(fetcher = async () => ({ ok: false, json: async () => ({}) })) {
  const ctx = {
    state: { verify: {}, explorations: [], location: { label: "서울", coords: { lat: 37.5, lng: 127 } } },
    escapeHtml, regions: ["서울", "부산", "경기도"], normalizedRegion: (r) => r === "경기도" ? "경기" : r,
    selectedRegion: () => "서울", allSpots: [], hasCoords: (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180,
    fetch: fetcher, render: () => {}, document: { querySelector: () => ({ focus() {} }) },
  };
  vm.createContext(ctx);
  vm.runInContext([
    block("function createVisitVerification(", "const state ="),
    block("function visitPhotoReady(", "function moaLookUnlocked("),
    block("function recordedMomentItems(", "function communityMomentItems("),
    block("function visitAddressFields(", "function visitReflectionFields("),
  ].join("\n"), ctx);
  return ctx;
}

test("custom places require an address but registered places keep their existing flow", () => {
  const ctx = context();
  ctx.state.verify = ctx.createVisitVerification({ custom: true, place: "서점", photo: "photo" });
  assert.equal(ctx.visitPhotoReady(), false);
  assert.equal(ctx.recordVisitPhoto(), false);
  assert.equal(ctx.state.explorations.length, 0);
  const markup = ctx.visitAddressFields();
  assert.match(markup, /id="verify-address"[^>]*required/);
  assert.match(markup, /주소 검색/);
  assert.doesNotMatch(markup, /방문 지역/);
  ctx.state.verify.custom = false;
  assert.equal(ctx.visitPhotoReady(), true);
  assert.match(ctx.visitAddressFields(), /방문 지역/);
});

test("manual address belongs to the visit, never to the home origin", () => {
  const ctx = context();
  const origin = JSON.stringify(ctx.state.location);
  ctx.state.verify = ctx.createVisitVerification({ custom: true, place: "서점", photo: "photo", address: " 부산광역시 중구 중앙대로 1 ", isPublic: true });
  ctx.recordVisitPhoto();
  const record = ctx.state.explorations[0];
  assert.equal(record.region, "부산");
  assert.equal(record.address, "부산광역시 중구 중앙대로 1");
  assert.equal(record.addressCoords, null);
  const [moment] = ctx.recordedMomentItems();
  assert.equal(moment.address, record.address);
  assert.equal(moment.mapQuery, `${record.address} 서점`);
  assert.equal(JSON.stringify(ctx.state.location), origin);
});

test("address search filters invalid results and does not replace the origin", async () => {
  let request = "";
  const ctx = context(async (url) => { request = url; return { ok: true, json: async () => ({ results: [
    { label: "부산 서점", address: "부산광역시 중구 중앙대로 1", region: "부산", lat: 35.1, lng: 129.0 },
    { label: "잘못된 주소", address: "", region: "부산", lat: 35.1, lng: 129.0 },
    { label: "잘못된 좌표", address: "부산광역시", region: "부산", lat: 999, lng: 999 },
  ] }) }; });
  const origin = JSON.stringify(ctx.state.location);
  ctx.state.verify = ctx.createVisitVerification({ step: "photo", custom: true, address: "부산 서점", description: "좋았어요", isPublic: true });
  await ctx.searchVisitAddress();
  assert.match(request, /^\/api\/origins\?query=/);
  assert.equal(ctx.state.verify.addressLookup.results.length, 1);
  assert.equal(ctx.state.verify.addressLookup.status, "ready");
  assert.equal(ctx.state.verify.description, "좋았어요");
  assert.equal(ctx.state.verify.isPublic, true);
  assert.equal(JSON.stringify(ctx.state.location), origin);
});

test("search failure still permits a manually entered exact address", async () => {
  const ctx = context(async () => { throw new Error("network unavailable"); });
  ctx.state.verify = ctx.createVisitVerification({ step: "photo", custom: true, place: "서점", photo: "photo", address: "서울특별시 종로구 율곡로 1" });
  await ctx.searchVisitAddress();
  assert.equal(ctx.state.verify.addressLookup.status, "error");
  assert.match(ctx.state.verify.addressLookup.message, /직접 입력/);
  assert.equal(ctx.visitPhotoReady(), true);
});

test("old search responses never overwrite an edited or reopened verification", async () => {
  let resolve;
  const ctx = context(() => new Promise((done) => { resolve = done; }));
  ctx.state.verify = ctx.createVisitVerification({ step: "photo", custom: true, address: "old" });
  const pending = ctx.searchVisitAddress();
  ctx.state.verify = ctx.createVisitVerification({ step: "photo", custom: true, address: "new" });
  resolve({ ok: true, json: async () => ({ results: [{ label: "old", address: "서울특별시", region: "서울", lat: 37, lng: 127 }] }) });
  await pending;
  assert.equal(ctx.state.verify.address, "new");
  assert.equal(ctx.state.verify.addressLookup.results.length, 0);
});

test("selected venue coordinates are preserved separately and markup is escaped", () => {
  const ctx = context();
  ctx.state.verify = ctx.createVisitVerification({ custom: true, place: "서점", address: "부산 중구", photo: "photo", region: "부산", addressCoords: { lat: 35.1, lng: 129 } });
  ctx.recordVisitPhoto();
  assert.equal(ctx.state.explorations[0].addressCoords.lat, 35.1);
  assert.notEqual(ctx.state.explorations[0].addressCoords, ctx.state.verify.addressCoords);
  ctx.state.verify.address = '"><script>alert(1)</script>';
  assert.doesNotMatch(ctx.visitAddressFields(), /<script>/);
});

test("map links include the registered address instead of a name-only query", async () => {
  const ctx = context();
  let opened = "";
  ctx.window = { __AIT_OPEN_URL__: async (url) => { opened = url; } };
  vm.runInContext(block("async function openMomentMap(", "function nearbyPlacesSection("), ctx);
  const query = "서울 성동구 성수동1가 678-1 서울숲";
  await ctx.openMomentMap({ place: "서울숲", mapQuery: query }, "kakao");
  assert.equal(opened, `https://map.kakao.com/link/search/${encodeURIComponent(query)}`);
  await ctx.openMomentMap({ place: "서울숲", mapQuery: query }, "naver");
  assert.equal(opened, `https://map.naver.com/p/search/${encodeURIComponent(query)}`);
});
