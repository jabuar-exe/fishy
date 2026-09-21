import {test} from "node:test";
import assert from "node:assert/strict";
import {Box3,Vector3} from "three";
import {initialScene} from "../lib/scene.ts";
import {createOrganismSystem,organismEnvelope,organismPaths,organismPose} from "../lib/organism-system.ts";
import {boundsOf,tankBounds} from "../lib/geometry.ts";
import {aquariumWaterHeight} from "../lib/render-profile.ts";
import {createPlantedStudy} from "../lib/planted-study.ts";

const enabled=scene=>({...scene,visual:{...scene.visual,organisms:{...scene.visual.organisms,enabled:true,count:4,seed:917}}});

test("seeded organism paths and phases are deterministic with a head-facing travel direction",()=>{
  const scene=enabled(initialScene()),paths=organismPaths(scene,scene.visual.organisms),again=organismPaths(scene,scene.visual.organisms);
  assert.deepEqual(paths,again);assert(paths.length>0);
  const path=paths[0],before=organismPose(path,1),after=organismPose(path,1.01),forward=new Vector3(Math.sin(before.yaw),0,Math.cos(before.yaw)),travel=new Vector3(after.position[0]-before.position[0],0,after.position[2]-before.position[2]).normalize();
  assert(forward.dot(travel)>.99,"visible fish head must face travel direction");
});

test("whole fish envelopes remain inside wet volume and clear conservative hardscape bounds",()=>{
  const scene=enabled(initialScene()),paths=organismPaths(scene,scene.visual.organisms),tank=tankBounds(scene),hardscape=scene.objects.filter(object=>object.kind!=="plant").map(object=>boundsOf(object).expandByScalar(.006)),system=createOrganismSystem(scene);
  assert(paths.length>0);
  for(const path of paths)for(let phase=0;phase<192;phase++){
    const envelope=organismEnvelope(organismPose(path,phase*.026),path.size);
    assert(envelope.min.y>=scene.substrate,"fish body stays above substrate");
    assert(envelope.max.y<=scene.tank.height-.015+1e-9,"fish body stays below water surface");
    assert(tank.containsBox(envelope),"whole fish remains inside glass");
    for(const obstacle of hardscape)assert(!obstacle.intersectsBox(envelope),"fish clears hardscape envelope between route planner samples");
  }
  for(let phase=0;phase<24;phase++){
    const time=phase*.21;system.update(time);
    system.group.children.forEach((fish,index)=>{
      const rendered=new Box3().setFromObject(fish),envelope=organismEnvelope(organismPose(paths[index],time),paths[index].size);
      assert(envelope.clone().expandByScalar(1e-9).containsBox(rendered),"conservative envelope contains the animated rig");
    });
  }
  system.dispose();
});

test("fish remain completely below the saved shallow-pool surface through every swim cycle",()=>{
  const scene=createPlantedStudy(),waterHeight=aquariumWaterHeight(scene),paths=organismPaths(scene,scene.visual.organisms);
  assert(paths.length>0,"the planted study must retain an honest open-water route");
  for(const path of paths)for(let sample=0;sample<256;sample++){
    const time=sample/256*Math.PI*2/path.speed,envelope=organismEnvelope(organismPose(path,time),path.size);
    assert(envelope.max.y<=waterHeight+1e-9,"the complete fish stays under the persisted pool level");
    assert(envelope.min.y>=scene.substrate-1e-9,"the complete fish stays above the substrate");
  }
});

test("runtime creates articulated fish without mutating the saved scene and reports unavailable water honestly",()=>{
  const scene=enabled(initialScene()),before=structuredClone(scene),system=createOrganismSystem(scene);
  assert(system.diagnostic.visible>0);assert.equal(system.group.children.length,system.diagnostic.visible);system.update(.7);
  for(const fish of system.group.children){assert(fish.userData.tailPivot);assert.equal(fish.userData.fins.length,2);}
  assert.deepEqual(scene,before);system.dispose();
  const crowded=enabled({...initialScene(),tank:{width:.1,depth:.1,height:.1,source:"assumed"},substrate:.05,objects:[],visual:{...initialScene().visual,organisms:{...initialScene().visual.organisms,enabled:true,count:4,size:.09,seed:917}}});
  const absent=createOrganismSystem(crowded);assert.equal(absent.diagnostic.visible,0);assert.equal(absent.diagnostic.reason,"no-open-water");absent.dispose();
});

test("allowed extreme tanks either find finite routes or report no open water without NaN bounds",()=>{
  for(const tank of [
    {width:.1,depth:.1,height:.1,source:"assumed"},
    {width:3,depth:.1,height:.1,source:"assumed"},
    {width:.1,depth:3,height:3,source:"assumed"},
  ]){
    const base=initialScene(),scene=enabled({...base,tank,substrate:Math.min(base.substrate,tank.height*.2)}),paths=organismPaths(scene,scene.visual.organisms);
    for(const path of paths)for(const phase of [0,.4,4.2]){
      const pose=organismPose(path,phase),envelope=organismEnvelope(pose,path.size);
      assert([...pose.position,envelope.min.x,envelope.min.y,envelope.min.z,envelope.max.x,envelope.max.y,envelope.max.z].every(Number.isFinite));
    }
    const system=createOrganismSystem(scene);assert(system.diagnostic.visible<=scene.visual.organisms.count);system.dispose();
  }
});

test("fish body normals face outwards so the visible silhouette is not backface-culled",()=>{
  const scene=initialScene();scene.visual.organisms.enabled=true;
  const system=createOrganismSystem(scene);let checked=0;
  system.group.traverse(node=>{if(node.name!=="Neon tetra spindle body")return;const p=node.geometry.getAttribute("position"),n=node.geometry.getAttribute("normal");for(let i=0;i<p.count;i++){assert(p.getX(i)*n.getX(i)+p.getY(i)*n.getY(i)>0);checked++;}});
  assert(checked>0);system.dispose();
});

test("mixed named species retain distinct headings, deterministic routes, and species envelopes",()=>{
  const scene=enabled(initialScene());scene.visual.organisms.schools=[
    {id:"ember",enabled:true,species:"ember-tetra",count:4,size:.02,seed:41},
    {id:"harlequin",enabled:true,species:"harlequin-rasbora",count:3,size:.038,seed:42},
  ];
  scene.objects=[];
  const paths=organismPaths(scene,scene.visual.organisms),system=createOrganismSystem(scene);
  assert.deepEqual(paths.map(path=>path.schoolId).filter((value,index,all)=>all.indexOf(value)===index),["ember","harlequin"]);
  assert.equal(system.group.children.filter(child=>child.name.includes("Ember Tetra")).length,4);
  assert.equal(system.group.children.filter(child=>child.name.includes("Harlequin Rasbora")).length,3);
  for(const path of paths)for(let sample=0;sample<96;sample++){
    const envelope=organismEnvelope(organismPose(path,sample*.04),path.size,path.species);
    assert(tankBounds(scene).containsBox(envelope));
    assert(envelope.min.y>=scene.substrate);
    assert(envelope.max.y<=aquariumWaterHeight(scene));
  }
  system.dispose();
});
