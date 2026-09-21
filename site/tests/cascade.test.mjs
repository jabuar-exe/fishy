import {test} from "node:test";
import assert from "node:assert/strict";
import {initialScene} from "../lib/scene.ts";
import {createPlantedStudy} from "../lib/planted-study.ts";
import {cascadeDrops,cascadeRoute} from "../lib/cascade.ts";
import {aquariumWaterHeight} from "../lib/render-profile.ts";

test("cascade route is absent when no rock reaches above the saved water line",()=>{
  const scene=initialScene();
  assert.deepEqual(cascadeRoute(scene),[]);
});

test("eligible bank cascade remains inside the tank and joins the saved pool",()=>{
  const scene=createPlantedStudy(),route=cascadeRoute(scene),water=aquariumWaterHeight(scene),halfWidth=scene.tank.width/2-.012,halfDepth=scene.tank.depth/2-.012;
  assert(route.length>=3,"the planted study provides an eligible rock-bank route");
  for(const point of route){
    assert(Number.isFinite(point.x)&&Number.isFinite(point.y)&&Number.isFinite(point.z));
    assert(Math.abs(point.x)<=halfWidth+1e-9);
    assert(Math.abs(point.z)<=halfDepth+1e-9);
  }
  assert.equal(route.at(-1).y,water+.001);
});

test("each cascade shelf has an independent downward freefall before its wet ledge",()=>{
  const route=cascadeRoute(createPlantedStudy()),drops=cascadeDrops(route);
  assert.equal(drops.length,route.length-1);
  for(const [index,drop] of drops.entries()){
    const start=drop.getPoint(0),end=drop.getPoint(1);
    assert(start.distanceTo(route[index])<1e-9);
    assert(Math.abs(end.y-route[index+1].y)<1e-9,"each fall arrives at the next shelf height");
    if(index===drops.length-1)assert(end.distanceTo(route.at(-1))<1e-9,"the final fall ends at the saved pool");
    else assert(Math.hypot(end.x-start.x,end.z-start.z)<.014,"intermediate falls stay near vertical before flow continues across the shelf");
    let previous=start.y;
    for(let sample=1;sample<=48;sample++){
      const y=drop.getPoint(sample/48).y;
      assert(y<=previous+1e-9,"a spillway must never climb between its shelves");
      previous=y;
    }
  }
});
