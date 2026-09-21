import {z} from "zod";
import {FISH_SPECIES,type FishSpecies} from "./fish-species.ts";

export const ORGANISM_SPECIES=FISH_SPECIES;
export type OrganismSpecies=FishSpecies;

export const DEFAULT_ORGANISM_PROFILE={enabled:false,species:"neon-tetra",count:6,size:.028,seed:1} as const;
export const DEFAULT_VISUAL_PROFILE={quality:"auto",motion:true,clarity:.72,plantMotion:.5,waterLevel:1,cascade:false,organisms:DEFAULT_ORGANISM_PROFILE} as const;

export const organismSchoolSchema=z.object({
  id:z.string().min(1).max(100),
  enabled:z.boolean(),
  species:z.enum(ORGANISM_SPECIES),
  count:z.number().int().min(0).max(12),
  size:z.number().min(.008).max(.09),
  seed:z.number().int().min(0).max(0xffffffff),
}).strict();

export const organismProfileSchema=z.object({
  enabled:z.boolean(),
  species:z.enum(ORGANISM_SPECIES),
  count:z.number().int().min(0).max(12),
  /** Nose-to-tail length in metres; pose and enclosure checks derive the remaining axes. */
  size:z.number().min(.008).max(.09),
  seed:z.number().int().min(0).max(0xffffffff),
  /** Additional species schools. The legacy fields remain the first school. */
  schools:z.array(organismSchoolSchema).max(8).optional(),
}).strict();

export const visualProfileSchema=z.object({
  quality:z.enum(["auto","high","low"]),
  motion:z.boolean(),
  clarity:z.number().min(0).max(1),
  plantMotion:z.number().min(0).max(1),
  waterLevel:z.number().min(.15).max(1).default(1),
  cascade:z.boolean().default(false),
  organisms:organismProfileSchema,
}).strict();

export type OrganismProfile=z.infer<typeof organismProfileSchema>;
export type OrganismSchool=z.infer<typeof organismSchoolSchema>;
export type VisualProfile=z.infer<typeof visualProfileSchema>;

/** Parse a stable complete render profile for legacy saves, UI drafts and renderers. */
export function resolveVisualProfile(value:unknown=DEFAULT_VISUAL_PROFILE):VisualProfile {
  return visualProfileSchema.parse(value);
}

/** Full tanks retain the original 15mm headroom; shallow pools keep a wet layer above the bed. */
export function aquariumWaterHeight(record:{tank:{height:number};substrate:number;visual?:{waterLevel?:number}}) {
  return Math.min(record.tank.height-.015,Math.max(record.substrate+.018,record.tank.height*(record.visual?.waterLevel??1)));
}
