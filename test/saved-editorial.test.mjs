import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const savedSource=source.slice(source.indexOf('function simpleTabScreen('),source.indexOf('function discoveryBook('));
function draw(tab='places', empty=false) {
  const state={savedTab:tab,savedSpotIds:empty?[]:['a','b'],savedMomentIds:empty?[]:['m','missing']};
  const box={state,allSpots:[{id:'a',title:'첫 장소',region:'서울',area:'성동'},{id:'b',title:'최근 장소',region:'부산',area:'해운대'}],allMomentItems:()=>[{id:'m',place:'순간 장소',image:'photo.jpg',region:'서울',description:'기록 설명'}],escapeHtml:String,bottomNav:x=>`<nav>${x}</nav>`};
  vm.createContext(box); vm.runInContext(savedSource+';this.html=simpleTabScreen("saved")',box);
  return box.html;
}
test('saved places and moments are separate, newest saved first, existing IDs preserved',()=>{
  const places=draw(); assert.match(places,/data-saved-spot="a"/); assert.doesNotMatch(places,/data-saved-moment=/);
  assert.ok(places.indexOf('data-saved-spot="b"')<places.indexOf('data-saved-spot="a"'));
  const moments=draw('moments'); assert.match(moments,/data-saved-moment="m"/); assert.match(moments,/photo.jpg/); assert.doesNotMatch(moments,/data-saved-spot=/); assert.match(moments,/지금 볼 수 없는 저장 항목/);
});
test('each saved tab has its own empty state and discovery route',()=>{
  assert.match(draw('places',true),/아직 저장한 장소가 없어요/); assert.match(draw('places',true),/data-action="open-search"/);
  assert.match(draw('moments',true),/아직 저장한 순간이 없어요/); assert.match(draw('moments',true),/data-tab="moments"/);
});
test('moment detail and native back return to saved, with saved nav selected even if missing',()=>{
  const detail=source.slice(source.indexOf('function momentDetailScreen('),source.indexOf('async function openMomentMap('));
  for(const missing of [true,false]) {
    const box={state:{selectedMomentId:'m',momentDetailBack:'saved',savedMomentIds:['m']},momentById:()=>missing?null:{id:'m',place:'서울숲',image:'photo.jpg',region:'서울'},escapeHtml:String,header:(label,back)=>`<header>${back}</header>`,bottomNav:x=>`<nav>${x}</nav>`};
    vm.createContext(box); vm.runInContext(detail+';this.html=momentDetailScreen()',box);
    assert.match(box.html,/back-saved/); assert.match(box.html,/<nav>saved<\/nav>/);
  }
  assert.match(source,/"moment-detail": state.momentDetailBack === "saved" \? "saved"/);
});
test('saved style is shipped and isolated without shadows or global overrides',()=>{
  const css=readFileSync(new URL('../saved-editorial.css',import.meta.url),'utf8');
  assert.doesNotMatch(css,/!important|box-shadow|gradient/);
  assert.match(css,/aspect-ratio:4\/5/);
  assert.match(readFileSync(new URL('../vite.config.mjs',import.meta.url),'utf8'),/'saved-editorial.css'/);
});
