import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialScene,validateScene,readSavedScene,SAVE_KEY} from '../../../site/lib/scene.ts';
import {manualEditRecords,readManualEdits} from '../../../site/lib/frontier.ts';
import {prepareSave,MAX_SAVE_BYTES} from '../../../site/lib/save-envelope.ts';

test('size trimming preserves exact current scene, recent history and caller arrays',()=>{
 const s=initialScene(),rock=s.objects[1];s.objects=Array.from({length:11},(_,i)=>({...structuredClone(rock),id:`rock-${i}`,sculpt:{version:1,generator:'fishy-object-v11',basis:{kind:'rock',form:'faceted'},min:[-.1,0,-.1],max:[.1,.1,.1],nodes:Array.from({length:729},(_,index)=>({index,offset:[.1234567,.1234567,.1234567]}))}}));
 const canonical=validateScene(s),past=Array.from({length:12},(_,i)=>({...canonical,revision:i+1,brief:`history-${i}`}));
 const result=prepareSave(canonical,past,[],[]);assert(result.trimmed>0);assert(new TextEncoder().encode(result.raw).byteLength<=MAX_SAVE_BYTES);assert.equal(past.length,12);
 const out=readSavedScene({getItem:k=>k===SAVE_KEY?result.raw:null});assert.deepEqual(out.scene,canonical);assert.equal(out.past.at(-1).brief,'history-11');
});
test('v4 migration retains scene, history, journal and original storage bytes at helper boundary',()=>{
 const current=initialScene(),old={...current,schema:4,builder:'fishy-browser-2'},next=structuredClone(current);next.objects[1].position[0]+=.001;
 const journal=manualEditRecords(current,next,'2026-09-13T07:00:00Z'),raw=JSON.stringify({scene:old,past:[old],future:[],manualEdits:journal}),map=new Map([['fishy.studio.scene.v4',raw]]);
 const out=readSavedScene({getItem:k=>map.get(k)??null});assert.equal(out.scene.schema,5);assert.equal(out.past[0].schema,5);assert.deepEqual(out.manualEdits,journal);assert.equal(out.raw,null);assert.equal(map.get('fishy.studio.scene.v4'),raw);
});
test('hostile sculpt structural keys, duplicate nodes, nonfinite values and wrong basis reject',()=>{
 const s=initialScene();s.objects[1].sculpt={version:1,generator:'fishy-object-v11',basis:{kind:'rock',form:'faceted'},min:[-.1,0,-.1],max:[.1,.1,.1],nodes:[{index:0,offset:[.01,0,0]}]};
 for(const alter of [x=>{x.nodes.push({...x.nodes[0]})},x=>{x.nodes[0].offset[0]=Infinity},x=>{x.path='file:///private'},x=>{x.basis.form='other'}]){const next=structuredClone(s);alter(next.objects[1].sculpt);assert.throws(()=>validateScene(next));}
});
test('valid scene object IDs remain loadable through generated manual journals',()=>{
 const before=initialScene();before.objects[1].id='user rock';validateScene(before);const after=structuredClone(before);after.objects[1].position[0]+=.001;after.revision++;
 const journal=manualEditRecords(before,after,'2026-09-13T07:00:00Z'),{raw}=prepareSave(after,[before],[],journal);
 const out=readSavedScene({getItem:k=>k===SAVE_KEY?raw:null});assert.equal(out.scene.objects[1].id,'user rock');assert.doesNotThrow(()=>readManualEdits(JSON.parse(raw).manualEdits));
});
