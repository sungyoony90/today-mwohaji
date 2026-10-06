// Counts records/IDs, not unique physical venues or production database rows.
globalThis.window = {};
for (const file of ['spot-catalog.js', 'seasonal-catalog.js', 'activity-place-data.js', 'activity-extra-data.js', 'activity-spa-data.js', 'activity-catalog.js']) await import(`../${file}`);
const date = process.argv[2] || '2026-10-05';
const active = window.SEASONAL_SPOTS.filter((spot) => window.ActivityCatalog.isActive(spot, date) && (!spot.activeMonths || spot.activeMonths.includes(Number(date.slice(5, 7)))));
const overrides = new Map(active.filter((spot) => spot.replacesSpotId).map((spot) => [spot.replacesSpotId, spot]));
const excluded = new Set(window.CATALOG_EXCLUSIONS.map((spot) => spot.id));
const legacy = [...window.SPOT_CATALOG.filter((spot) => !excluded.has(spot.id) || overrides.has(spot.id)).map((spot) => overrides.has(spot.id) ? { ...spot, ...overrides.get(spot.id), id: spot.id } : spot), ...active.filter((spot) => !spot.replacesSpotId)];
const research = [...window.ACTIVITY_PLACE_DATA, ...window.ACTIVITY_EXTRA_DATA, ...window.ACTIVITY_SPA_DATA];
const places = window.ActivityCatalog.build(legacy, research, date);
const legacyIds = new Set(legacy.map((spot) => spot.id));
const added = places.filter((spot) => !legacyIds.has(spot.id));
const countBy = (items, key) => Object.fromEntries([...new Set(items.map((spot) => spot[key]))].sort().map((value) => [value, items.filter((spot) => spot[key] === value).length]));
console.log(JSON.stringify({ date,
  originalRows: window.SPOT_CATALOG.length,
  originalUniqueIds: new Set(window.SPOT_CATALOG.map((spot) => spot.id)).size,
  activeLegacyUniqueIds: legacyIds.size,
  researchedRecords: research.length,
  researchStatus: countBy(research, 'auditStatus'),
  eligibleResearchRecords: places.length,
  reusedLegacyIds: places.length - added.length,
  addedRecords: added.length,
  combinedActiveUniqueIds: new Set([...legacyIds, ...added.map((spot) => spot.id)]).size,
  eligibleByActivity: Object.fromEntries(['walk','run','exhibit','read','cafe','play'].map((activity) => [activity, places.filter((spot) => spot.activities.includes(activity)).length])),
  activityResearch: countBy([...window.ACTIVITY_EXTRA_DATA, ...window.ACTIVITY_SPA_DATA], 'auditStatus'),
  eligibleResearchByRegion: countBy(places, 'region'),
  eligibleWithCoordinates: places.filter((spot) => Number.isFinite(spot.lat) && Number.isFinite(spot.lng)).length,
}, null, 2));
