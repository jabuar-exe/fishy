import {useEffect,useState} from "react";
import * as T from "three";
import {catalogDescriptor,isOrganicCatalogEntry,type CatalogEntry} from "./catalog";
import {buildSystemPreview} from "./equipment-models";
import {makeObject} from "./geometry";
import {enhanceObjectWithFidelityAsset} from "./render-assets";

const thumbnails=new Map<string,string>();
let thumbnailJob:Promise<void>|null=null;
const thumbnailSubscribers=new Set<()=>void>();
const thumbnailKey=(entry:CatalogEntry)=>`${entry.id}:${entry.rendererForm}:${entry.color??""}`;
const staticThumbnail=(entry:CatalogEntry)=>entry.kind==="fish"&&entry.fish?`/render-assets/fish-thumbnails/${entry.fish.model}.png`:entry.kind==="filter"?`/render-assets/filter-thumbnails/${entry.id}.png`:undefined;

function disposeThumbnailObject(object:T.Object3D) {
  const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();
  object.traverse(node=>{
    if(!(node instanceof T.Mesh||node instanceof T.Line||node instanceof T.Points))return;
    if(node.geometry)geometries.add(node.geometry);
    for(const material of Array.isArray(node.material)?node.material:[node.material])materials.add(material);
  });
  for(const material of materials)for(const value of Object.values(material))if(value instanceof T.Texture)textures.add(value);
  geometries.forEach(geometry=>geometry.dispose());textures.forEach(texture=>texture.dispose());materials.forEach(material=>material.dispose());
}

export function studio() {
  const scene=new T.Scene();scene.background=new T.Color("#e9eeea");
  scene.add(new T.HemisphereLight("#ffffff","#6f796a",2.6));
  const light=new T.DirectionalLight("#fff5dc",3.1);light.position.set(1,2,2);scene.add(light);
  const fill=new T.DirectionalLight("#e3f2ff",1.4);fill.position.set(-2,1,-1);scene.add(fill);
  return scene;
}
export function prepare(scene:T.Scene,entry:CatalogEntry,camera:T.PerspectiveCamera) {
  const object=isOrganicCatalogEntry(entry)?makeObject(catalogDescriptor(entry,"sample")):buildSystemPreview(entry);scene.add(object);
  const box=new T.Box3().setFromObject(object),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());
  const distance=Math.max(size.y,size.x/camera.aspect,size.z)*1.8;
  camera.position.copy(center).add(new T.Vector3(.65,.38,1).normalize().multiplyScalar(distance));camera.lookAt(center);camera.updateProjectionMatrix();
  return {object,center,distance};
}

/** One sequential thumbnail renderer, disposed after the bounded catalog batch. */
export function useMaterialThumbnails(entries:CatalogEntry[],enabled:boolean) {
  const [images,setImages]=useState<Record<string,string>>({}),[failed,setFailed]=useState(false);
  useEffect(()=>{
    if(!enabled)return;let alive=true;
    const imageFor=(entry:CatalogEntry)=>staticThumbnail(entry)??thumbnails.get(thumbnailKey(entry));
    const available=()=>Object.fromEntries(entries.filter(e=>e.status==="supported_procedural"&&imageFor(e)).map(e=>[e.id,imageFor(e)!]));
    const refresh=()=>{if(alive)setImages(available());};thumbnailSubscribers.add(refresh);
    queueMicrotask(refresh);
    if(!thumbnailJob)thumbnailJob=(async()=>{
      let renderer:T.WebGLRenderer|undefined;
      try{
        const missing=entries.filter(entry=>entry.status==="supported_procedural"&&!staticThumbnail(entry)&&!thumbnails.has(thumbnailKey(entry)));if(!missing.length)return;
        renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(240,180,false);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
        const scene=studio(),camera=new T.PerspectiveCamera(36,240/180,.001,10);
        for(const entry of missing){await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));let object:T.Object3D|undefined;try{object=prepare(scene,entry,camera).object;if(isOrganicCatalogEntry(entry))try{await enhanceObjectWithFidelityAsset(object,catalogDescriptor(entry,"sample"));}catch{/* Keep the procedural preview when an optional GLB is unavailable. */}renderer.render(scene,camera);thumbnails.set(thumbnailKey(entry),renderer.domElement.toDataURL("image/png"));thumbnailSubscribers.forEach(listener=>listener());}catch{/* A malformed optional preview must not stop other catalog cards from rendering. */}finally{if(object){scene.remove(object);disposeThumbnailObject(object);}}}
      }finally{renderer?.dispose();renderer?.forceContextLoss();}
    })().finally(()=>{thumbnailJob=null;});
    thumbnailJob.then(()=>{if(alive){setImages(available());setFailed(false);}}).catch(()=>{if(alive)setFailed(true);});
    return()=>{alive=false;thumbnailSubscribers.delete(refresh);};
  },[enabled,entries]);
  return {images,failed};
}
