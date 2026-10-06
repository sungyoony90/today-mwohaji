import { writeFile } from 'node:fs/promises';
globalThis.window = {};
for (const file of ['spot-catalog.js', 'seasonal-catalog.js', 'activity-place-data.js', 'activity-extra-data.js', 'activity-spa-data.js', 'activity-catalog.js']) await import(`../${file}`);
const date = '2026-10-05';
const active = window.SEASONAL_SPOTS.filter((spot) => window.ActivityCatalog.isActive(spot, date) && (!spot.activeMonths || spot.activeMonths.includes(10)));
const overrides = new Map(active.filter((spot) => spot.replacesSpotId).map((spot) => [spot.replacesSpotId, spot]));
const excluded = new Set(window.CATALOG_EXCLUSIONS.map((spot) => spot.id));
const legacy = [...window.SPOT_CATALOG.filter((spot) => !excluded.has(spot.id) || overrides.has(spot.id)).map((spot) => overrides.has(spot.id) ? { ...spot, ...overrides.get(spot.id), id: spot.id } : spot), ...active.filter((spot) => !spot.replacesSpotId)];
const research = window.ActivityCatalog.build(legacy, [...window.ACTIVITY_PLACE_DATA, ...window.ACTIVITY_EXTRA_DATA, ...window.ACTIVITY_SPA_DATA], date);
const replacements = new Map(research.map((spot) => [spot.id, spot]));
const combined = [...legacy.map((spot) => replacements.get(spot.id) || spot), ...research.filter((spot) => !legacy.some((item) => item.id === spot.id))];
const unique = [...new Map(combined.map((spot) => [spot.id, spot])).values()];
for (let batch = 0; batch < 3; batch++) {
  const rows = unique.slice(batch * 130, (batch + 1) * 130);
  await writeFile(new URL(`../docs/research/catalog-audit-input-${batch + 1}.json`, import.meta.url), JSON.stringify({ date, total: unique.length, batch: batch + 1, rows }, null, 2));
}
console.log(`Exported ${unique.length} records in 3 audit batches.`);
