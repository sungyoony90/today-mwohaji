import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { installNativeBackBridge } from '../native-back.js';
const app = readFileSync(new URL('../app.js', import.meta.url),'utf8');
const handler = app.slice(app.indexOf('function handleNativeBack('),app.indexOf('window.addEventListener("today-mwohaji:native-back",'));
function back(overrides={}) {
  const state={screen:'home',verify:{open:false},...overrides};
  let renders=0,handled=false;
  const sandbox={state,render:()=>renders++,window:{scrollTo:()=>{}},event:{preventDefault:()=>{handled=true;}}};
  vm.runInNewContext(`${handler}\nhandleNativeBack(event);`,sandbox);
  return {state,renders,handled};
}
test('native back uses each detail entry and preserves place/filter data',()=>{
  for(const destination of ['search','saved','moments','home','browse']) {
    const result=back({screen:'result',resultBack:destination,selectedSpotId:'ddp',interest:'walk'});
    assert.equal(result.state.screen,destination); assert.equal(result.handled,true);
    assert.equal(result.state.selectedSpotId,'ddp'); assert.equal(result.state.interest,'walk');
  }
  assert.equal(back({screen:'browse'}).state.screen,'condition');
  assert.equal(back({screen:'condition'}).state.screen,'home');
  assert.equal(back({screen:'moment-detail',momentDetailBack:'liked-moments'}).state.screen,'liked-moments');
});
test('native back closes overlays first and does not interrupt pending authentication',()=>{
  for(const field of ['shareOpen','regionOpen','moaLookSheetOpen','rewardPreviewOpen']) {
    const result=back({screen:'result',[field]:true});
    assert.equal(result.state[field],false); assert.equal(result.state.screen,'result'); assert.equal(result.handled,true);
  }
  assert.equal(back({verify:{open:true}}).state.verify.open,false);
  const pending=back({verify:{open:true,checking:true}});
  assert.equal(pending.state.verify.open,true); assert.equal(pending.handled,true); assert.equal(pending.renders,0);
  assert.equal(back().handled,false);
});
test('visit detail returns to its entry and keeps expanded history',()=>{
  for (const entry of ['my', 'visit-history']) {
    const result = back({screen:'visit-detail',visitDetailBack:entry,visitListLimit:24});
    assert.equal(result.state.screen,entry);
    assert.equal(result.state.visitListLimit,24);
    assert.equal(result.handled,true);
  }
  assert.equal(back({screen:'visit-history'}).state.screen,'my');
});
test('SDK bridge only requests exit when the app does not handle back',async()=>{
  let callback,closed=0,handled=true;
  const cleanup=()=>{};
  const returned=installNativeBackBridge({events:{addEventListener:(name,args)=>{assert.equal(name,'backEvent');callback=args.onEvent;return cleanup;}},dispatchBack:()=>handled,close:()=>{closed++;},onError:()=>assert.fail('unexpected bridge error')});
  assert.equal(returned,cleanup);
  callback(); await Promise.resolve(); assert.equal(closed,0);
  handled=false;callback(); await Promise.resolve(); assert.equal(closed,1);
});
