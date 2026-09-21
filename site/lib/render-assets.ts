import * as T from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {catalogEntryById} from "./catalog.ts";
import type {SceneObject,SceneRecord} from "./scene";

/** Fishy-authored geometry with documented CC0 scan inputs; see public/render-assets/README.md. */
export const FIDELITY_ASSETS={
  "wood-arch":"/render-assets/models/wood-arch.glb",
  "rock-rounded":"/render-assets/models/rock-rounded.glb",
  "rock-strata":"/render-assets/models/rock-strata.glb",
  "plant-fern":"/render-assets/models/plant-fern.glb",
  "plant-broadleaf":"/render-assets/models/plant-broadleaf.glb",
  "plant-grass":"/render-assets/models/plant-grass.glb",
  "wood-root":"/render-assets/models/wood-root.glb",
  "wood-stump":"/render-assets/models/wood-stump.glb",
  "plant-stem":"/render-assets/models/plant-stem.glb",
  "plant-moss":"/render-assets/models/plant-moss.glb",
} as const;
export type FidelityAssetId=keyof typeof FIDELITY_ASSETS;

type LoadedAsset={scene:T.Group};
const loader=new GLTFLoader();
const cache=new Map<FidelityAssetId,Promise<LoadedAsset>>();

export function fidelityAssetFor(object:Pick<SceneObject,"kind"|"form"|"catalogId"|"sculpt">):FidelityAssetId|null {
  if(object.sculpt?.nodes.length)return null;
  if(object.kind==="wood")return object.form==="stump"?"wood-stump":["arch","angular"].includes(object.form)?"wood-arch":"wood-root";
  if(object.kind==="rock"&&object.form==="faceted")return "rock-strata";
  if(object.kind==="rock"&&(["rounded","faceted"].includes(object.form)||object.catalogId==="rock-black-river"))return "rock-rounded";
  if(object.kind!=="plant")return null;
  if(object.form==="fern"||object.catalogId==="plant-bolbitis-heudelotii")return "plant-fern";
  if(object.form==="broadleaf"||["plant-anubias-petite","plant-bucephalandra-bukit-kelam","plant-cryptocoryne-wendtii-green"].includes(object.catalogId??""))return "plant-broadleaf";
  if(object.form==="grass"||object.catalogId==="plant-eleocharis-pusilla-mini")return "plant-grass";
  if(["moss","carpet"].includes(object.form))return "plant-moss";
  return "plant-stem";
}

async function sourceAsset(id:FidelityAssetId):Promise<LoadedAsset> {
  let pending=cache.get(id);
  if(!pending){
    pending=loader.loadAsync(FIDELITY_ASSETS[id]).then(gltf=>({scene:gltf.scene}));
    cache.set(id,pending);
    void pending.catch(()=>{if(cache.get(id)===pending)cache.delete(id);});
  }
  return pending;
}

function cloneTexture(value:unknown) { return value instanceof T.Texture?value.clone():value; }
function cloneMaterial(material:T.Material) {
  const instance=material.clone();
  // Material.clone shares image textures. Every placed asset owns its texture
  // instances so the existing generic geometry disposal remains safe.
  for(const key of Object.keys(instance) as Array<keyof T.Material>) {
    const value=instance[key];
    if(value instanceof T.Texture)(instance as unknown as Record<string,unknown>)[key as string]=cloneTexture(value);
  }
  return instance;
}
/** Returns fully-owned geometry, materials and textures from a cached GLTF source. */
export function cloneFidelityAsset(source:T.Group) {
  const cloned=source.clone(true);
  cloned.traverse(node=>{
    if(!(node instanceof T.Mesh))return;
    node.geometry=node.geometry.clone();
    node.material=Array.isArray(node.material)?node.material.map(cloneMaterial):cloneMaterial(node.material);
    node.castShadow=true;node.receiveShadow=true;
    node.userData.fishyAsset=true;
  });
  return cloned;
}

/** World-independent bounds expressed in the object's own local coordinate space. */
export function localBounds(root:T.Object3D) {
  root.updateWorldMatrix(true,true);
  const inverse=root.matrixWorld.clone().invert(),box=new T.Box3(),scratch=new T.Box3(),localMatrix=new T.Matrix4();
  root.traverse(node=>{
    if(!(node instanceof T.Mesh))return;
    if(!node.geometry.boundingBox)node.geometry.computeBoundingBox();
    if(!node.geometry.boundingBox)return;
    // Transform each source AABB only once. Transforming an already-world-space
    // AABB through the inverse root matrix would expand it at rotated roots.
    localMatrix.multiplyMatrices(inverse,node.matrixWorld);
    scratch.copy(node.geometry.boundingBox).applyMatrix4(localMatrix);
    box.union(scratch);
  });
  return box;
}

