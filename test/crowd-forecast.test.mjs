import assert from "node:assert/strict";
import test from "node:test";

global.window = {};
await import("../crowd-forecast.js");
const { estimate } = window.CROWD_FORECAST;
const baseSpot = { id: "gangwon-beach", region: "강원", time: "day" };

test("population wording preserves the official level without inventing crowding", () => {
  assert.equal(window.CROWD_FORECAST.populationLabel("붐빔"), "혼잡");
  assert.equal(window.CROWD_FORECAST.populationLabel("약간 붐빔"), "약간 혼잡");
  assert.equal(window.CROWD_FORECAST.populationLabel("보통"), "보통");
  assert.equal(window.CROWD_FORECAST.populationLabel("unknown"), "확인 전");
});

test("weekend preferred time produces an explainable nationwide forecast", () => {
  const result = estimate(baseSpot, new Date("2026-09-27T05:00:00.000Z"));
  assert.equal(result.level, "다소 붐빌 수 있음");
  assert.deepEqual(result.reasons, ["주말 방문 수요", "낮 추천 시간대"]);
  assert.equal(result.affectsRanking, false);
});

test("verified seasonal context raises the forecast and remains inspectable", () => {
  const result = estimate({ ...baseSpot, seasonLabel: "2026 가을 · 10월 11일까지", sourceUrl: "https://example.com/official-event" }, new Date("2026-09-27T05:00:00.000Z"));
  assert.equal(result.level, "붐빌 가능성 높음");
  assert.ok(result.reasons.includes("2026 가을 · 10월 11일까지"));
  assert.equal(result.source, "https://example.com/official-event");
});

test("weekday outside the preferred time does not invent high congestion", () => {
  const result = estimate(baseSpot, new Date("2026-09-28T23:00:00.000Z"));
  assert.equal(result.level, "비교적 여유 예상");
  assert.deepEqual(result.reasons, ["평일 방문 수요", "주요 추천 시간대 밖"]);
});

test("forecasting does not mutate catalog data or add ranking fields", () => {
  const spot = { ...baseSpot };
  estimate(spot, new Date("2026-09-27T05:00:00.000Z"));
  assert.deepEqual(spot, baseSpot);
  assert.equal("score" in spot, false);
  assert.equal("rank" in spot, false);
});
