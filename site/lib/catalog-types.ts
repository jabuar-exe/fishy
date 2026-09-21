export const CATALOG_KINDS=["wood","rock","plant","fish","substrate","filter","light"] as const;
export type CatalogKind=(typeof CATALOG_KINDS)[number];
export type OrganicCatalogKind=Extract<CatalogKind,"wood"|"rock"|"plant">;
export type CatalogReferenceImage={src:string;alt:string;scope:string;sourceUrl:string;author:string;license:string;licenseUrl:string};

export type SubstrateProfile={
  type:"substrate";
  grain:string;
  depth:number;
  roughness:number;
};

export type FilterProfile={
  type:"filter";
  mount:"rear"|"rim";
  silhouette:"canister"|"hob";
  flowClass:"Gentle"|"Moderate"|"High";
  flowStrength:number;
  outlet:"jet"|"sheet"|"line";
  /** Source-listed exterior product dimensions, length × depth × height. */
  nominalDimensionsCm:readonly [number,number,number];
  /** Source-listed maximum pump output. Fishy clamps this into its water model. */
  ratedFlowLph:number;
  /** Source-listed aquarium-volume compatibility band. */
  compatibleVolumeLitres:readonly [number,number];
};

export type LightProfile={
  type:"light";
  mount:"rim"|"suspended";
  silhouette:"bar"|"pendant";
  kelvin:number;
  intensity:number;
  beam:number;
  /** Source-listed rigid light-body dimensions, length × depth × height. */
  nominalDimensionsCm:readonly [number,number,number];
  /** Source-listed rim or stand span supported by the product. */
  compatibleTankWidthCm:readonly [number,number];
  ratedWatts:number;
};

export type CatalogSystemProfile=SubstrateProfile|FilterProfile|LightProfile;

export type OrganicProfile={
  type:"organic";
  /** Representative real-world display range, not the size of every supplied specimen. */
  nominalSizeCm:readonly [number,number];
  scaleBasis:"mature-growth"|"supplier-piece";
  morphology:readonly string[];
};

/** A visual species profile, intentionally limited to identity and render bounds. */
export type FishProfile={
  type:"fish";
  scientificName:string;
  /** Typical adult total-length range, used for the editable starting scale. */
  adultLengthCm:readonly [number,number];
  /** Local model envelope as multiples of saved nose-to-tail length. */
  envelope:{length:number;width:number;height:number};
  schoolSize:readonly [number,number];
  swimTempo:number;
  model:string;
};

export type CatalogEntry={
  id:string;
  displayLabel:string;
  kind:CatalogKind;
  browseTags:string[];
  placementRole:string;
  rendererForm:string;
  status:"supported_procedural"|"reference_only";
  source:{url:string;publisher:string};
  identityCaveat:string;
  renderingLimit:string;
  color?:string;
  referenceImage?:CatalogReferenceImage;
  organic?:OrganicProfile;
  fish?:FishProfile;
  system?:CatalogSystemProfile;
};

export const isOrganicCatalogEntry=(entry:CatalogEntry):entry is CatalogEntry&{kind:OrganicCatalogKind}=>entry.kind==="wood"||entry.kind==="rock"||entry.kind==="plant";
export const isSystemCatalogEntry=(entry:CatalogEntry):entry is CatalogEntry&{system:CatalogSystemProfile}=>!!entry.system&&(entry.kind==="substrate"||entry.kind==="filter"||entry.kind==="light");
export const isFishCatalogEntry=(entry:CatalogEntry):entry is CatalogEntry&{kind:"fish";fish:FishProfile}=>entry.kind==="fish"&&!!entry.fish;