export function fitAssetToLocalBounds(asset:T.Object3D,target:T.Box3) {
  const source=localBounds(asset);
  if(source.isEmpty()||target.isEmpty())return asset;
  const sourceSize=source.getSize(new T.Vector3()),targetSize=target.getSize(new T.Vector3());
  // Keep authored leaf curvature, stone strata and branch cross-sections intact.
  // The editor's conservative envelope remains authoritative for containment;
  // changing a render asset must never silently stretch it independently on XYZ.
  const factor=Math.min(targetSize.x/Math.max(sourceSize.x,1e-6),targetSize.y/Math.max(sourceSize.y,1e-6),targetSize.z/Math.max(sourceSize.z,1e-6))*.985;
  const scale=new T.Vector3(factor,factor,factor);
  const sourceCenter=source.getCenter(new T.Vector3()),targetCenter=target.getCenter(new T.Vector3());
  asset.scale.copy(scale);
  // X/Z are centered in the existing footprint. The base must remain on the
  // substrate: centering Y was visibly lifting rocks and plants above it.
  asset.position.set(
    targetCenter.x-sourceCenter.x*scale.x,
    target.min.y-source.min.y*scale.y,
    targetCenter.z-sourceCenter.z*scale.z,
  );
  asset.updateMatrixWorld(true);
  return asset;
}

function disposeInterior(root:T.Object3D) {
  for(const child of [...root.children]){
    root.remove(child);
    child.traverse(node=>{
      if(!(node instanceof T.Mesh))return;
      node.geometry.dispose();
      for(const material of Array.isArray(node.material)?node.material:[node.material]){
        for(const value of Object.values(material))if(value instanceof T.Texture)value.dispose();
        material.dispose();
      }
    });
  }
}

/** Replaces only procedural interior geometry; the transform/selectable root remains intact. */
export function replaceInteriorWithAsset(root:T.Object3D,asset:T.Group,id:FidelityAssetId) {
  const target=localBounds(root);
  fitAssetToLocalBounds(asset,target);
  disposeInterior(root);
  root.add(asset);
  root.userData.fidelityAsset=id;
  root.userData.fishyAsset=true;
  return root;
}

/** Hydrate a single existing root, retaining its transform, ID and selection surface. */
export async function enhanceObjectWithFidelityAsset(root:T.Object3D,object:SceneObject,signal?:AbortSignal) {
  const id=fidelityAssetFor(object);
  if(!id)return false;
  const source=await sourceAsset(id);
  if(signal?.aborted)return false;
  const asset=cloneFidelityAsset(source.scene),tint=new T.Color(object.color);
  asset.traverse(node=>{
    if(!(node instanceof T.Mesh))return;
    if(object.kind==="plant")node.userData.fishyPlant=true;
    for(const material of Array.isArray(node.material)?node.material:[node.material]){
      // Texture albedo carries the material's intended luminance. A restrained
      // hue shift honors catalog/object color without multiplying it to black.
      if("color" in material)(material as T.MeshStandardMaterial).color.lerp(tint,.2);
    }
  });
  if(object.kind==="plant")asset.userData.fishyPlant=true;
  replaceInteriorWithAsset(root,asset,id);
  return true;
}

const filterCache=new Map<string,Promise<LoadedAsset>>();

/** Replace only the fixed housing; tank-specific hoses and outlets remain live. */
export async function enhanceFilterHousing(root:T.Object3D,catalogId:string,signal?:AbortSignal) {
  const entry=catalogEntryById(catalogId),holder=root.getObjectByName("Equipment body");
  if(entry?.system?.type!=="filter"||!holder||holder.userData.filterBodyAsset!==catalogId)return false;
  if(holder.userData.fidelityFilter===catalogId)return true;
  let pending=filterCache.get(catalogId);
  if(!pending){pending=loader.loadAsync(`/render-assets/filters/${catalogId}.glb`).then(g=>({scene:g.scene}));filterCache.set(catalogId,pending);void pending.catch(()=>{if(filterCache.get(catalogId)===pending)filterCache.delete(catalogId);});}
  const source=await pending;if(signal?.aborted)return false;
  const model=cloneFidelityAsset(source.scene);disposeInterior(holder);holder.add(model);holder.userData.fidelityFilter=catalogId;root.userData.fidelityAsset=catalogId;root.updateMatrixWorld(true);return true;
}

/**
 * Hydrates supported, non-sculpted objects after the procedural stage has built
 * its authoritative roots. Failures deliberately retain the procedural asset.
 */
export async function enhanceAquariumAssets(content:T.Group,record:SceneRecord,meshes:Map<string,T.Object3D>,signal?:AbortSignal):Promise<{loaded:number;fallback:number}> {
  void content;
  const natural=record.objects.map(async object=>{
    const id=fidelityAssetFor(object),root=meshes.get(object.id);
    if(!id||!root)return false;
    try{
      return await enhanceObjectWithFidelityAsset(root,object,signal);
    }catch{
      return false;
    }
  });
  const hardware=(record.equipment??[]).filter(instance=>instance.kind==="filter").map(async instance=>{const root=meshes.get(instance.id);if(!root)return false;try{return await enhanceFilterHousing(root,instance.catalogId,signal);}catch{return false;}});
  const hydrated=await Promise.all([...natural,...hardware]);
  const loaded=hydrated.filter(Boolean).length,fallback=hydrated.length-loaded;
  return {loaded,fallback};
}

/** Dispose cached source GLTF resources after all renderer clones have been released. */
export async function releaseFidelityAssetCache() {
  const pending=[...cache.values(),...filterCache.values()];cache.clear();filterCache.clear();
  for(const entry of await Promise.allSettled(pending))if(entry.status==="fulfilled")disposeInterior(entry.value.scene);
}
