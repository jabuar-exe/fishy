"use client";

import {useEffect,useRef,useState} from "react";
import {Check,ChevronRight,ImageIcon,ImagePlus,Search,SendHorizontal,Square} from "lucide-react";
import type {SceneRecord} from "@/lib/scene";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";

type ThreadItem={id:string;kind:"user"|"studio";body:string;label?:string;sub?:string;error?:boolean};
type ChatContext="brief"|"photos";
export type AquascapePhoto={id:string;url:string;name:string;size:number;file:File};
export type AquascapeInspiration={id:string;title:string;creator?:string;designLesson?:string;plantNames:string[];imageUrl?:string};
export type InfluenceReceipt={kind:"inspiration"|"photo";id:string;reason:string};
export type GeneratedAquascape={scene:SceneRecord;summary:string;baseRevision:number;componentCount:number;preservedProtected:number;model:string;attempts:number;fallback:false;influencesUsed:InfluenceReceipt[]};

const MAX_AGENT_PHOTOS=4;
// Four JPEG blobs at this limit remain below both the route's 9 MB body cap and
// its 8.5 MB data-URL validation cap after base64 expansion.
const MAX_ENCODED_BLOB=1_500_000;
const DREAM_PROMPT="Describe your dream aquascape";

function blobDataUrl(blob:Blob){return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>typeof reader.result==="string"?resolve(reader.result):reject(new Error("Could not prepare the reference photo."));reader.onerror=()=>reject(new Error("Could not read the reference photo."));reader.readAsDataURL(blob);});}

