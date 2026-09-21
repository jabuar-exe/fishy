import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {AquariumClock,frameStatistics} from '../lib/animation-clock.ts';
import {CAMERA_VIEWS,tankCameraPose,presentationCameraPose} from '../lib/camera-views.ts';
import {initialScene} from '../lib/scene.ts';

test('one animation clock freezes, resumes without catch-up, bounds stalls and seeks deterministically',()=>{
  const clock=new AquariumClock();clock.tick(1000,true);clock.tick(1020,true);assert.equal(clock.time,.02);
  clock.tick(8000,false);assert.equal(clock.time,.02);clock.suspend();clock.tick(20000,true);assert.equal(clock.time,.02);
  clock.tick(21000,true);assert.equal(clock.time,.07);clock.seek(3);assert.equal(clock.time,3);assert.equal(clock.tick(50000,true),0);
});
test('camera presets fit all tank corners at narrow and desktop aspects',()=>{
  for(const tank of [{width:.6,height:.36,depth:.3},{width:3,height:.1,depth:.1},{width:.1,height:3,depth:3}])for(const aspect of [.35,1,1.8])for(const view of CAMERA_VIEWS){
    const record={...initialScene(),tank:{...tank,source:'user-entered'}},pose=tankCameraPose(record,aspect,view),camera=new T.PerspectiveCamera(pose.fov,aspect,.001,100);
    camera.position.copy(pose.position);camera.lookAt(pose.target);camera.updateMatrixWorld(true);
    for(const x of [-tank.width/2,tank.width/2])for(const y of [0,tank.height])for(const z of [-tank.depth/2,tank.depth/2]){
      const point=new T.Vector3(x,y,z).project(camera);assert(Math.abs(point.x)<1&&Math.abs(point.y)<1&&point.z<1,`${view} at ${aspect} crops tank`);
    }
  }
});
test('presentation ends at the editable camera without moving scene data',()=>{
  const record=initialScene(),before=JSON.stringify(record),end=presentationCameraPose(record,1.5,1),normal=tankCameraPose(record,1.5);
  assert(end.position.distanceTo(normal.position)<1e-8);assert.equal(JSON.stringify(record),before);
  assert.deepEqual(frameStatistics([20,10,40,30]),{median:20,p95:40,fps:50});
});
