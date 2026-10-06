import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
test('shared header never renders internal back even in unknown runtime',()=>{
  const source=app.slice(app.indexOf('const header ='),app.indexOf('function recentExploration('));
  for(const flags of [{__MOA_NATIVE__:true},{__MOA_RELEASE__:true},{}]) {
    const html=vm.runInNewContext(`${source}\nheader('장소 정보','back-browse',true)`,{window:flags});
    assert.equal(html.includes('app-header__back'),false);
    assert.match(html,/친구에게 공유/);
  }
});
test('internal back markup is absent instead of conditionally hidden',()=>{
  assert.doesNotMatch(app,/showInternalBack|app-header__back|activity-editorial__back|class="verify-back"|aria-label="(?:이전 화면|홈으로 돌아가기|마이로 돌아가기)"/);
  assert.doesNotMatch(app,/>목록으로 돌아가기<|>이전 화면으로 돌아가기</);
  assert.match(app,/addEventListener\("today-mwohaji:native-back", handleNativeBack\)/);
  assert.match(app,/data-action="close-verify"/);
});
test('unconfigured origin has no developer address or hardcoded coordinates',()=>{
  assert.match(app,/const PILOT_LOCATION = "위치 설정"/);
  assert.match(app,/const PILOT_COORDS = null/);
  assert.doesNotMatch(app,/시범 출발지|종로\d+길|37\.573374|127\.017581/);
  assert.doesNotMatch(app,/data-action="select-pilot-location"/);
});
test('legacy prototype storage is not restored and user-selected v3 origin persists',()=>{
  const source=app.slice(app.indexOf('const initialLocation ='),app.indexOf('function createVisitVerification'));
  const run=values=>vm.runInNewContext(`${source}\ninitialLocation`,{PILOT_LOCATION:'위치 설정',LOCATION_STORAGE_KEY:'today-mwohaji-origin-v3',LOCATION_REGION_STORAGE_KEY:'today-mwohaji-origin-region-v3',LOCATION_COORDS_STORAGE_KEY:'today-mwohaji-origin-coords-v3',localStorage:{getItem:key=>values[key]??null}});
  const legacy=run({'today-mwohaji-origin-v2':'private previous address','today-mwohaji-origin-coords-v2':'{"lat":37,"lng":127}'});
  assert.equal(legacy.label,'위치 설정');assert.equal(legacy.source,'pilot');assert.equal(legacy.coords,null);
  const selected=run({'today-mwohaji-origin-v3':'서울역','today-mwohaji-origin-region-v3':'서울','today-mwohaji-origin-coords-v3':'{"lat":37.55,"lng":126.97}'});
  assert.equal(selected.label,'서울역');assert.equal(selected.source,'selected');
  assert.equal(selected.coords.lat,37.55);
});
