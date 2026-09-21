import * as T from "three";
import {GLTFLoader,type GLTF} from "three/examples/jsm/loaders/GLTFLoader.js";
import {clone as cloneSkeleton} from "three/examples/jsm/utils/SkeletonUtils.js";
import {disposeObject} from "./geometry.ts";
import {fishProfileById} from "./fish-species.ts";
import type {OrganismSpecies} from "./render-profile.ts";

const sources=new Map<OrganismSpecies,Promise<GLTF>>();
function source(species:OrganismSpecies) {
  let pending=sources.get(species);
  if(!pending){
    pending=new GLTFLoader().loadAsync(`/render-assets/models/${species}.glb`);
    void pending.catch(()=>{sources.delete(species);});
    sources.set(species,pending);
  }
  return pending;
}

export type AuthoredOrganism={root:T.Group;setTime:(time:number)=>void;dispose:()=>void};

/** Each swimmer owns its cloned skeleton, mixer, geometry and texture instances. */
export async function loadAuthoredFish(species:OrganismSpecies,size:number,phase:number):Promise<AuthoredOrganism> {
  const gltf=await source(species),root=new T.Group(),model=cloneSkeleton(gltf.scene),mixer=new T.AnimationMixer(model);
  model.traverse(object=>{
    if(!(object instanceof T.Mesh))return;
    object.geometry=object.geometry.clone();
    const own=(material:T.Material)=>{
      const copy=material.clone();
      for(const [key,value] of Object.entries(copy))if(value instanceof T.Texture)(copy as unknown as Record<string,unknown>)[key]=value.clone();
      if(copy.transparent){copy.depthWrite=false;copy.forceSinglePass=true;}
      return copy;
    };
    object.material=Array.isArray(object.material)?object.material.map(own):own(object.material);
    object.castShadow=true;object.receiveShadow=true;
    // Dynamic skinned bounds are deliberately conservative; the tiny schools
    // should not vanish when the tail crosses a bind-pose frustum boundary.
    object.frustumCulled=false;
  });
  // Generator exports every source model at an approximately one-metre span.
  model.scale.multiplyScalar(size/.956);root.add(model);root.name=`Authored ${species}`;
  for(const clip of gltf.animations)mixer.clipAction(clip).play();
  const setTime=(time:number)=>mixer.setTime(Math.max(0,time)*1.65*(fishProfileById.get(species)?.swimTempo??1)+phase);
  setTime(0);
  return {root,setTime,dispose:()=>{
    mixer.stopAllAction();mixer.uncacheRoot(model);
    model.traverse(object=>{if(object instanceof T.SkinnedMesh)object.skeleton.dispose();});
    disposeObject(root);
  }};
}

/** Kept for external integrations that still directly request the original neon rig. */
export const loadAuthoredTetra=(size:number,phase:number)=>loadAuthoredFish("neon-tetra",size,phase);
