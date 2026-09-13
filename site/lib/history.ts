import {commitScene,type SceneRecord} from "./scene.ts";

/** Capture the outgoing snapshot before React scheduling can change current refs. */
export function stepHistory(current:SceneRecord,past:SceneRecord[],future:SceneRecord[],direction:"undo"|"redo") {
  const target=(direction==="undo"?past:future).at(-1);if(!target)return null;
  const scene=commitScene(current,target,current.revision);
  return {scene,past:direction==="undo"?past.slice(0,-1):[...past.slice(-39),current],future:direction==="undo"?[...future.slice(-39),current]:future.slice(0,-1)};
}
