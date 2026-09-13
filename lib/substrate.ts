import {boundsOf,tankBounds} from "./geometry.ts";
import type {SceneObject,SceneRecord,Vec3} from "./scene.ts";

const FLOOR_CONTACT_TOLERANCE=.006;

function withVerticalOffset(object:SceneObject,offset:number):SceneObject {
  return {...object,position:[object.position[0],object.position[1]+offset,object.position[2]] as Vec3};
}

/**
 * Replaces the tank-wide substrate without treating it as a transformable
 * object. Pieces resting on the old bed remain in contact with the new bed;
 * suspended pieces keep their world position. Nothing is scaled to make a
 * substrate change succeed.
 */
export function replaceSubstrate(scene:SceneRecord,substrate:number,substrateCatalogId:string):SceneRecord {
  const next={...scene,substrate,substrateCatalogId};
  const offset=substrate-scene.substrate,bounds=tankBounds(next);
  next.objects=scene.objects.map(object=>{
    const previous=boundsOf(object);
    const restsOnFloor=previous.min.y<=scene.substrate+FLOOR_CONTACT_TOLERANCE;
    const updated=restsOnFloor?withVerticalOffset(object,offset):object;
    const measured=boundsOf(updated);
    if(measured.min.y<bounds.min.y-.000001)throw new Error(`${object.name} would intersect the new substrate layer.`);
    if(!bounds.containsBox(measured)){
      const reason=restsOnFloor?"cannot remain supported at this depth":"would leave the tank at this substrate depth";
      if(object.protected)throw new Error(`${object.name} is protected and ${reason}.`);
      throw new Error(`${object.name} ${reason}. Reduce the substrate depth or adjust the object first.`);
    }
    return updated;
  });
  return next;
}
