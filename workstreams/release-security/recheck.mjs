import assert from 'node:assert/strict';
import {initialScene,validateScene,commitScene,readSavedScene,SAVE_KEY,MAX_REVISION} from '../../site/lib/scene.ts';
import {outsideObjects,resizeTank} from '../../site/lib/geometry.ts';
const results=[];
function check(name,fn){try{fn();results.push({name,status:'PASS'});}catch(e){results.push({name,status:'FAIL',message:e.message});}}
check('unsafe revision rejected',()=>{const s=initialScene();s.revision=2**53;assert.throws(()=>commitScene(s,s,s.revision));assert.throws(()=>validateScene(s));});
check('revision exhaustion rejected',()=>{const s=initialScene();s.revision=MAX_REVISION;assert.throws(()=>commitScene(s,s,s.revision),/limit/);});
check('oversized finite and NaN transforms rejected',()=>{for(const v of [1e308,NaN,Infinity]){const s=initialScene();s.objects[0].position=[v,0,0];assert.throws(()=>validateScene(s));s.objects[0].position=[0,0,0];s.objects[0].rotation=[v,0,0];assert.throws(()=>validateScene(s));}});
check('same-name resize fits only outside ID',()=>{const s=initialScene();s.objects=[{...s.objects[1],id:'safe',name:'Stone',protected:true,position:[0,.03,0]},{...s.objects[1],id:'outside',name:'Stone',protected:false,position:[.2,.03,0]}];const n=resizeTank(s,{...s.tank,width:.3}).scene;assert.deepEqual(n.objects[0],s.objects[0]);assert.deepEqual(outsideObjects(n),[]);});
const rock={id:'stone',name:'custom',kind:'rock',position:[.01,.03,.02],rotation:[0,.2,0],size:2,form:'faceted',color:'#112233',protected:true,stretch:[1,2,1]};
check('legacy known object fields preserved and source unchanged',()=>{const raw=JSON.stringify({revision:8,objects:[rock]});const m=new Map([['fishy.scene',raw]]);const out=readSavedScene({getItem:k=>m.get(k)??null});assert.deepEqual(out.scene.objects[0],rock);assert.equal(m.get('fishy.scene'),raw);});
check('legacy nested tank mapping retained',()=>{const out=readSavedScene({getItem:k=>k==='fishy.scene'?JSON.stringify({model:{objects:[rock],tank:{width:.9,depth:.4,height:.5,source:'user-entered'}}}):null});assert.equal(out.scene.tank.width,.9);assert.equal(out.scene.tank.height,.5);});
check('protected canonical equality ignores key insertion order',()=>{const s=initialScene();s.objects[0]=Object.fromEntries(Object.entries(s.objects[0]).reverse());assert.doesNotThrow(()=>commitScene(s,structuredClone(s),s.revision,'ai'));});
check('saved envelope restores exact scene past future and raw',()=>{const s=initialScene(),past=[{...s,brief:'previous'}],future=[{...s,brief:'future'}];const raw=JSON.stringify({scene:s,past,future});const out=readSavedScene({getItem:k=>k===SAVE_KEY?raw:null});assert.deepEqual(out.scene,s);assert.deepEqual(out.past,past);assert.deepEqual(out.future,future);assert.equal(out.raw,raw);});
check('cross-scene commit denied',()=>{const s=initialScene();assert.throws(()=>commitScene(s,{...s,id:'unrelated'},s.revision));});
check('empty scene identity denied',()=>{assert.throws(()=>validateScene({...initialScene(),id:''}));});
check('legacy nested scene metadata retained',()=>{const out=readSavedScene({getItem:k=>k==='fishy.scene'?JSON.stringify({model:{id:'custom-project',objects:[rock],brief:'Preserve nested brief',references:['ref-1'],substrate:.04}}):null});assert.equal(out.scene.id,'custom-project');assert.equal(out.scene.brief,'Preserve nested brief');assert.deepEqual(out.scene.references,['ref-1']);assert.equal(out.scene.substrate,.04);});
console.log(JSON.stringify(results,null,2));
