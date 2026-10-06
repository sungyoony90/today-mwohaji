import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const code = app.slice(app.indexOf('function orderedVisits()'), app.indexOf('function myScreen()'));
const escapeHtml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
function renderHistory(count, limit = 12) {
  const state = {visitListLimit:limit, explorations:Array.from({length:count}, (_, i) => ({id:`record-${i}`,place:'해변 <script>',region:'강원',photo:'photo.png',createdAt:new Date(2026,9,6-i*3).toISOString()}))};
  return vm.runInNewContext(`${code}; visitHistoryScreen()`, {state, escapeHtml, MANY_VISITS_PREVIEW:false, bottomNav:()=>'<nav>my</nav>', recentExploration:()=>'<p>empty-state</p>'});
}
test('visit history renders empty, one and 24 records without loading all cards at once', () => {
  assert.match(renderHistory(0), /empty-state/);
  assert.equal((renderHistory(1).match(/data-visit-detail=/g)||[]).length,1);
  const firstPage=renderHistory(24);
  assert.equal((firstPage.match(/data-visit-detail=/g)||[]).length,12);
  assert.match(firstPage, /more-visits/);
  const all=renderHistory(24,24);
  assert.equal((all.match(/data-visit-detail=/g)||[]).length,24);
  assert.doesNotMatch(all,/more-visits/);
  assert.match(all,/2026년 10월/);
  assert.match(all,/2026년 9월/);
  assert.match(all,/2026년 8월/);
  assert.doesNotMatch(all,/<script>/);
});
test('starter Moa is counted without awarding an authentication card', () => {
  const looks=app.slice(app.indexOf('const moaLooks ='),app.indexOf('const discoveryThemes ='));
  const unlocked=app.slice(app.indexOf('function moaLookUnlocked('),app.indexOf('function activeMoaLook('));
  for (const [cards,expected] of [[0,1],[2,1],[3,2],[9,2],[10,3],[19,3],[20,4]]) {
    const state={discoveryRecords:Array.from({length:cards},()=>({}))};
    assert.equal(vm.runInNewContext(`${looks}\n${unlocked}\nmoaLooks.filter(moaLookUnlocked).length`,{state}),expected);
    assert.equal(state.discoveryRecords.length,cards);
  }
});
