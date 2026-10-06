import { readFile, writeFile } from 'node:fs/promises';
globalThis.window = {};
for (const file of ['catalog-activity-audit-1.js', 'catalog-activity-audit-2.js', 'catalog-activity-audit-3.js', 'activity-catalog.js']) await import(`../${file}`);
const captured = (await Promise.all([1, 2, 3].map(async (batch) => JSON.parse(await readFile(new URL(`../docs/research/catalog-audit-input-${batch}.json`, import.meta.url), 'utf8')).rows))).flat();
const reviews = [1, 2, 3].flatMap((batch) => window[`CATALOG_ACTIVITY_AUDIT_${batch}`]);
const reviewed = window.ActivityCatalog.applyAudit(captured, reviews);
const candidate = reviewed.filter((spot) => window.ActivityCatalog.isRecommendable(spot) && window.ActivityCatalog.isActive(spot, '2026-10-05'));
const count = (items, key) => Object.fromEntries([...new Set(items.map((row) => row[key]))].sort().map((value) => [value, items.filter((row) => row[key] === value).length]));
const summary = {
  date: '2026-10-05', capturedRecords: captured.length, reviewRecords: reviews.length,
  missingIds: captured.filter((spot) => !reviews.some((review) => review.id === spot.id)).map((spot) => spot.id),
  duplicateReviewCount: reviews.length - new Set(reviews.map((row) => row.id)).size,
  statuses: count(reviewed, 'classificationStatus'),
  classifiedWithActivities: reviewed.filter((spot) => spot.activities.length).length,
  recommendationRecords: candidate.length,
  uniqueRecommendationEntries: new Set(candidate.map((spot) => spot.duplicateOf || spot.id)).size,
  locationWarnings: reviewed.filter((spot) => spot.locationIssue).map(({ id, title, locationIssue }) => ({ id, title, locationIssue })),
  eligibleByActivity: Object.fromEntries(['walk', 'run', 'exhibit', 'read', 'cafe', 'play'].map((activity) => [activity, new Set(candidate.filter((spot) => spot.activities.includes(activity)).map((spot) => spot.duplicateOf || spot.id)).size])),
  eligibleByRegion: count(candidate, 'region'),
  retainedRecords: reviewed.length,
};
await writeFile(new URL('../docs/research/catalog-audit-summary-2026-10-05.json', import.meta.url), JSON.stringify(summary, null, 2));
await writeFile(new URL('../docs/research/catalog-audit-sources-receipt.json', import.meta.url), JSON.stringify({ schemaVersion: 1, items: [{
  id: 'catalog-classification', title: '전체 장소 분류·검수 집계', queries: [{ id: 'review-summary', source: {
    label: '프로토타입 전체 목록과 검수 기록', files: ['catalog-audit-summary-2026-10-05.json', 'catalog-activity-audit-1.js', 'catalog-activity-audit-2.js', 'catalog-activity-audit-3.js'],
    caveats: ['기록 ID 기준 집계이며 실제 운영 서비스 DB 등록 수나 고유 시설 수가 아니다.', '조건부 후보는 영업 중·현장 입장 가능·무예약 이용을 보장하지 않는다.'],
    filters: ['2026-10-05 기준 캡처된 390개 ID'],
  }, rows: Object.entries(summary.statuses).map(([status, records]) => ({ status, records })), columns: [{ field: 'status', label: '검수 상태' }, { field: 'records', label: '기록 수' }],
  preview: { kind: 'aggregate', note: '전체 390개 ID의 상태 집계', totalRows: reviewed.length },
  }],
}]}));
console.log(JSON.stringify(summary, null, 2));
