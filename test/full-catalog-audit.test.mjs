import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
globalThis.window = {};
for (const file of ['catalog-activity-audit-1.js', 'catalog-activity-audit-2.js', 'catalog-activity-audit-3.js', 'activity-catalog.js']) await import(`../${file}`);
const reviews = [1, 2, 3].flatMap((batch) => window[`CATALOG_ACTIVITY_AUDIT_${batch}`]);
const input = (await Promise.all([1, 2, 3].map(async (batch) => JSON.parse(await readFile(new URL(`../docs/research/catalog-audit-input-${batch}.json`, import.meta.url), 'utf8')).rows))).flat();

test('all 390 captured IDs have exactly one explicit classification decision', () => {
  assert.equal(input.length, 390);
  assert.equal(reviews.length, input.length);
  assert.equal(new Set(reviews.map((row) => row.id)).size, reviews.length);
  assert.deepEqual([...reviews.map((row) => row.id)].sort(), [...input.map((row) => row.id)].sort());
});

test('classification evidence distinguishes confirmed, conditional and held places', () => {
  for (const row of reviews) {
    assert.ok(['verified', 'conditional', 'hold', 'out-of-scope'].includes(row.reviewStatus), row.id);
    assert.ok(row.reason && row.admissionNote, row.id);
    assert.ok(Array.isArray(row.activities), row.id);
    assert.ok(row.activities.every((value) => ['walk', 'run', 'exhibit', 'read', 'cafe', 'play'].includes(value)), row.id);
    assert.equal(new Set(row.activities).size, row.activities.length, row.id);
    if (['verified', 'conditional'].includes(row.reviewStatus)) assert.ok(row.activities.length, row.id);
    if (row.reviewStatus === 'verified') assert.match(row.sourceUrl, /^https:\/\//, row.id);
  }
});

test('all records remain accessible, while hold/out-of-scope and wrong locations are gated', () => {
  const spots = window.ActivityCatalog.applyAudit(input, reviews);
  assert.equal(spots.length, input.length);
  assert.deepEqual(spots.map((row) => row.id), input.map((row) => row.id));
  for (const row of spots) {
    const review = reviews.find((item) => item.id === row.id);
    assert.equal(row.classificationStatus, review.reviewStatus, row.id);
    if (review.locationIssue) assert.equal(row.lat, null, row.id);
    if (['hold', 'out-of-scope'].includes(row.classificationStatus)) assert.equal(window.ActivityCatalog.isRecommendable(row), false, row.id);
  }
});
