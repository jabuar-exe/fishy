"use client";

import {useEffect,useRef,useState} from "react";
import {ImagePlus,Search,SendHorizontal} from "lucide-react";
import type {SceneRecord} from "@/lib/scene";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";

type ThreadItem={id:string;kind:"user"|"studio";body:string;label?:string;sub?:string;error?:boolean};
type ChatContext="brief"|"photos";
export type AquascapePhoto={url:string;name:string;size:number;file:File};
export type GeneratedAquascape={scene:SceneRecord;summary:string;baseRevision:number;componentCount:number;preservedProtected:number;model:string};

const MAX_AGENT_PHOTOS=4;
const MAX_ENCODED_BLOB=1_800_000;

function blobDataUrl(blob:Blob){return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>typeof reader.result==="string"?resolve(reader.result):reject(new Error("Could not prepare the reference photo."));reader.onerror=()=>reject(new Error("Could not read the reference photo."));reader.readAsDataURL(blob);});}

async function encodePhoto(photo:AquascapePhoto){
  const bitmap=await createImageBitmap(photo.file);let width=bitmap.width,height=bitmap.height;
  const scale=Math.min(1,1400/Math.max(width,height));width=Math.max(1,Math.round(width*scale));height=Math.max(1,Math.round(height*scale));
  const render=async(w:number,h:number,quality:number)=>{const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;const context=canvas.getContext("2d");if(!context)throw new Error("Could not prepare the reference photo.");context.drawImage(bitmap,0,0,w,h);return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Could not prepare the reference photo.")),"image/jpeg",quality));};
  try{
    let blob=await render(width,height,.82);
    if(blob.size>MAX_ENCODED_BLOB){width=Math.max(1,Math.round(width*.72));height=Math.max(1,Math.round(height*.72));blob=await render(width,height,.68);}
    if(blob.size>MAX_ENCODED_BLOB)throw new Error(`${photo.name} is too detailed to send safely. Use a smaller crop.`);
    return {name:photo.name,dataUrl:await blobDataUrl(blob)};
  } finally {bitmap.close();}
}

export function AquascapeChat({brief,scene,photos,onGenerated,onBrowseReferences,onAttachPhoto}:{brief:string;scene:SceneRecord;photos:AquascapePhoto[];onGenerated:(result:GeneratedAquascape)=>boolean;onBrowseReferences:()=>void;onAttachPhoto:(file:File)=>Promise<void>}) {
  const [context,setContext]=useState<ChatContext>("brief"),[draft,setDraft]=useState(""),[thread,setThread]=useState<ThreadItem[]>([]),[waiting,setWaiting]=useState(false);
  const input=useRef<HTMLInputElement>(null),fileInput=useRef<HTMLInputElement>(null),abort=useRef<AbortController|null>(null),threadRef=useRef(thread);threadRef.current=thread;
  useEffect(()=>()=>abort.current?.abort(),[]);
  const send=async()=>{
    const text=draft.trim();if(!text||waiting)return;
    const userItem:ThreadItem={id:crypto.randomUUID(),kind:"user",body:text};
    const history=threadRef.current.slice(-12).map(item=>({role:item.kind==="user"?"user" as const:"assistant" as const,content:item.body.slice(0,1200)}));
    setThread(items=>[...items,userItem]);setDraft("");setWaiting(true);const controller=new AbortController();abort.current=controller;
    try{
      const images=await Promise.all(photos.slice(-MAX_AGENT_PHOTOS).map(encodePhoto));
      const response=await fetch("/api/aquascape/generate",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({message:text,scene,history,images}),signal:controller.signal});
      const result=await response.json().catch(()=>null) as (GeneratedAquascape&{ok?:boolean;error?:string})|null;
      if(!response.ok||!result?.ok)throw new Error(result?.error||"The aquarium agent could not complete this design.");
      if(!onGenerated(result))throw new Error("The scene changed while the aquarium was being generated. Review the current scene and try again.");
      setThread(items=>[...items,{id:crypto.randomUUID(),kind:"studio",label:"Aquarium generated",sub:`${result.componentCount} components`,body:result.summary}]);
    } catch(error) {
      if(controller.signal.aborted)return;
      setThread(items=>[...items,{id:crypto.randomUUID(),kind:"studio",label:"Generation stopped",sub:"No scene changes applied",body:error instanceof Error?error.message:"The aquarium could not be generated.",error:true}]);
    } finally {if(abort.current===controller)abort.current=null;setWaiting(false);queueMicrotask(()=>input.current?.focus());}
  };
  const attach=async(file:File)=>{await onAttachPhoto(file);setContext("photos");input.current?.focus();};
  return <section className="aquascape-chat" aria-label="Aquascape assistant">
    <header className="aquascape-chat-header">
      <div className="aquascape-chat-tabs" role="tablist" aria-label="Chat context">
        <Button variant="ghost" size="xs" role="tab" aria-selected={context==="brief"} onClick={()=>setContext("brief")}>Brief</Button>
        <Button variant="ghost" size="xs" role="tab" aria-selected={context==="photos"} onClick={()=>setContext("photos")}>Photos{photos.length? <Badge variant="outline">{photos.length}</Badge>:null}</Button>
      </div>
      <div className="aquascape-chat-actions">
        <Button type="button" variant="ghost" size="icon-xs" aria-label="Browse inspiration references" title="Browse inspiration references" onClick={onBrowseReferences}><Search size={15}/></Button>
        <Button type="button" variant="ghost" size="icon-xs" aria-label="Attach a reference photo" title="Attach a reference photo" onClick={()=>fileInput.current?.click()}><ImagePlus size={16}/></Button>
        <input ref={fileInput} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>{const file=event.target.files?.[0];event.target.value="";if(file)void attach(file);}}/>
      </div>
    </header>
    <div className="aquascape-chat-thread" aria-live="polite" aria-busy={waiting}>
      {!thread.length?<div className="aquascape-chat-empty"><p>Describe your dream aquascape</p></div>:thread.map(item=>item.kind==="user"?<div className="aquascape-chat-user" key={item.id}>{item.body}</div>:<article className="aquascape-chat-reply" data-error={item.error||undefined} key={item.id}><p><strong>{item.label}</strong><span>{item.sub}</span></p><div>{item.body}</div></article>)}
      {waiting&&<div className="aquascape-chat-thinking"><span/><span/><span/><em>Composing your aquarium…</em></div>}
    </div>
    <div className="aquascape-chat-composer" onClick={()=>input.current?.focus()}>
      <input ref={input} value={draft} maxLength={3000} onChange={event=>setDraft(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();void send();}}} placeholder={context==="brief"?"Describe your aquascape…":"Describe how to use these photos…"} aria-label="Aquascape message"/>
      <Button type="button" size="icon-sm" aria-label="Generate aquarium" onClick={()=>void send()} disabled={!draft.trim()||waiting}><SendHorizontal size={16}/></Button>
    </div>
    <p className="aquascape-chat-note">Generates editable local components · protected objects stay unchanged.</p>
  </section>;
}
