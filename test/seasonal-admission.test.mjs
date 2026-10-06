import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
test('confirmed autumn outing is classified and expires after its official end date', () => {
  const sandbox = {window:{}};
  vm.createContext(sandbox);
  for (const file of ['seasonal-catalog.js','activity-catalog.js']) vm.runInContext(readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),sandbox);
  const w = sandbox.window;
  const place = w.SEASONAL_SPOTS.find(p=>p.id==='goyang-autumn-flower-2026');
  const [reviewed] = w.ActivityCatalog.applyAudit([place],w.SEASONAL_ADMISSION_AUDIT);
  assert.equal(reviewed.classificationStatus,'verified');
  assert.equal(reviewed.activities[0],'walk');
  assert.equal(w.ActivityCatalog.isActive(reviewed,'2026-10-06'),true);
  assert.equal(w.ActivityCatalog.isActive(reviewed,'2026-10-12'),false);
  assert.match(`${place.title} ${place.desc}`, /가을|코스모스/);
  assert.ok(place.searchQuery);
  const additions = w.SEASONAL_SPOTS.filter(p => ['seocheon-sinseong-reeds','siheung-okgu-park','daegu-daemyeong-wetland'].includes(p.id));
  assert.equal(additions.length,3);
  for (const candidate of w.ActivityCatalog.applyAudit(additions,w.SEASONAL_ADMISSION_AUDIT)) {
    assert.equal(candidate.classificationStatus,'conditional');
    assert.equal(candidate.activities[0],'walk');
    assert.equal(w.ActivityCatalog.isRecommendable(candidate),true);
    assert.equal(w.ActivityCatalog.isActive(candidate,'2026-11-15'),true);
    assert.ok(candidate.activeMonths.includes(11));
    assert.match(candidate.admissionNote,/공식 관광 안내/);
  }
  assert.equal(w.SEASONAL_SPOTS.filter(p=>p.replacesSpotId==='incheon-sorae').length,1);
});
