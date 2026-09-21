"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Full document navigation avoids the current Vinext production client-router failure and releases the isolated lab renderer. */
import {useState} from "react";
import {FishyViewport} from "@/components/fishy-viewport";
import {ReferenceExport} from "@/components/reference-export";
import {catalogEntries} from "@/lib/catalog";
import {createEquipment} from "@/lib/equipment";
import {initialScene} from "@/lib/scene";
import {createPlantedStudy,createFidelityStressStudy} from "@/lib/planted-study";

/** Isolated verification fixtures; never reads or writes the user's saved project. */
const filterEntries=catalogEntries.filter(entry=>entry.kind==="filter");
function filterStudy(id:string) {
 const entry=filterEntries.find(e=>e.id===id)??filterEntries[0],base=initialScene();
 const tank=entry.id==="filter-fluval-407"?{width:1,depth:.4,height:.45,source:"user-entered" as const}:{width:.75,depth:.4,height:.4,source:"user-entered" as const};
 return {...base,name:"Filter and current study",tank,equipment:[createEquipment(entry,"lab-filter")],visual:{...base.visual,motion:true,organisms:{...base.visual.organisms,enabled:true,count:6}}};
}
export default function FidelityLab() {
  const [scene,setScene]=useState(createPlantedStudy),[water,setWater]=useState(true),[exporting,setExporting]=useState(false),[error,setError]=useState(""),[reduceMotion,setReduceMotion]=useState(false);
  return <main className="fidelity-lab">
    <header><a href="/">Fishy editor</a><h1>Fidelity lab</h1><span>{scene.objects.length} editable objects</span></header>
    <nav aria-label="Verification fixtures">
      <button onClick={()=>setScene(initialScene())}>Starter</button><button onClick={()=>setScene(createPlantedStudy())}>Planted study</button><button onClick={()=>setScene(createFidelityStressStudy())}>32-object stress</button>
      <label>Filter <select aria-label="Filter model" value={scene.equipment.find(e=>e.kind==="filter")?.catalogId??""} onChange={e=>setScene(filterStudy(e.target.value))}><option value="" disabled>Choose filter…</option>{filterEntries.map(entry=><option key={entry.id} value={entry.id}>{entry.displayLabel}</option>)}</select></label>
      {scene.equipment.some(e=>e.kind==="filter")&&<label><input type="checkbox" checked={scene.equipment.find(e=>e.kind==="filter")?.enabled??false} onChange={e=>setScene({...scene,equipment:scene.equipment.map(item=>item.kind==="filter"?{...item,enabled:e.target.checked}:item)})}/>Filter running</label>}
      <label>Quality <select aria-label="Lab rendering quality" value={scene.visual.quality} onChange={e=>setScene({...scene,visual:{...scene.visual,quality:e.target.value as "auto"|"high"|"low"}})}><option value="auto">Automatic</option><option value="high">Detailed</option><option value="low">Lightweight</option></select></label>
      <label><input type="checkbox" checked={reduceMotion} onChange={e=>setReduceMotion(e.target.checked)}/>Simulate reduced motion</label><label><input type="checkbox" checked={water} onChange={e=>setWater(e.target.checked)}/>Water</label><button onClick={()=>setExporting(true)}>Export fixture views</button>
    </nav>
    <div className="lab-stage"><FishyViewport motionPreference={reduceMotion?"reduced":"system"} diagnosticsLab active={!exporting} scene={scene} selected={null} mode="translate" water={water} cancel={0} frame={0} onSelect={()=>{}} onTransform={()=>{}} onError={setError} onMotionChange={motion=>setScene({...scene,visual:{...scene.visual,motion}})}/></div>
    {error&&<p role="alert">{error}</p>}{exporting&&<ReferenceExport scene={scene} water={water} onClose={()=>setExporting(false)}/>}
  </main>;
}
