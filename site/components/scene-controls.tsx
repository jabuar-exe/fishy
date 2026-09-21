"use client";
import {createContext,useContext,useEffect,useLayoutEffect,useId,useRef,useState} from "react";
import {Slider} from "@/components/ui/slider";
export const DraftContext=createContext<(id:string,pending:boolean)=>void>(()=>{});

export function Field({label,value,onCommit,step=1,min=-999,max=999,unit}:{label:string;value:number;onCommit:(n:number)=>boolean|void;step?:number;min?:number;max?:number;unit?:string}) {
  const [draft,setDraft]=useState(String(value)),[error,setError]=useState("");
  const input=useRef<HTMLInputElement>(null),skipBlur=useRef(false),id=useId();
  const markDraft=useContext(DraftContext);
  useEffect(()=>()=>markDraft(id,false),[id,markDraft]);
  useEffect(()=>{let active=true;queueMicrotask(()=>{if(!active)return;setDraft(String(value));setError("");markDraft(id,false);if(input.current)input.current.dataset.invalid="false";});return()=>{active=false;};},[value,id,markDraft]);
  const fail=(message:string)=>{setError(message);if(input.current){input.current.dataset.invalid="true";input.current.focus();}};
  const commit=()=>{if(skipBlur.current){skipBlur.current=false;return;}const n=Number(draft);if(!draft.trim()||!Number.isFinite(n)||n<min||n>max){fail(`Enter ${min}–${max}${unit?" "+unit:""}.`);return;}if(n!==value&&onCommit(n)===false){fail("This value does not fit. Adjust it or press Escape.");return;}setDraft(String(n));setError("");markDraft(id,false);if(input.current)input.current.dataset.invalid="false";};
  return <label className="number-field"><span>{label}</span><span className="number-input"><input ref={input} data-scene-draft="true" aria-label={label} aria-invalid={!!error} aria-describedby={error?id:undefined} type="number" min={min} max={max} step={step} value={draft} onChange={e=>{setDraft(e.target.value);setError("");markDraft(id,e.target.value!==String(value));e.target.dataset.invalid="false";}} onInvalid={()=>fail(`Enter ${min}–${max}${unit?" "+unit:""}.`)} onBlur={commit} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();if(e.key==="Escape"){e.preventDefault();e.stopPropagation();skipBlur.current=true;markDraft(id,false);setDraft(String(value));setError("");e.currentTarget.dataset.invalid="false";e.currentTarget.blur();}}}/>{unit&&<span className="field-unit">{unit}</span>}</span>{error&&<span className="field-error" id={id} role="alert">{error}</span>}</label>;
}

export type ControlGesture={cancel:()=>void};
export function Adjustment({title,label,value,min,max,unit,revision,onCommit,onGesture,step=.1}:{title:string;label:string;value:number;min:number;max:number;unit:string;revision:number;onCommit:(value:number,base:number)=>boolean;onGesture:(gesture:ControlGesture|null)=>void;step?:number}) {
  const [draft,setDraft]=useState(value),host=useRef<HTMLDivElement>(null),id=useId();
  const latest=useRef({value,revision,onCommit,onGesture});useLayoutEffect(()=>{latest.current={value,revision,onCommit,onGesture};},[value,revision,onCommit,onGesture]);
  const gesture=useRef<{start:number;base:number;keyboard:boolean}|null>(null),draftRef=useRef(value),cancelled=useRef(false);
  useEffect(()=>{if(!gesture.current){setDraft(value);draftRef.current=value;}},[value]);
  // The installed primitive owns its thumb; name that actual slider, not only its wrapper.
  useEffect(()=>{host.current?.querySelector('[role="slider"]')?.setAttribute("aria-label",`${label} slider`);},[label]);
  const cancel=()=>{cancelled.current=true;gesture.current=null;draftRef.current=latest.current.value;setDraft(latest.current.value);latest.current.onGesture(null);};
  const begin=(keyboard:boolean)=>{if(gesture.current)return;cancelled.current=false;gesture.current={start:latest.current.value,base:latest.current.revision,keyboard};latest.current.onGesture({cancel});};
  const finish=(n:number)=>{const g=gesture.current;if(!g||cancelled.current)return;gesture.current=null;latest.current.onGesture(null);if(n!==g.start&&!latest.current.onCommit(n,g.base)){setDraft(latest.current.value);draftRef.current=latest.current.value;}};
  useEffect(()=>()=>{if(gesture.current)latest.current.onGesture(null);},[]);
  const adjustmentKeys=["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End","PageUp","PageDown"];
  return <div className="adjustment" ref={host}><div className="adjustment-heading"><h2 id={id}>{title}</h2><Field label={label} value={draft} min={min} max={max} step={step} unit={unit} onCommit={n=>{const accepted=latest.current.onCommit(n,latest.current.revision);if(accepted){draftRef.current=n;setDraft(n);}return accepted;}}/></div><Slider aria-labelledby={id} className="scene-slider" min={min} max={max} step={step} value={[draft]} onPointerDownCapture={()=>begin(false)} onPointerCancel={cancel} onPointerUp={()=>{if(!gesture.current?.keyboard)finish(draftRef.current);}} onValueChange={values=>{if(cancelled.current)return;draftRef.current=values[0];setDraft(values[0]);}} onValueCommit={values=>{if(!gesture.current?.keyboard)finish(values[0]);}} onKeyDownCapture={e=>{if(e.key==="Escape"){e.preventDefault();e.stopPropagation();cancel();}else if(adjustmentKeys.includes(e.key))begin(true);}} onKeyUpCapture={e=>{if(adjustmentKeys.includes(e.key))finish(draftRef.current);}} onBlur={()=>{if(gesture.current?.keyboard)finish(draftRef.current);}}/><div className="range-labels"><span>{min}{unit}</span><span>{max}{unit}</span></div></div>;
}
