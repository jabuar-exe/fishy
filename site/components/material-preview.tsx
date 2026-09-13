"use client";
import {useEffect,useRef,useState} from "react";
import * as T from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls.js";
import {catalogDescriptor,type CatalogEntry} from "@/lib/catalog";
import {makeObject,disposeObject} from "@/lib/geometry";

const thumbnails=new Map<string,string>();
let thumbnailJob:Promise<void>|null=null;
const thumbnailKey=(entry:CatalogEntry)=>JSON.stringify(catalogDescriptor(entry,"sample"));

function studio() {
  const scene=new T.Scene();scene.background=new T.Color("#e9eeea");
  scene.add(new T.HemisphereLight("#ffffff","#6f796a",2.6));
  const light=new T.DirectionalLight("#fff5dc",3.1);light.position.set(1,2,2);scene.add(light);
  const fill=new T.DirectionalLight("#e3f2ff",1.4);fill.position.set(-2,1,-1);scene.add(fill);
  return scene;
}
function prepare(scene:T.Scene,entry:CatalogEntry,camera:T.PerspectiveCamera) {
  const object=makeObject(catalogDescriptor(entry,"sample"));scene.add(object);
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
    const available=()=>Object.fromEntries(entries.filter(e=>e.status==="supported_procedural"&&thumbnails.has(thumbnailKey(e))).map(e=>[e.id,thumbnails.get(thumbnailKey(e))!]));
    setImages(available());
    if(!thumbnailJob)thumbnailJob=(async()=>{
      let renderer:T.WebGLRenderer|undefined;
      try{
        const missing=entries.filter(e=>e.status==="supported_procedural"&&!thumbnails.has(thumbnailKey(e)));if(!missing.length)return;
        renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(240,180,false);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
        const scene=studio(),camera=new T.PerspectiveCamera(36,240/180,.001,10);
        for(const entry of missing){await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));const {object}=prepare(scene,entry,camera);try{renderer.render(scene,camera);thumbnails.set(thumbnailKey(entry),renderer.domElement.toDataURL("image/png"));}finally{scene.remove(object);disposeObject(object);}}
      }finally{renderer?.dispose();renderer?.forceContextLoss();}
    })().finally(()=>{thumbnailJob=null;});
    thumbnailJob.then(()=>{if(alive){setImages(available());setFailed(false);}}).catch(()=>{if(alive)setFailed(true);});
    return()=>{alive=false;};
  },[enabled,entries]);
  return {images,failed};
}

export function MaterialPreview({entry}:{entry:CatalogEntry}) {
  const host=useRef<HTMLDivElement>(null),[error,setError]=useState(""),[retry,setRetry]=useState(0),reset=useRef<(()=>void)|null>(null);
  useEffect(()=>{
    const container=host.current;if(!container)return;let renderer:T.WebGLRenderer|undefined,controls:OrbitControls|undefined,observer:ResizeObserver|undefined,object:T.Group|undefined,animation=0;
    setError("");
    try{
      renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
      renderer.domElement.setAttribute("role","img");renderer.domElement.setAttribute("aria-label",`3D preview of ${entry.displayLabel}`);container.appendChild(renderer.domElement);
      const scene=studio(),camera=new T.PerspectiveCamera(36,1,.001,10),sample=prepare(scene,entry,camera);object=sample.object;
      controls=new OrbitControls(camera,renderer.domElement);controls.target.copy(sample.center);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=sample.distance*.55;controls.maxDistance=sample.distance*2.8;controls.update();controls.saveState();reset.current=()=>controls?.reset();
      const resize=()=>{if(!renderer)return;const w=container.clientWidth,h=container.clientHeight;if(w&&h){camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);}};observer=new ResizeObserver(resize);observer.observe(container);resize();
      const render=()=>{controls?.update();renderer?.render(scene,camera);animation=requestAnimationFrame(render);};render();
    }catch{setError("3D preview unavailable. Check browser hardware acceleration.");}
    return()=>{reset.current=null;cancelAnimationFrame(animation);observer?.disconnect();controls?.dispose();if(object)disposeObject(object);renderer?.dispose();renderer?.forceContextLoss();container.replaceChildren();};
  },[entry,retry]);
  return <figure className="material-live-preview"><div ref={host}/>{error&&<p role="status">{error} <button onClick={()=>setRetry(n=>n+1)}>Retry preview</button></p>}<figcaption><span>Drag to orbit · same procedural form as Add</span>{!error&&<button onClick={()=>reset.current?.()}>Reset view</button>}</figcaption></figure>;
}