async function encodePhoto(photo:AquascapePhoto){
  const bitmap=await createImageBitmap(photo.file);let width=bitmap.width,height=bitmap.height;
  const scale=Math.min(1,1400/Math.max(width,height));width=Math.max(1,Math.round(width*scale));height=Math.max(1,Math.round(height*scale));
  const render=async(w:number,h:number,quality:number)=>{const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;const context=canvas.getContext("2d");if(!context)throw new Error("Could not prepare the reference photo.");context.drawImage(bitmap,0,0,w,h);return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Could not prepare the reference photo.")),"image/jpeg",quality));};
  try{
    let blob=await render(width,height,.82);
    if(blob.size>MAX_ENCODED_BLOB){width=Math.max(1,Math.round(width*.72));height=Math.max(1,Math.round(height*.72));blob=await render(width,height,.68);}
    if(blob.size>MAX_ENCODED_BLOB)throw new Error(`${photo.name} is too detailed to send safely. Use a smaller crop.`);
    return {id:photo.id,name:photo.name,dataUrl:await blobDataUrl(blob)};
  } finally {bitmap.close();}
}

const TRACE_STAGES=["Reading your brief and current tank","Selecting catalog components","Composing the layout","Fitting every component to the tank"];

function ThinkingTrace({active,elapsed}:{active:boolean;elapsed:number|null}) {
  // Reduced motion skips the staged reveal and shows every phase at once.
  const [stage,setStage]=useState(()=>window.matchMedia("(prefers-reduced-motion: reduce)").matches?TRACE_STAGES.length:1),[open,setOpen]=useState(true);
  useEffect(()=>{
    if(!active||stage>=TRACE_STAGES.length)return;
    const timer=window.setTimeout(()=>setStage(value=>value+1),1100);
    return()=>window.clearTimeout(timer);
  },[active,stage]);
  const settled=elapsed!==null;
  return <div className="aquascape-chat-trace" data-settled={settled||undefined}>
    <button type="button" className="aquascape-chat-trace-head" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>
      <ChevronRight className="aquascape-chat-trace-chevron" size={13}/>
      <span className="aquascape-chat-trace-label">{elapsed!==null?`Composed in ${elapsed.toFixed(1)}s`:"Composing your aquarium…"}</span>
    </button>
    {open&&<ol className="aquascape-chat-trace-steps">{TRACE_STAGES.slice(0,settled?TRACE_STAGES.length:stage).map((label,index)=>{
      const done=settled||index<stage-1;
      return <li key={label} data-done={done||undefined}><span className="aquascape-chat-trace-mark">{done&&<Check size={9}/>}</span>{label}</li>;
    })}</ol>}
  </div>;
}

export function AquascapeChat({scene,photos,inspirations,onGenerated,onBrowseReferences,onAttachPhoto}:{scene:SceneRecord;photos:AquascapePhoto[];inspirations:AquascapeInspiration[];onGenerated:(result:GeneratedAquascape)=>boolean;onBrowseReferences:()=>void;onAttachPhoto:(file:File)=>Promise<void>}) {
  const [context,setContext]=useState<ChatContext>("brief"),[draft,setDraft]=useState(""),[thread,setThread]=useState<ThreadItem[]>([]),[waiting,setWaiting]=useState(false);
  const [promptLength,setPromptLength]=useState(DREAM_PROMPT.length),[deletingPrompt,setDeletingPrompt]=useState(false);
  const [trace,setTrace]=useState<{id:string;elapsed:number|null}|null>(null);
  const input=useRef<HTMLInputElement>(null),fileInput=useRef<HTMLInputElement>(null),abort=useRef<AbortController|null>(null),threadRef=useRef(thread);threadRef.current=thread;
  const sending=useRef(false);
  useEffect(()=>()=>abort.current?.abort(),[]);
  useEffect(()=>{
    if(thread.length||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    const isComplete=promptLength===DREAM_PROMPT.length,isEmpty=promptLength===0;
    const delay=isComplete&&!deletingPrompt?2800:isEmpty&&deletingPrompt?1400:deletingPrompt?150:190;
    const timeout=window.setTimeout(()=>{
      if(isComplete&&!deletingPrompt)setDeletingPrompt(true);
      else if(isEmpty&&deletingPrompt)setDeletingPrompt(false);
      else setPromptLength(length=>length+(deletingPrompt?-1:1));
    },delay);
    return()=>window.clearTimeout(timeout);
  },[deletingPrompt,promptLength,thread.length]);
  const send=async()=>{
    const text=draft.trim();if(!text||sending.current)return;
    sending.current=true;
    const userItem:ThreadItem={id:crypto.randomUUID(),kind:"user",body:text};
    const history=threadRef.current.slice(-12).map(item=>({role:item.kind==="user"?"user" as const:"assistant" as const,content:item.body.slice(0,1200)}));
    setThread(items=>[...items,userItem]);setDraft("");setWaiting(true);const controller=new AbortController();abort.current=controller;
    const started=performance.now();setTrace({id:crypto.randomUUID(),elapsed:null});
    try{
      const images=await Promise.all(photos.map(encodePhoto));
      const response=await fetch("/api/aquascape/generate",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({requestId:crypto.randomUUID(),message:text,scene,history,images,inspirations}),signal:controller.signal});
      const result=await response.json().catch(()=>null) as (GeneratedAquascape&{ok?:boolean;error?:string})|null;
      if(!response.ok||!result?.ok)throw new Error(result?.error||"The aquarium agent could not complete this design.");
      if(!onGenerated(result))throw new Error("The scene changed while the aquarium was being generated. Review the current scene and try again.");
      const referenceCount=result.influencesUsed.filter(item=>item.kind==="inspiration").length,photoCount=result.influencesUsed.filter(item=>item.kind==="photo").length;
      const receipt=[referenceCount?`${referenceCount} saved idea${referenceCount===1?"":"s"}`:"",photoCount?`${photoCount} photo${photoCount===1?"":"s"}`:""].filter(Boolean).join(" · ");
      const usedNames=result.influencesUsed.map(item=>item.kind==="inspiration"?inspirations.find(source=>source.id===item.id)?.title:photos.find(photo=>photo.id===item.id)?.name).filter((value):value is string=>!!value);
      const attribution=usedNames.length?`\n\nInfluences used: ${usedNames.join(" · ")}.`:"";
      setThread(items=>[...items,{id:crypto.randomUUID(),kind:"studio",label:`Aquarium generated${result.attempts>1?` after ${result.attempts} attempts`:""}`,sub:`${result.componentCount} components${receipt?` · influenced by ${receipt}`:""}`,body:result.summary+attribution}]);
    } catch(error) {
      if(controller.signal.aborted){
        setThread(items=>[...items,{id:crypto.randomUUID(),kind:"studio",label:"Generation cancelled",sub:"No scene changes applied",body:"Your current aquarium was kept unchanged.",error:true}]);
        return;
      }
      setThread(items=>[...items,{id:crypto.randomUUID(),kind:"studio",label:"Generation stopped",sub:"No scene changes applied",body:error instanceof Error?error.message:"The aquarium could not be generated.",error:true}]);
    } finally {if(abort.current===controller)abort.current=null;sending.current=false;setWaiting(false);setTrace(value=>controller.signal.aborted?null:value&&value.elapsed===null?{...value,elapsed:(performance.now()-started)/1000}:value);queueMicrotask(()=>input.current?.focus());}
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
    {(inspirations.length||photos.length)&&<p className="aquascape-chat-context" role="status">{inspirations.length?`${inspirations.length} saved idea${inspirations.length===1?"":"s"} included`:""}{inspirations.length&&photos.length?" · ":""}{photos.length?<span className="aquascape-chat-photo-hint" aria-label={`${Math.min(photos.length,MAX_AGENT_PHOTOS)} reference photo${Math.min(photos.length,MAX_AGENT_PHOTOS)===1?"":"s"} attached`} title={`${Math.min(photos.length,MAX_AGENT_PHOTOS)} reference photo${Math.min(photos.length,MAX_AGENT_PHOTOS)===1?"":"s"} attached`}><ImageIcon aria-hidden="true" size={15}/><span aria-hidden="true">{Math.min(photos.length,MAX_AGENT_PHOTOS)}</span></span>:null}</p>}
    <div className="aquascape-chat-thread" aria-live="polite" aria-busy={waiting}>
      {!thread.length?<div className="aquascape-chat-empty"><p className="aquascape-chat-empty-prompt" aria-label={DREAM_PROMPT}>{DREAM_PROMPT.slice(0,promptLength)}</p></div>:thread.map(item=>item.kind==="user"?<div className="aquascape-chat-user" key={item.id}>{item.body}</div>:<article className="aquascape-chat-reply" data-error={item.error||undefined} key={item.id}><p><strong>{item.label}</strong><span>{item.sub}</span></p><div>{item.body}</div></article>)}
      {trace&&<ThinkingTrace key={trace.id} active={waiting} elapsed={trace.elapsed}/>}
    </div>
    <div className="aquascape-chat-composer" onClick={()=>input.current?.focus()}>
      <input ref={input} value={draft} maxLength={3000} onChange={event=>setDraft(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();void send();}}} placeholder={context==="brief"?"Describe your aquascape…":"Describe how to use these photos…"} aria-label="Aquascape message"/>
      <Button type="button" size="icon-sm" className={waiting?"aquascape-chat-stop":undefined} aria-label={waiting?"Stop generation":"Generate aquarium"} title={waiting?"Stop generation":"Generate aquarium"} onClick={()=>waiting?abort.current?.abort():void send()} disabled={!waiting&&!draft.trim()}>{waiting?<Square size={14} fill="currentColor" aria-hidden="true"/>:<SendHorizontal size={16}/>}</Button>
    </div>
  </section>;
}
