import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { toTossAnalyticsPayload, deliverAnalytics } from '../analytics-adapter.js';

test('analytics uses the SDK schema and keeps only approved metadata', () => {
  const payload = toTossAnalyticsPayload({event_name:'visit_record_completed',log_type:'event',session_id:'session-a',visibility:'public',has_reflection:true,photo:'data:image/private',description:'private text',address:'private address',latitude:37,user_id:'private-user',jwt:'secret',error_message:'private'});
  assert.deepEqual(payload,{log_name:'visit_record_completed',log_type:'event',params:{session_id:'session-a',visibility:'public',has_reflection:true}});
});
test('invalid events and non-primitive values cannot cross the SDK boundary', () => {
  assert.equal(toTossAnalyticsPayload(null),null);
  assert.equal(toTossAnalyticsPayload({event_name:'private text!'}),null);
  assert.deepEqual(toTossAnalyticsPayload({event_name:'app_opened',log_type:'unknown',spot_id:{private:true},result_count:NaN,screen:'x'.repeat(161)}),{log_name:'app_opened',log_type:'event',params:{}});
});
test('analytics delivery tolerates both sync and async SDK failures', async () => {
  let received;
  deliverAnalytics(payload=>{received=payload;},{event_name:'app_opened',log_type:'event'});
  deliverAnalytics(()=>{throw new Error('SDK unavailable');},{event_name:'app_opened'});
  deliverAnalytics(()=>Promise.reject(new Error('offline')),{event_name:'app_opened'});
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(received.log_name,'app_opened');
});

const app = readFileSync(new URL('../app.js',import.meta.url),'utf8');
const persist = app.slice(app.indexOf('async function persistVisitPhoto()'),app.indexOf('function preferenceSnapshot()'));
async function record({fails=false,ready=true,checking=false}={}) {
  const events=[];
  const state={verify:{custom:true,isPublic:true,description:'private words',checking},explorations:[],publicVisits:[]};
  const context={state,visitPhotoReady:()=>ready,recordVisitPhoto:()=>({photo:'private photo'}),render:()=>{},trackEvent:(name,properties)=>events.push({name,properties}),window:{MoaData:{addVisit:async()=>{if(fails)throw new Error('private server message');return {isPublic:true};}}}};
  const result=await vm.runInNewContext(`${persist}\npersistVisitPhoto();`,context);
  return {events,result,state};
}
test('visit completion is emitted only after server success, without user content', async () => {
  const result=await record();
  assert.equal(result.result,true);
  assert.deepEqual(result.events.map(e=>e.name),['visit_record_submitted','visit_record_completed']);
  assert.equal(result.events[1].properties.has_reflection,true);
  assert.equal(JSON.stringify(result.events).includes('private words'),false);
});
test('failed and duplicate pending submissions do not count as completed records', async () => {
  const failed=await record({fails:true});
  assert.equal(failed.result,false);
  assert.deepEqual(failed.events.map(e=>e.name),['visit_record_submitted','visit_record_failed']);
  assert.equal((await record({ready:false})).events.length,0);
  assert.equal((await record({checking:true})).events.length,0);
});
test('screen tracking is keyed to navigation, not every render', () => {
  const source=app.slice(app.indexOf('  const analyticsKey ='),app.indexOf('  const screen = state.screen'));
  let views=0;
  const context={state:{screen:'result',selectedSpotId:'ddp'},analyticsScreen:'',analyticsViewId:0,trackEvent:name=>{if(name==='screen_viewed')views++;}};
  vm.runInNewContext(source,context); vm.runInNewContext(source.replace('const analyticsKey','var repeatKey').replaceAll('analyticsKey','repeatKey'),context);
  assert.equal(views,1);
  context.state.selectedSpotId='another-spot';
  vm.runInNewContext(source.replaceAll('analyticsKey','nextKey'),context);
  assert.equal(views,2);
});

test('place saving counts server confirmation, and failure restores previous state', async () => {
  const source=app.slice(app.indexOf('  if (target.dataset.action === "toggle-save")'),app.indexOf('  if (target.dataset.momentSave)'));
  for (const fails of [false,true]) {
    const events=[];
    const context={state:{selectedSpotId:'ddp',savedSpotIds:[],screen:'result'},target:{dataset:{action:'toggle-save'}},persistPreferences:async()=>{if(fails)throw new Error('offline');},trackEvent:name=>events.push(name),window:{alert:()=>{}}};
    await vm.runInNewContext(`(async()=>{${source}})()`,context);
    assert.deepEqual(events,[fails?'place_save_failed':'place_save_completed']);
    assert.equal(context.state.savedSpotIds.length,fails?0:1);
  }
});
test('SDK runtime uses the sanitized adapter instead of raw custom event details', () => {
  const runtime=readFileSync(new URL('../runtime-entry.js',import.meta.url),'utf8');
  assert.match(runtime,/deliverAnalytics\(payload => Analytics\.log\(payload\), event\.detail\)/);
  assert.doesNotMatch(runtime,/Analytics\.log\(event\.detail\)/);
});
