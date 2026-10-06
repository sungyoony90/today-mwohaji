import test from 'node:test';
import assert from 'node:assert/strict';
import {installGA,gaEvent,gaCampaign,GA_ID} from '../ga-analytics.js';
function fixture(origin='https://summer-mwohaji.web.tossmini.com',stored=null) {
  const handlers={},scripts=[];
  const win={location:{origin},localStorage:{getItem:()=>stored,setItem:()=>{}},addEventListener:(name,fn)=>handlers[name]=fn};
  const doc={createElement:()=>({}),head:{appendChild:script=>scripts.push(script)}};
  return {win,doc,scripts,send:event=>handlers['today-mwohaji:analytics']({detail:event})};
}
test('Google is never loaded before opt in or on local/QR previews',()=>{
  const f=fixture(); const api=installGA(f.win,f.doc,true);
  f.send({event_name:'app_opened'});assert.equal(f.scripts.length,0);
  api.setEnabled(true);assert.equal(f.scripts.length,1);
  api.setEnabled(false);assert.equal(f.win[`ga-disable-${GA_ID}`],true);
  const length=f.win.dataLayer.length;f.send({event_name:'app_opened'});assert.equal(f.win.dataLayer.length,length);
  for(const origin of ['http://127.0.0.1:4184','https://summer-mwohaji.private-apps.tossmini.com','https://summer-mwohaji.private-web.tossmini.com']) {
    const p=fixture(origin,'granted');installGA(p.win,p.doc,true);p.send({event_name:'app_opened'});assert.equal(p.scripts.length,0);
  }
});
test('current production origin loads GA with consent',()=>{
  const f=fixture('https://summer-mwohaji.apps.tossmini.com','granted');
  installGA(f.win,f.doc,true);assert.equal(f.scripts.length,1);
});
test('funnel and failure metadata accepts only known values',()=>{
  assert.deepEqual(gaEvent({event_name:'recommendation_step_completed',step:'preferences',address:'secret'}),{name:'recommendation_step_completed',params:{step:'preferences'}});
  assert.equal(gaEvent({event_name:'recommendation_results_viewed',result_count:0}).params.result_count,0);
  assert.equal(gaEvent({event_name:'location_failed',failure_reason:'permission_denied'}).params.failure_reason,'permission_denied');
  assert.deepEqual(gaEvent({event_name:'location_failed',failure_reason:'private address',activity:'private'}).params,{});
});
test('Instagram attribution is allowlisted and deferred until consent',()=>{
  const search='?utm_source=instagram&utm_medium=organic_social&utm_campaign=launch&utm_content=story_01&address=private';
  assert.equal(gaCampaign(search).campaign_content,'story_01');
  assert.deepEqual(gaCampaign(search.replace('story_01','private')),{});
  assert.deepEqual(gaCampaign(search+'&utm_source=instagram'),{});
  assert.deepEqual(gaCampaign(''),{});
  const f=fixture();f.win.location.search=search;
  const api=installGA(f.win,f.doc,true);
  assert.equal(f.scripts.length,0);
  api.setEnabled(true);
  const config=Array.from(f.win.dataLayer.find(v=>v[0]==='config'))[2];
  assert.equal(config.campaign_source,'instagram');
  assert.equal(JSON.stringify(f.win.dataLayer).includes('private'),false);
});
test('loaded analytics continues after 200 queued entries',()=>{
  const f=fixture(undefined,'granted');installGA(f.win,f.doc,true);
  f.scripts[0].onload();
  for(let i=0;i<250;i++)f.send({event_name:'activity_selected',activity:'walk'});
  assert.equal(f.win.dataLayer.filter(v=>v[1]==='activity_selected').length,250);
});
test('payload drops content, identifiers, location and arbitrary fields',()=>{
  const event=gaEvent({event_name:'visit_record_completed',screen:'my',photo:'private',address:'private',user_id:'secret',session_id:'secret',spot_id:'private',lat:37,has_reflection:true});
  assert.deepEqual(event,{name:'visit_record_completed',params:{screen:'my',has_reflection:true}});
  assert.equal(gaEvent({event_name:'arbitrary_sensitive_event'}),null);
});
test('virtual pages do not duplicate and never contain query or referrer data',()=>{
  const f=fixture(undefined,'granted');installGA(f.win,f.doc,true);
  f.send({event_name:'screen_viewed',screen:'my'});f.send({event_name:'screen_viewed',screen:'my'});
  const pages=f.win.dataLayer.map(v=>Array.from(v)).filter(v=>v[1]==='page_view');
  assert.equal(pages.length,1);assert.equal(pages[0][2].page_referrer,'');
  assert.equal(pages[0][2].page_location,'https://summer-mwohaji.apps.tossmini.com/my');
  f.scripts[0].onerror();assert.doesNotThrow(()=>f.send({event_name:'app_opened'}));assert.equal(f.win.dataLayer.length,0);
});
