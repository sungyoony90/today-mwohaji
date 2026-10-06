import test from 'node:test';
import assert from 'node:assert/strict';
await import('../activity-catalog.js');
const { build, select, isActive } = globalThis.ActivityCatalog;
const row = { id: 'research-a', title: '공원 A', region: '서울', activities: ['walk'], lat: null, lng: null, auditStatus: 'candidate' };

test('manual classification retains records and IDs but excludes held records from recommendations', () => {
  const reviews = [
    { id: row.id, activities: ['walk', 'run'], reviewStatus: 'conditional', reason: '코스 확인', admissionNote: '운영 확인 필요' },
    { id: 'reserved', activities: ['play'], reviewStatus: 'hold', reason: '예약 필수', admissionNote: '예약이 필요해요' },
  ];
  const spots = globalThis.ActivityCatalog.applyAudit([row, { ...row, id: 'reserved' }, { ...row, id: 'unknown' }], reviews);
  assert.equal(spots.length, 3);
  assert.deepEqual(spots[0].activities, ['walk', 'run']);
  assert.equal(spots[2].classificationStatus, 'hold');
  assert.equal(select(spots, { activity: 'play', region: '서울' }).items.length, 0);
});

test('ambiguous classification and mismatched coordinates cannot create distance claims', () => {
  const review = { id: row.id, activities: ['play'], reviewStatus: 'verified', reason: '위치 불일치', admissionNote: '위치 확인 필요', sourceUrl: 'https://example.org/official', locationIssue: '다른 시설 좌표' };
  const [spot] = globalThis.ActivityCatalog.applyAudit([{ ...row, lat: 37.5, lng: 127 }], [review]);
  assert.equal(spot.lat, null);
  const [duplicate] = globalThis.ActivityCatalog.applyAudit([row], [review, review]);
  assert.equal(duplicate.classificationStatus, 'hold');
});

test('confirmed duplicate venue IDs stay saved but appear once in activity recommendations', () => {
  const second = { ...row, id: 'second' };
  const reviews = [row, second].map((spot) => ({ id: spot.id, activities: ['walk'], reviewStatus: 'conditional', reason: '같은 시설', admissionNote: '운영 확인 필요', ...(spot.id === 'second' ? { duplicateOf: row.id } : {}) }));
  const spots = globalThis.ActivityCatalog.applyAudit([row, second], reviews);
  assert.equal(spots.length, 2);
  assert.equal(select(spots, { activity: 'walk', region: '서울' }).items.length, 1);
});

test('reuse exact existing venue coordinates and stable saved ID without guessing', () => {
  const base = [{ id: 'existing-a', title: '공원 A', region: '서울', lat: 37.5, lng: 127 }];
  const [place] = build(base, [row], '2026-10-05');
  assert.equal(place.id, 'existing-a');
  assert.equal(place.lat, 37.5);
  const [unmatched] = build(base, [{ ...row, title: '공원 B' }], '2026-10-05');
  assert.equal(unmatched.lat, null);
  const [ambiguous] = build([...base, { ...base[0], id: 'other' }], [row], '2026-10-05');
  assert.equal(ambiguous.lat, null);
});

test('distinct exhibitions share their venue location but retain distinct IDs', () => {
  const base = [{ id: 'museum', title: '미술관', region: '서울', lat: 37.5, lng: 127 }];
  const items = build(base, [1, 2].map((n) => ({ ...row, id: `show-${n}`, title: `전시 ${n}`, venueTitle: '미술관', activities: ['exhibit'] })), '2026-10-05');
  assert.deepEqual(items.map((item) => item.id), ['show-1', 'show-2']);
  assert.ok(items.every((item) => item.lat === 37.5));
});

test('exclude holds and exhibitions outside their dates', () => {
  const show = { ...row, availableFrom: '2026-10-01', availableUntil: '2026-10-10' };
  assert.equal(isActive(show, '2026-09-30'), false);
  assert.equal(isActive(show, '2026-10-10'), true);
  assert.equal(isActive(show, '2026-10-11'), false);
  assert.equal(isActive({ ...row, auditStatus: 'hold' }, '2026-10-05'), false);
});

test('nearby mode crosses regional borders and puts unlocated local candidates last', () => {
  const spots = [{ ...row, id: 'local-unlocated' }, { ...row, id: 'far', lat: 35, lng: 129 }, { ...row, id: 'border', region: '경기', lat: 37.51, lng: 127 }];
  const result = select(spots, { activity: 'walk', region: '서울', origin: { lat: 37.5, lng: 127 } });
  assert.equal(result.mode, 'nearby');
  assert.deepEqual(result.items.map((item) => item.id), ['border', 'local-unlocated']);
  assert.equal(result.unlocatedCount, 1);
});

test('manual region works without permission or coordinates and keeps activity distinct', () => {
  const spots = [row, { ...row, id: 'run', activities: ['run'] }, { ...row, id: 'busan', region: '부산' }];
  const result = select(spots, { activity: 'walk', region: '서울', origin: null });
  assert.deepEqual(result.items.map((item) => item.id), [row.id]);
  assert.equal(result.items[0].distanceKm, null);
  assert.equal(result.mode, 'region');
});

test('research modules have unique IDs, explicit sources and exclude holds from recommendations', async () => {
  globalThis.window = {};
  await import('../activity-place-data.js');
  await import('../activity-extra-data.js');
  await import('../activity-spa-data.js');
  const rows = [...window.ACTIVITY_PLACE_DATA, ...window.ACTIVITY_EXTRA_DATA, ...window.ACTIVITY_SPA_DATA];
  assert.equal(new Set(rows.map((item) => item.id)).size, rows.length);
  assert.equal(new Set(window.ACTIVITY_EXTRA_DATA.map((item) => item.region)).size, 17);
  for (const item of rows) {
    assert.ok(item.title && item.region && item.admissionNote, item.id);
    assert.match(item.sourceUrl, /^https:\/\//, item.id);
    assert.match(item.sourceCheckedAt, /^\d{4}-\d{2}-\d{2}$/, item.id);
    assert.ok(['candidate', 'hold'].includes(item.auditStatus), item.id);
    assert.ok(item.activities.every((activity) => ['walk', 'run', 'exhibit', 'read', 'cafe', 'play'].includes(activity)), item.id);
  }
  const result = build([], rows, '2026-10-05');
  const held = new Set(rows.filter((item) => item.auditStatus === 'hold').map((item) => item.id));
  assert.ok(result.every((item) => !held.has(item.id)));
});

test('weekend-only pools and maintenance periods are not offered on closed dates', () => {
  const pool = { ...row, openWeekdays: [0, 6], openDates: ['2026-10-05', '2026-10-09'] };
  assert.equal(isActive(pool, '2026-10-05'), true);
  assert.equal(isActive(pool, '2026-10-06'), false);
  assert.equal(isActive(pool, '2026-10-10'), true);
  const spa = { ...row, closedWeekdays: [2, 3], availableUntil: '2026-10-11' };
  assert.equal(isActive(spa, '2026-10-06'), false);
  assert.equal(isActive(spa, '2026-10-10'), true);
  assert.equal(isActive(spa, '2026-10-12'), false);
});
