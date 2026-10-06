import test from "node:test";
import assert from "node:assert/strict";

global.window = {};
await import("../spot-catalog.js");
await import("../seasonal-catalog.js");

const baseSpots = window.SPOT_CATALOG;
const seasonalSpots = window.SEASONAL_SPOTS;
const catalogExclusions = window.CATALOG_EXCLUSIONS;

function activeOn(spot, dateKey) {
  if (spot.auditStatus === "hold") return false;
  const month = Number(dateKey.slice(5, 7));
  if (spot.availableFrom && dateKey < spot.availableFrom) return false;
  if (spot.availableUntil && dateKey > spot.availableUntil) return false;
  return !spot.activeMonths || spot.activeMonths.includes(month);
}

function catalogOn(dateKey) {
  const activeSeasonal = seasonalSpots.filter((spot) => activeOn(spot, dateKey));
  const overrides = new Map(activeSeasonal.filter((spot) => spot.replacesSpotId).map((spot) => [spot.replacesSpotId, spot]));
  const excludedIds = new Set(catalogExclusions.map((entry) => entry.id));
  return [
    ...baseSpots
      .filter((spot) => !excludedIds.has(spot.id) || overrides.has(spot.id))
      .map((spot) => overrides.has(spot.id) ? { ...spot, ...overrides.get(spot.id), id: spot.id } : spot),
    ...activeSeasonal.filter((spot) => !spot.replacesSpotId),
  ];
}

test("seasonal catalog has unique targets and inspectable sources", () => {
  const keys = seasonalSpots.map((spot) => spot.replacesSpotId || spot.id);
  assert.equal(new Set(keys).size, keys.length);
  seasonalSpots.forEach((spot) => {
    assert.match(spot.sourceUrl, /^https:\/\//);
    assert.match(spot.sourceCheckedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(spot.seasonLabel);
    if (spot.replacesSpotId) assert.ok(baseSpots.some((base) => base.id === spot.replacesSpotId));
    else {
      assert.ok(spot.id && spot.title && spot.region && spot.area && spot.searchQuery);
      assert.ok(!baseSpots.some((base) => base.id === spot.id));
    }
  });
});

test("event records respect their exact verified start and end dates", () => {
  const current = seasonalSpots.filter((spot) => activeOn(spot, "2026-09-27"));
  assert.ok(current.some((spot) => spot.id === "gyeonggi-pocheon-garden-festa-2026"));
  assert.ok(current.some((spot) => spot.replacesSpotId === "gyeonggi-jaraseom"));
  assert.ok(current.some((spot) => spot.id === "gangwon-inje-autumn-flower-2026"));
  assert.ok(current.some((spot) => spot.replacesSpotId === "gyeongbok-night"));
  assert.ok(!current.some((spot) => spot.id === "seoul-nowon-moonlight-2026"));
  assert.ok(!current.some((spot) => spot.replacesSpotId === "hanul-park"));
  assert.ok(!seasonalSpots.filter((spot) => activeOn(spot, "2026-10-25")).some((spot) => spot.replacesSpotId === "gyeongbok-night"));
  assert.ok(seasonalSpots.filter((spot) => activeOn(spot, "2026-10-17")).some((spot) => spot.replacesSpotId === "hanul-park"));
  assert.ok(!seasonalSpots.filter((spot) => activeOn(spot, "2026-10-24")).some((spot) => spot.replacesSpotId === "hanul-park"));
  assert.ok(!seasonalSpots.filter((spot) => activeOn(spot, "2026-11-19")).some((spot) => spot.id === "seoul-nowon-moonlight-2026"));
});

test("annual autumn recommendations only appear in configured months", () => {
  const hwadam = seasonalSpots.find((spot) => spot.replacesSpotId === "gyeonggi-hwadamsup");
  assert.equal(activeOn(hwadam, "2026-10-15"), true);
  assert.equal(activeOn(hwadam, "2027-02-15"), false);
});

test("a shared 2025 roundup cannot activate unrelated 2026 place records", () => {
  const held = seasonalSpots.filter((spot) => spot.auditStatus === "hold");
  assert.equal(held.length, 25);
  held.forEach((spot) => {
    assert.match(spot.auditNote, /노출 보류/);
    assert.equal(activeOn(spot, "2026-09-27"), false);
  });
  const approvedSourceUrls = seasonalSpots.filter((spot) => spot.auditStatus !== "hold").map((spot) => spot.sourceUrl);
  assert.equal(new Set(approvedSourceUrls).size, approvedSourceUrls.length);
});

test("ended, unverified, and seasonal-only base records are excluded", () => {
  const exclusions = new Map(catalogExclusions.map((entry) => [entry.id, entry]));
  assert.equal(exclusions.get("hangang-pool").availableUntil, "2026-08-30");
  assert.equal(exclusions.get("hangang-pool").reason, "ended");
  assert.equal(exclusions.get("yeouido-nightmarket").reason, "current_schedule_unverified");
  assert.equal(exclusions.get("gyeongbok-night").availableUntil, "2026-10-24");

  const currentIds = new Set(catalogOn("2026-09-27").map((spot) => spot.id));
  assert.ok(currentIds.has("gyeongbok-night"));
  assert.ok(!currentIds.has("hangang-pool"));
  assert.ok(!currentIds.has("yeouido-nightmarket"));

  const afterEventIds = new Set(catalogOn("2026-10-25").map((spot) => spot.id));
  assert.ok(!afterEventIds.has("gyeongbok-night"));
});

test("active seasonal overrides do not inherit the invalid combined-region address", () => {
  catalogOn("2026-09-27")
    .filter((spot) => spot.sourceCheckedAt)
    .forEach((spot) => assert.doesNotMatch(spot.address || "", /전남광주통합특별시/));
});
