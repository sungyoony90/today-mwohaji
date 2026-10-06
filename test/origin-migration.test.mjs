import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateOriginStorage } from '../origin-migration.js';
const origin='https://summer-mwohaji.apps.tossmini.com';
const key='today-mwohaji-verified-discovery-cards-v2';
function fixture(old={},current={}) {
  const data=new Map(Object.entries(current));
  const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  return {data,storage,native:true,origin,getDump:async()=>({previous:{origin:'https://summer-mwohaji.web.tossmini.com',localStorage:old,errors:[]},current:{origin}})};
}
test('migration merges records with current winning and excludes secrets/consent',async()=>{
  const record={date:'2026-10-05',spotId:'old',verificationType:'gps-photo'};
  const f=fixture({[key]:JSON.stringify([record]),'moa-ga-consent-v1':'granted','moa-v2-auth':'secret'}, {[key]:JSON.stringify([{...record,spotId:'current'}])});
  assert.equal(await migrateOriginStorage(f),'done');
  assert.equal(JSON.parse(f.data.get(key))[0].spotId,'current');
  assert.equal(f.data.has('moa-ga-consent-v1'),false);
  assert.equal(f.data.has('moa-v2-auth'),false);
  f.getDump=()=>{throw Error('must not repeat');};
  assert.equal(await migrateOriginStorage(f),'done');
});
test('failure/timeout leaves migration retryable without late writes',async()=>{
  const f=fixture();let resolve;
  f.getDump=()=>new Promise(r=>{resolve=r;});f.timeoutMs=1;
  assert.equal(await migrateOriginStorage(f),'retry');
  resolve({previous:{origin:'https://summer-mwohaji.web.tossmini.com',localStorage:{},errors:[]},current:{origin}});
  await Promise.resolve();assert.equal(f.data.size,0);
});
test('only native current production origin migrates',async()=>{
  for(const o of ['https://summer-mwohaji.private-apps.tossmini.com','https://summer-mwohaji.web.tossmini.com']) {
    const f=fixture();f.origin=o;assert.equal(await migrateOriginStorage(f),'skipped');
  }
});
