"use client";
import {useEffect,useRef,useState} from "react";
import {RadioGroup,RadioGroupItem} from "@/components/ui/radio-group";
import {Slider} from "@/components/ui/slider";
import {BACKGROUNDS,initialViewSettings,validateRoomFile,validateRoomDimensions,type ViewSettings} from "@/lib/view-settings";

export function useRenderBackground(){
  const [view,setView]=useState(initialViewSettings),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const url=useRef<string|null>(null),generation=useRef(0),alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;generation.current++;if(url.current)URL.revokeObjectURL(url.current);};},[]);
  const remove=()=>{generation.current++;if(url.current)URL.revokeObjectURL(url.current);url.current=null;setView(initialViewSettings());setBusy(false);setError("");};
  const load=async(file:File)=>{const token=++generation.current;setBusy(true);setError("");let bitmap:ImageBitmap|undefined;
    try{validateRoomFile(file);bitmap=await createImageBitmap(file);validateRoomDimensions(bitmap.width,bitmap.height);if(!alive.current||token!==generation.current)return;const next=URL.createObjectURL(file),old=url.current;url.current=next;setView({mode:"room",photo:{url:next,name:file.name},zoom:100,x:50,y:50});if(old)URL.revokeObjectURL(old);}
    catch(e){if(alive.current&&token===generation.current)setError(e instanceof Error?e.message:"This photo could not be opened. Try another image.");}
    finally{bitmap?.close();if(alive.current&&token===generation.current)setBusy(false);}
  };
  return {view,setView,busy,error,load,remove};
}
type BackgroundSession=ReturnType<typeof useRenderBackground>;
function PhotoAdjustment({label,value,min,max,unit,onChange}:{label:string;value:number;min:number;max:number;unit:string;onChange:(n:number)=>void}){
  const host=useRef<HTMLDivElement>(null);
  useEffect(()=>{host.current?.querySelector('[role="slider"]')?.setAttribute("aria-label",label);},[label]);
  return <div className="room-adjustment" ref={host}><div><span>{label}</span><output>{value}{unit}</output></div><Slider className="scene-slider" min={min} max={max} step={1} value={[value]} onValueChange={values=>onChange(values[0])}/></div>;
}
export function RenderBackground({session}:{session:BackgroundSession}){
  const {view,setView}=session;const adjust=(key:"zoom"|"x"|"y",value:number)=>setView(v=>({...v,[key]:value}));
  return <section className="panel-section render-background"><h2>Render background</h2><RadioGroup aria-label="Render background" value={view.mode} onValueChange={mode=>setView(v=>({...v,mode:mode as ViewSettings["mode"]}))} className="background-choices">{BACKGROUNDS.map(option=><label className="shape-choice" data-selected={view.mode===option.id} key={option.id}><RadioGroupItem value={option.id}/><span>{option.name}</span></label>)}</RadioGroup>
    {view.mode==="room"&&<><label className="room-photo-picker">{session.busy?"Opening room photo…":view.photo?"Replace room photo":"Add your room photo"}<input type="file" aria-label="Choose room photo" accept="image/jpeg,image/png,image/webp" disabled={session.busy} onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)void session.load(file);}}/></label>{session.busy&&<p role="status" className="micro">Opening this photo locally…</p>}{session.error&&<p role="alert" className="room-photo-error">{session.error}</p>}{view.photo&&<><p className="micro room-file-name">{view.photo.name}</p><PhotoAdjustment label="Photo zoom" value={view.zoom} min={100} max={200} unit="%" onChange={v=>adjust("zoom",v)}/><PhotoAdjustment label="Photo horizontal position" value={view.x} min={0} max={100} unit="%" onChange={v=>adjust("x",v)}/><PhotoAdjustment label="Photo vertical position" value={view.y} min={0} max={100} unit="%" onChange={v=>adjust("y",v)}/><div className="room-photo-actions"><button onClick={()=>setView(v=>({...v,zoom:100,x:50,y:50}))}>Reset photo framing</button><button onClick={session.remove}>Remove photo</button></div></> }<p className="micro">JPEG, PNG or WebP · 10 MB max. Your photo stays in this session and is not included in Save or scene exports.</p><p className="micro">Visual backdrop only—not measured room fit or matched lighting. Orbit and zoom the tank to line it up with the photo; right-drag to pan.</p></>}
  </section>;
}
