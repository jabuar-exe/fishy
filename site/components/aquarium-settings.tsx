"use client";

import {Field} from "./scene-controls";
import {Switch} from "./ui/switch";
import {resolveVisualProfile, type VisualProfile} from "../lib/render-profile";
import type {SceneRecord} from "../lib/scene";
import {fishVisual} from "../lib/fish-species";

type Props = {scene:SceneRecord; onChange:(visual:VisualProfile,label:string)=>boolean};

/** Authoring settings are saved with the scene; live animation poses never are. */
export function AquariumSettings({scene,onChange}:Props) {
  const visual=resolveVisualProfile(scene.visual);
  const set=(patch:Partial<VisualProfile>,label:string)=>onChange({...visual,...patch},label);
  const school=(patch:Partial<VisualProfile["organisms"]>,label:string)=>set({organisms:{...visual.organisms,...patch}},label);
  const updateAddedSchool=(id:string,patch:Partial<NonNullable<VisualProfile["organisms"]["schools"]>[number]>,label:string)=>school({schools:visual.organisms.schools?.map(item=>item.id===id?{...item,...patch}:item)},label);
  const removeAddedSchool=(id:string,label:string)=>school({schools:visual.organisms.schools?.filter(item=>item.id!==id)},`Removed ${label} school`);
  return <>
    <section className="panel-section aquarium-settings" aria-label="Aquarium appearance">
      <h2>Light, water & motion</h2>
      <label className="select-field">Rendering quality
        <select value={visual.quality} onChange={event=>set({quality:event.target.value as VisualProfile["quality"]},"Updated rendering quality")}>
          <option value="auto">Automatic</option><option value="high">Detailed</option><option value="low">Lightweight</option>
        </select>
      </label>
      <label className="check-label">Animate aquarium<Switch aria-label="Animate aquarium" checked={visual.motion} onCheckedChange={motion=>set({motion},motion?"Aquarium motion enabled":"Aquarium motion paused")}/></label>
      <Field label="Water clarity" value={Math.round(visual.clarity*100)} min={0} max={100} unit="%" onCommit={value=>set({clarity:value/100},"Updated water clarity")}/>
      <Field label="Water level" value={Math.round(visual.waterLevel*100)} min={15} max={100} unit="%" onCommit={value=>set({waterLevel:value/100},"Updated water level")}/>
      <label className="check-label">Rock-bank cascade<Switch aria-label="Rock-bank cascade" checked={visual.cascade} onCheckedChange={cascade=>set({cascade},cascade?"Cascade enabled":"Cascade hidden")}/></label>
      {visual.cascade&&<p className="micro">The cascade follows the highest stone bank above the pool. Lower the water level to reveal it.</p>}
      <Field label="Plant movement" value={Math.round(visual.plantMotion*100)} min={0} max={100} unit="%" onCommit={value=>set({plantMotion:value/100},"Updated plant movement")}/>
      <p className="micro">Automatic quality adapts detail to the display. Reduced motion starts the aquarium still.</p>
    </section>
    <section className="panel-section aquarium-settings" aria-label="Fish school settings">
      <h2>Life in the water</h2>
      {visual.organisms.schools!==undefined? <>
        {visual.organisms.schools.length? <>{visual.organisms.schools.map(item=>{const label=fishVisual(item.species).label;return <div key={item.id} className="settings-fish-school">
          <label className="check-label">{label}<Switch aria-label={`${label} school`} checked={item.enabled} onCheckedChange={enabled=>updateAddedSchool(item.id,{enabled},enabled?`Added ${label} school`:`Hid ${label} school`)}/></label>
          {item.enabled&&<Field label={`${label} count`} value={item.count} min={1} max={12} step={1} onCommit={count=>Number.isInteger(count)&&updateAddedSchool(item.id,{count},`Updated ${label} school size`)}/>}
          <button type="button" className="compact-action" aria-label={`Remove ${label} school`} onClick={()=>removeAddedSchool(item.id,label)}>Remove school</button>
        </div>})}<p className="micro">Each species keeps its own path seed and school size. Add more species from Materials.</p></>:<p className="micro">Add fish from Materials.</p>}
      </>:<>
      <label className="check-label">Neon tetra school<Switch aria-label="Neon tetra school" checked={visual.organisms.enabled} onCheckedChange={enabled=>school({enabled},enabled?"Fish school added":"Fish school hidden")}/></label>
      {visual.organisms.enabled&&<>
        <Field label="Number of fish" value={visual.organisms.count} min={1} max={12} step={1} onCommit={count=>Number.isInteger(count)&&school({count},"Updated school size")}/>
        <Field label="Fish length" value={Math.round(visual.organisms.size*1000)/10} min={.8} max={9} step={.1} unit="cm" onCommit={size=>school({size:size/100},"Updated fish scale")}/>
        <button className="full-width" onClick={()=>school({seed:(visual.organisms.seed+1)>>>0},"Changed swimming paths")}>Vary swimming paths</button>
        <p className="micro">Fish stay in open water. Crowded tanks may show fewer fish. Settings are included when you save.</p>
      </>}
      </>}
    </section>
  </>;
}
