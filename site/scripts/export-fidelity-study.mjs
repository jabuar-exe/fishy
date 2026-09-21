import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as T from 'three';
import {createPlantedStudy} from '../lib/planted-study.ts';
import {makeObject,disposeObject} from '../lib/geometry.ts';
import {localBounds,fidelityAssetFor} from '../lib/render-assets.ts';
import {organismPaths,organismPose} from '../lib/organism-system.ts';
import {cascadeRoute} from '../lib/cascade.ts';
import {aquariumWaterHeight} from '../lib/render-profile.ts';

const record=createPlantedStudy();
const objects=record.objects.map(object=>{
  const mesh=makeObject(object),box=localBounds(mesh),conversion=new T.Matrix4().makeRotationX(Math.PI/2);
  const matrix=conversion.clone().multiply(mesh.matrixWorld).multiply(conversion.clone().invert());
  const result={...object,asset:fidelityAssetFor(object),localMin:box.min.toArray(),localMax:box.max.toArray(),blenderMatrix:matrix.toArray()};
  disposeObject(mesh);return result;
});
const fish=organismPaths(record,record.visual.organisms).map(route=>({...organismPose(route,0),size:route.size}));
const result={...record,objects,waterHeight:aquariumWaterHeight(record),cascadeRoute:cascadeRoute(record).map(p=>p.toArray()),fish};
const out=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../workstreams/fidelity-reference-20260921/astra-refinement/scene.json');
fs.writeFileSync(out,JSON.stringify(result,null,2));
console.log(`${objects.length} editable objects, ${fish.length}/${record.visual.organisms.count} fish; ${out}`);
