import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const block = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
function context() {
  const sandbox = { state: { verify: {}, explorations: [] }, escapeHtml, selectedRegion: () => "서울", regions: ["서울", "부산"], normalizedRegion: (region) => region, hasCoords: (point) => point && Number.isFinite(point.lat) && Number.isFinite(point.lng), allSpots: [{ id: "known", title: "서울숲", region: "서울", area: "성동구", searchQuery: "서울숲" }] };
  vm.createContext(sandbox);
  vm.runInContext([
    block("function createVisitVerification(", "const state ="),
    block("function visitPhotoReady(", "function recordVisitPhoto("),
    block("function recordVisitPhoto(", "function moaLookUnlocked("),
    block("function recordedMomentItems(", "function communityMomentItems("),
    block("function visitReflectionFields(", "function verificationSheet("),
  ].join("\n"), sandbox);
  return sandbox;
}

test("new verification drafts default to private and empty optional note", () => {
  const ctx = context();
  const draft = ctx.createVisitVerification({ place: "서울숲", spotId: "known" });
  assert.equal(draft.isPublic, false);
  assert.equal(draft.description, "");
  assert.equal(draft.place, "서울숲");
  assert.equal(ctx.createVisitVerification().isPublic, false);
  assert.doesNotMatch(source, /state\.verify = \{/);
});

test("private notes stay in personal records and never enter public moments", () => {
  const ctx = context();
  ctx.state.verify = ctx.createVisitVerification({ place: " 동네 서점 ", address: "서울특별시 종로구 율곡로 1", photo: "data:image/png;base64,example", custom: true, description: " 조용해서 좋았어요. " });
  ctx.recordVisitPhoto();
  const record = ctx.state.explorations[0];
  assert.equal(record.place, "동네 서점");
  assert.equal(record.description, "조용해서 좋았어요.");
  assert.equal(record.isPublic, false);
  assert.equal(ctx.recordedMomentItems().length, 0);
  assert.equal(ctx.state.verify.open, false);
});

test("public registration carries photo, place and note to the feed", () => {
  const ctx = context();
  ctx.state.verify = ctx.createVisitVerification({ place: "old title", spotId: "known", photo: "photo", description: "산책하기 좋았어요", isPublic: true });
  ctx.recordVisitPhoto();
  const [moment] = ctx.recordedMomentItems();
  assert.equal(moment.place, "서울숲");
  assert.equal(moment.description, "산책하기 좋았어요");
  assert.equal(moment.image, "photo");
  assert.equal(moment.mapQuery, "서울숲");
  assert.equal(ctx.state.explorations.length, 1);
});

test("empty notes are allowed and existing records never become public implicitly", () => {
  const ctx = context();
  ctx.state.explorations = [{ id: "legacy", place: "기존 기록", photo: "legacy-photo" }];
  ctx.state.verify = ctx.createVisitVerification({ place: "새 기록", photo: "photo", isPublic: true });
  ctx.recordVisitPhoto();
  assert.equal(ctx.recordedMomentItems().length, 1);
  assert.equal(ctx.recordedMomentItems()[0].description, "");
  assert.equal(ctx.state.explorations.length, 2);
});

test("fields use explicit labels, an unchecked default and escaped optional text", () => {
  const ctx = context();
  ctx.state.verify = ctx.createVisitVerification({ description: '</textarea><script>alert("x")</script>' });
  const html = ctx.visitReflectionFields();
  assert.match(html, /이곳에서의 순간은 어땠나요/);
  assert.match(html, /maxlength="100"/);
  assert.match(html, /type="checkbox"/);
  assert.doesNotMatch(html, /\schecked\b|\srequired\b|<script>/);
  assert.match(html, /&lt;\/textarea&gt;/);
  ctx.state.verify.isPublic = true;
  assert.match(ctx.visitReflectionFields(), /\schecked\b/);
});

test("saving caps long notes and does not alter card award or location logic", () => {
  const ctx = context();
  ctx.state.verify = ctx.createVisitVerification({ place: "장소", photo: "photo", description: "가".repeat(120) });
  ctx.recordVisitPhoto();
  assert.equal(ctx.state.explorations[0].description.length, 100);
  const save = block("function recordVisitPhoto(", "async function persistVisitPhoto(");
  assert.doesNotMatch(save, /awardDiscoveryCard|discoveryRecords|location\.coords/);
  assert.match(source, /if \(!await persistVisitPhoto\(\)\) return;\s*awardDiscoveryCard\(spot, theme\);/);
  assert.match(source, /my-visit-card__note/);
});
