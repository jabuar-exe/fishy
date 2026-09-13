import {validateScene,type SceneRecord} from "./scene.ts";
import type {ManualEdit} from "./frontier.ts";
// Conservative UTF-8 budget leaves room for UTF-16 storage accounting and the
// preserved v4 recovery record. Browser quota errors still leave that save intact.
export const MAX_SAVE_BYTES=1_500_000;
export function prepareSave(scene:SceneRecord,past:SceneRecord[],future:SceneRecord[],manualEdits:ManualEdit[]) {
  const envelope={scene:validateScene(scene),past:past.slice(-40),future:future.slice(-40),manualEdits:manualEdits.slice(-100)};let trimmed=0;
  const encoder=new TextEncoder(),bytes=(value:unknown)=>encoder.encode(JSON.stringify(value)).byteLength,counts={past:envelope.past.map(bytes),future:envelope.future.map(bytes),manualEdits:envelope.manualEdits.map(bytes)};
  let total=bytes({...envelope,past:[],future:[],manualEdits:[]})+Object.values(counts).reduce((n,list)=>n+list.reduce((a,b)=>a+b,0)+Math.max(0,list.length-1),0);
  while(total>MAX_SAVE_BYTES){const key=counts.manualEdits.length?"manualEdits":counts.past.length?"past":counts.future.length?"future":null;if(!key)throw new Error("Scene is too large for browser saving. Export it before continuing.");const removed=counts[key].shift()!;envelope[key].shift();total-=removed+(counts[key].length?1:0);trimmed++;}
  return {raw:JSON.stringify(envelope),trimmed};
}
