import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
test('map links use HTTPS destinations without forcing transport or transmitting origin', () => {
  const context = {hasCoords: p => Number.isFinite(p.lat) && Number.isFinite(p.lng)};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function mapProviderUrl('), source.indexOf('function mapPickerSheet(')), context);
  const spot = {title:'서울 숲',region:'서울',lat:37.54,lng:127.04};
  assert.match(context.mapProviderUrl(spot,'naver'), /^https:\/\/map.naver.com\/p\/search\//);
  assert.equal(new URL(context.mapProviderUrl(spot,'google')).searchParams.get('destination'), '37.54,127.04');
  assert.match(context.mapProviderUrl(spot,'kakao'), /\/link\/to\//);
  for (const p of ['naver','google','kakao']) assert.doesNotMatch(context.mapProviderUrl(spot,p), /travelmode|origin=|\/by\//);
  assert.match(context.mapProviderUrl({title:'동네 서점'},'kakao'), /\/link\/search\//);
});
test('recommendation no longer asks transport; picker closes before native navigation', () => {
  const activity = source.slice(source.indexOf('function activityScreen('),source.indexOf('function momentsScreen('));
  assert.doesNotMatch(activity,/어떻게 이동하세요|transportSelector/);
  assert.match(source,/if \(state.mapPickerSpotId\) \{\s*state.mapPickerSpotId = "";\s*\} else if \(state.openDiscoveryCardDate/);
  assert.match(source,/data-copy-map-place/);
});
