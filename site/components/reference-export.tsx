"use client";
import {useEffect,useRef,useState} from "react";
import {Dialog,DialogContent,DialogTitle} from "@/components/ui/dialog";
import {renderReferencePacket} from "@/lib/reference-packet";
import type {SceneRecord} from "@/lib/scene";

export function ReferenceExport({scene,water,onClose}:{scene:SceneRecord;water:boolean;onClose:()=>void}) {
  const [progress,setProgress]=useState(0),[error,setError]=useState(""),[result,setResult]=useState<{zip:string;images:{name:string;url:string}[]}|null>(null);
  const opener=useRef(typeof document!=="undefined"?document.activeElement as HTMLElement|null:null);
  useEffect(()=>{const controller=new AbortController(),urls:string[]=[];queueMicrotask(()=>{if(controller.signal.aborted)return;setResult(null);setError("");setProgress(0);void renderReferencePacket(scene,water,controller.signal,setProgress).then(packet=>{if(controller.signal.aborted)return;const zip=URL.createObjectURL(packet.zip),images=packet.images.map(image=>({name:image.name,url:URL.createObjectURL(image.blob)}));urls.push(zip,...images.map(i=>i.url));setResult({zip,images});}).catch(e=>{if(!controller.signal.aborted)setError((e as Error).message||"The reference packet could not render.");});});return()=>{controller.abort();urls.forEach(url=>URL.revokeObjectURL(url));};},[scene,water]);
  return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="reference-export-dialog" onCloseAutoFocus={e=>{e.preventDefault();if(opener.current?.isConnected&&opener.current.getClientRects().length)opener.current.focus();else document.querySelector<HTMLElement>('[aria-label="Project menu"]')?.focus();}}><DialogTitle className="sr-only">Reference views</DialogTitle>{error?<p role="alert">{error}</p>:!result?<p role="status">Rendering view {Math.min(progress+1,5)} of 5…</p>:<><div className="reference-export-grid">{result.images.map(image=><figure key={image.name}><img src={image.url} alt={`${image.name} view, revision ${scene.revision}`}/><figcaption>{image.name}</figcaption></figure>)}</div><a className="primary packet-download" href={result.zip} download={`fishy-revision-${scene.revision}-five-views.zip`}>Download five-view packet</a></>}<button onClick={onClose}>{result||error?"Close":"Cancel rendering"}</button></DialogContent></Dialog>;
}
