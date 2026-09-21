import {test} from 'node:test';
import assert from 'node:assert/strict';
import {waterFlowForSurface,WaterFlow} from '../lib/water-flow.ts';

const total=values=>values.reduce((sum,value)=>sum+value,0);
const peak=values=>values.reduce((maximum,value)=>Math.max(maximum,Math.abs(value)),0);

test('water flow is frame-rate stable under fixed-step integration',()=>{
  const parameters={initialDisturbance:.0005,inletStrength:.002};
  const at30fps=new WaterFlow(19,13,.9,.45,parameters),at120fps=new WaterFlow(19,13,.9,.45,parameters);
  for(let i=0;i<60;i++)at30fps.advance(1/30);
  for(let i=0;i<240;i++)at120fps.advance(1/120);
  assert.deepEqual(at30fps.heights,at120fps.heights);
  assert.deepEqual(at30fps.velocities,at120fps.velocities);
});

test('gravity carries a local slope across the surface while conserving water volume',()=>{
  const water=new WaterFlow(17,11,.8,.4,{initialDisturbance:0,inletStrength:0,damping:.4});
  const center=5*17+8;water.heights[center]=.001;water.heights[center-1]=-.001;
  const before=Array.from(water.heights);
  for(let i=0;i<30;i++)water.advance(1/120);
  assert.notDeepEqual(Array.from(water.heights),before);
  assert(Math.abs(total(water.heights))<1e-8,'closed surface should retain its mean water level');
  assert(water.heights.some((height,index)=>index!==center&&index!==center-1&&Math.abs(height)>1e-7),'disturbance should propagate to neighbours');
});

test('no-flux boundaries and displacement limiting stay finite after a stalled frame',()=>{
  const water=new WaterFlow(12,8,.6,.3,{initialDisturbance:.02,inletStrength:.2,maxDisplacement:.0015});
  const steps=water.advance(5);
  assert.equal(steps,8,'a stalled tab must not cause an unbounded catch-up loop');
  for(let i=0;i<1200;i++)water.advance(1/60);
  assert(water.heights.every(Number.isFinite));
  assert(water.velocities.every(Number.isFinite));
  assert(peak(water.heights)<=.00150001);
  assert(Math.abs(total(water.heights))<1e-7);
});

test('mounted filter sources create bounded directional surface forcing',()=>{
  const source={position:[.2,.04],direction:[0,1],radius:.22,strength:.65,frequency:1.1,turbulence:.8};
  const water=new WaterFlow(21,15,.8,.4,{initialDisturbance:0,sources:[source]});
  const near=water.sampleCurrent(.2,.04),far=water.sampleCurrent(.9,.9);
  assert(near[1]>.6,'filter outlet should have a forward current');
  assert(Math.hypot(...far)<Math.hypot(...near),'current should decay away from the outlet');
  for(let i=0;i<240;i++)water.advance(1/120);
  assert(water.heights.some(height=>Math.abs(height)>1e-7),'filter should disturb the rendered surface');
  assert(Math.abs(total(water.heights))<1e-7,'surface forcing must not create water volume');
});

test('outlet wakes decay after the pump is switched off while the walls keep them contained',()=>{
  const water=new WaterFlow(31,19,.8,.4,{initialDisturbance:0,damping:1.35,sources:[{position:[.08,.12],direction:[0,1],radius:.18,strength:.75,frequency:1,turbulence:.7}]});
  for(let i=0;i<240;i++)water.advance(1/120);
  const activeEnergy=water.heights.reduce((sum,height,index)=>sum+height*height+water.velocities[index]*water.velocities[index]*.0001,0);
  assert(activeEnergy>0,'the powered outlet should supply wave energy');
  water.setSources([]);
  for(let i=0;i<1440;i++)water.advance(1/120);
  const settlingEnergy=water.heights.reduce((sum,height,index)=>sum+height*height+water.velocities[index]*water.velocities[index]*.0001,0);
  assert(settlingEnergy<activeEnergy*.35,'damping should settle a source-free surface');
  assert(Math.abs(total(water.heights))<1e-7,'reflecting walls must retain mean water level');
});

test('equipment-only rebuilds preserve the live wake while tank or quality grids reset deterministically',()=>{
  const source={position:[.08,.12],direction:[0,1],radius:.18,strength:.75,frequency:1,turbulence:.7};
  const active=new WaterFlow(31,19,.8,.4,{initialDisturbance:0,sources:[source]});
  for(let i=0;i<240;i++)active.advance(1/120);
  const before=Array.from(active.heights),reused=waterFlowForSurface(active,{columns:31,rows:19,width:.8,depth:.4},[]);
  assert.equal(reused,active);
  assert.deepEqual(Array.from(reused.heights),before,'rebuilding a filter should not erase its outgoing wake');
  const reset=waterFlowForSurface(active,{columns:32,rows:19,width:.8,depth:.4},[]);
  assert.notEqual(reset,active);
  assert.equal(peak(reset.heights),0,'a changed surface grid needs a fresh deterministic field');
});

test('CFL subdivision keeps an unusually fine, deep grid finite',()=>{
  const water=new WaterFlow(79,53,.6,.3,{effectiveDepth:.08,fixedTimeStep:1/30,initialDisturbance:.0008,inletStrength:0,damping:.2});
  for(let i=0;i<180;i++)water.advance(1/30);
  assert(water.heights.every(Number.isFinite));
  assert(water.velocities.every(Number.isFinite));
  assert(peak(water.heights)<=water.parameters.maxDisplacement+.00000001);
});

test('an explicitly empty source list stays calm while omitted sources preserve the legacy inlet',()=>{
  const calm=new WaterFlow(15,9,.7,.35,{initialDisturbance:0,sources:[]});
  const legacy=new WaterFlow(15,9,.7,.35,{initialDisturbance:0});
  for(let i=0;i<120;i++){calm.advance(1/120);legacy.advance(1/120);}
  assert.equal(peak(calm.heights),0,'installed-equipment mode with no active filter must not invent a source');
  assert(peak(legacy.heights)>1e-7,'omitting sources must retain the legacy default inlet');
  calm.setSources([]);calm.advance(1/60);assert.equal(peak(calm.heights),0);
});

test('invalid grids and unstable parameter signs are rejected',()=>{
  assert.throws(()=>new WaterFlow(1,8,.6,.3),/at least two/);
  assert.throws(()=>new WaterFlow(8,8,.6,.3,{fixedTimeStep:0}),/stable positive/);
  assert.throws(()=>new WaterFlow(8,8,.6,.3,{damping:-1}),/stable positive/);
});
