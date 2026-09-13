"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import * as T from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls.js";
import type {CatalogEntry} from "@/lib/catalog";
import {disposeObject} from "@/lib/geometry";
import {prepare,studio} from "@/lib/material-thumbnails";

export function MaterialPreview({entry}:{entry:CatalogEntry}) {
  const host=useRef<HTMLDivElement>(null),[error,setError]=useState(""),[retry,setRetry]=useState(0),reset=useRef<(()=>void)|null>(null);
  const deferError=useCallback((value:string)=>queueMicrotask(()=>setError(value)),[]);
  useEffect(()=>{
    const container=host.current;if(!container)return;let renderer:T.WebGLRenderer|undefined,controls:OrbitControls|undefined,observer:ResizeObserver|undefined,object:T.Group|undefined,animation=0;
    deferError("");
    try{
      renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
      renderer.domElement.setAttribute("role","img");renderer.domElement.setAttribute("aria-label",`3D preview of ${entry.displayLabel}`);container.appendChild(renderer.domElement);
      const scene=studio(),camera=new T.PerspectiveCamera(36,1,.001,10),sample=prepare(scene,entry,camera);object=sample.object;
      controls=new OrbitControls(camera,renderer.domElement);controls.target.copy(sample.center);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=sample.distance*.55;controls.maxDistance=sample.distance*2.8;controls.update();controls.saveState();reset.current=()=>controls?.reset();
      const resize=()=>{if(!renderer)return;const w=container.clientWidth,h=container.clientHeight;if(w&&h){camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);}};observer=new ResizeObserver(resize);observer.observe(container);resize();
      const render=()=>{controls?.update();renderer?.render(scene,camera);animation=requestAnimationFrame(render);};render();
    }catch{deferError("3D preview unavailable. Check browser hardware acceleration.");}
    return()=>{reset.current=null;cancelAnimationFrame(animation);observer?.disconnect();controls?.dispose();if(object)disposeObject(object);renderer?.dispose();renderer?.forceContextLoss();container.replaceChildren();};
  },[entry,retry,deferError]);
  return <figure className="material-live-preview"><div ref={host}/>{error&&<p role="status">{error} <button onClick={()=>setRetry(n=>n+1)}>Retry preview</button></p>}<figcaption><span>Drag to orbit · same procedural counterpart as the aquarium</span>{!error&&<button onClick={()=>reset.current?.()}>Reset view</button>}</figcaption></figure>;
}
