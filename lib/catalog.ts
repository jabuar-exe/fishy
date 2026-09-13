import registry from "../public/data/catalog-registry.json" with {type:"json"};
import {catalogExpansion} from "./catalog-expansion.ts";
import {isOrganicCatalogEntry,isSystemCatalogEntry,type CatalogEntry,type CatalogReferenceImage,type CatalogKind,type OrganicCatalogKind} from "./catalog-types.ts";
import type {SceneObject,SceneRecord} from "./scene";
import {fitObject} from "./geometry.ts";

export type {CatalogEntry,CatalogReferenceImage,CatalogKind,OrganicCatalogKind};
export {isOrganicCatalogEntry,isSystemCatalogEntry};

/**
 * The original reference-photo registry remains deliberately small and locally
 * attributed. The expansion supplies original procedural counterparts plus a
 * source link, so catalog browsing never presents an unlicensed supplier image
 * as a Fishy asset.
 */
export const catalogEntries=[...(registry.entries as CatalogEntry[]),...catalogExpansion];
const entriesById=new Map(catalogEntries.map(entry=>[entry.id,entry]));

export function catalogEntryById(id:string) { return entriesById.get(id); }

/** One descriptor for organic thumbnails, interactive samples and Add transactions. */
export function catalogDescriptor(entry:CatalogEntry,id:string):SceneObject {
  if(!isOrganicCatalogEntry(entry))throw new Error(`${entry.displayLabel} is an installed tank system, not a freely placeable material.`);
  if(entry.status!=="supported_procedural")throw new Error("This material is source-only; no 3D sample or addable model is available.");
  const plantColor=entry.color??(/alternanthera/.test(entry.id)?"#924750":"#477d3c");
  return {id,name:entry.displayLabel,kind:entry.kind,position:[0,0,0],rotation:[0,0,0],size:entry.kind==="wood"?.65:1,form:entry.rendererForm,color:entry.color??(entry.kind==="wood"?"#9d7751":entry.kind==="rock"?"#777969":plantColor),protected:false,catalogId:entry.id};
}

export function catalogObject(entry:CatalogEntry,scene:SceneRecord,id:string):SceneObject {
  const object=catalogDescriptor(entry,id);object.position[1]=scene.substrate;return fitObject(object,scene,true);
}
