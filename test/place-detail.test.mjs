import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const markup = source.slice(source.indexOf('function resultScreen()'), source.indexOf('function render()'));
const css = readFileSync(new URL('../place-detail.css', import.meta.url), 'utf8');
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function screen({ missing=false, saved=false, back='browse', origin=true, visited=false, native=false }={}) {
  const spot = {id:'a',region:'서울',area:'동대문',title:'DDP <산책>',desc:'기존 설명',lat:37,lng:127};
  const sandbox = {
    state:{transport:'walk',selectedSpotId:'a',resultBack:back,savedSpotIds:saved?['a']:[],explorations:visited?[{spotId:'a'}]:[],shareOpen:false},
    allSpots:missing?[]:[spot],recommendableCatalogSpots:[spot,{...spot,id:'b',title:'다른 장소'}],
    transportData:{walk:{label:'도보'}},escapeHtml,spotDescriptions:{},
    showInternalBack:()=>!native, homeSketchFrame:()=>'<svg class="home-editorial__sketch-frame" aria-hidden="true"></svg>',
    header:(title,action)=>`<header data-back="${action}">${title}</header>`,bottomNav:active=>`<nav aria-label="하단 메뉴" data-active="${active}"></nav>`,
    distanceToSpot:()=>origin?1:null,distanceLabel:n=>`${n}km`,discoveryRewardForSpot:()=>null,
    placeAdmissionInfo:()=>'<p>기존 이용 조건</p>',spotReason:()=> '기존 추천 근거',
    crowdContext:()=>'<aside data-crowd-spot="a"></aside>',transportSelector:()=>'<div role="group" aria-label="이동수단"></div>',
    routeUrl:()=> 'https://map.kakao.com/link/search/DDP',originCoords:()=>origin?{}:null,hasCoords:Boolean,
  };
  vm.createContext(sandbox);
  vm.runInContext(`${markup}\nthis.output=resultScreen();`,sandbox);
  return sandbox.output;
}
test('detail retains routing, save, visit, share, crowd, alternatives and fixed navigation entry',()=>{
  const html=screen();
  for(const pattern of [/place-detail-screen/,/data-action="toggle-save"/,/data-action="verify-selected-spot"/,/data-map-link="detail"/,/data-crowd-spot/,/data-result-spot="b"/,/aria-label="하단 메뉴"/,/길찾기 · 지도 선택/]) assert.match(html,pattern);
  assert.doesNotMatch(html, /data-transport|aria-label="이동수단"/);
  assert.equal((html.match(/data-action="open-share"/g)||[]).length,1);
  assert.match(html,/<details[^>]*><summary>방문 전 확인/);
  assert.match(html,/기존 이용 조건/); assert.match(html,/기존 추천 근거/);
  assert.match(html,/DDP &lt;산책&gt;/);
  assert.doesNotMatch(html,/result-transport|place-card|이동시간<\/small>|mascot/);
});
test('Toss detail removes duplicate back without removing share, arrival or navigation',()=>{
  const html=screen({native:true});
  assert.doesNotMatch(html,/app-header__back|aria-label="이전 화면"/);
  assert.match(html,/place-detail__share/);
  assert.match(html,/data-action="verify-selected-spot"/);
  assert.match(html,/aria-label="하단 메뉴"/);
  assert.doesNotMatch(screen(),/app-header__back/);
});
test('detail handles saved, missing-place, no-origin and recorded states without losing return path',()=>{
  assert.match(screen({saved:true,back:'saved'}),/aria-pressed="true"/);
  assert.match(screen({back:'saved'}),/data-active="saved"/);
  assert.match(screen({origin:false}),/길찾기 · 지도 선택/);
  assert.match(screen({visited:true}),/방문 사진 1장/);
  const empty=screen({missing:true,back:'search'});
  assert.doesNotMatch(empty,/data-action="back-search-results"/); assert.match(empty,/하단 메뉴/);
});
test('arrival is fixed above navigation and sharing has an explicit header label',()=>{
  const html=screen();
  assert.match(html,/<header class="app-header">[\s\S]*class="place-detail__share"[\s\S]*<span>공유<\/span>[\s\S]*<\/header>/);
  assert.match(css,/\.place-detail__record \{ position:fixed; z-index:19;/);
  assert.match(css,/bottom:calc\(max\(12px,env\(safe-area-inset-bottom\)\) \+ 82px\)/);
  assert.match(css,/\.place-detail__record::after \{[^}]*top:100%[^}]*background:var\(--moa-canvas\); pointer-events:none/);
  assert.match(css,/padding:0 20px calc\(240px \+ env\(safe-area-inset-bottom\)\)/);
});
test('distance and crowd status are separated from readable source information',()=>{
  assert.match(css,/\.place-detail__distance strong \{[^}]*font-size:18px/);
  assert.match(css,/\.place-detail__crowd-heading strong \{[^}]*font-size:18px/);
  assert.match(css,/\.place-detail__crowd-context \{[^}]*font-size:14px/);
  assert.match(source,/placeCrowdContent\(node, "주변 인구 혼잡도"/);
  assert.match(source,/placeCrowdContent\(node, "예상 혼잡도"/);
  assert.match(source,/갱신 지연 ·/);
});
test('detail styling is scoped and ships through preview and release build',()=>{
  const selectors=[...css.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{/g)].map(m=>m[1].trim());
  assert.ok(selectors.every(s=>s.split(',').every(p=>p.trim().startsWith('.place-detail-screen'))));
  assert.doesNotMatch(css,/!important|box-shadow|linear-gradient/);
  for(const file of ['index.html','server.mjs','vite.config.mjs']) assert.match(readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),/place-detail\.css/);
});
