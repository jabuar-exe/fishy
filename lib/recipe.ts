/**
 * Browser scene → Blender recipe bridge.
 *
 * Converts a validated browser `SceneRecord` into a `fishy.recipe.v2` document
 * that `blender/scene_recipe.py` accepts and `blender/build_recipe.py` builds.
 * This is the artifact hand-off described in design-lab/PRODUCT_DIRECTION.md:
 * Blender never runs on the web request path, it consumes a recipe file.
 *
 * Coordinate contract. The browser is Y-up, X right, Z toward the front glass,
 * origin at the floor centre. The recipe is Blender's Z-up, X right, Y toward
 * the back, origin at the front-left-bottom interior corner:
 *
 *   recipe_x = site_x + width / 2
 *   recipe_y = depth / 2 - site_z
 *   recipe_z = site_y                      (height above the tank floor)
 *
 * Honest limits. A recipe carries approximate asset envelopes and a seed, not
 * the browser's mesh. Blender regenerates `rock`/`branchwood`/`grass`/`bush`
 * procedurally inside each envelope, so the built tank matches the browser's
 * composition, footprint and scale — not its exact silhouette. Sculpt edits are
 * bounds-only in the transfer, and per-object colour does not cross over.
 */
import * as T from "three";
import { boundsOf } from "./geometry.ts";
import {
  designSchema, inferComposition, inferMaintenance, reviewDesign,
  type DesignIntent, type Footprint, type Tank,
} from "./design.ts";
import type { SceneObject, SceneRecord } from "./scene.ts";

export const RECIPE_SCHEMA_VERSION = "fishy.recipe.v2";
/** Mirrors ASSETS in blender/scene_recipe.py. */
export const RECIPE_ASSETS = ["rock", "branchwood", "grass", "bush"] as const;
export type RecipeAsset = (typeof RECIPE_ASSETS)[number];

/** Plant forms Blender builds as a fine carpet rather than a leafy bush. */
const GRASS_FORMS = new Set(["grass", "carpet", "moss"]);
const MAX_OBJECTS = 24;
const MIN_SIZE_M = 0.002;
const MAX_SUBSTRATE_M = 0.2;
const SUBSTRATE_HEIGHT_FRACTION = 0.3;
const ID_PATTERN = /^[a-z][a-z0-9_-]{0,47}$/;

export type RecipeObject = {
  id: string;
  label: string;
  asset: RecipeAsset;
  /** [X, Y, Z] base-centre in metres; Z is the lowest point. */
  position_m: [number, number, number];
  /** [width, depth, height] full envelope before yaw, in metres. */
  size_m: [number, number, number];
  yaw_deg: number;
  seed: number;
};

export type Recipe = {
  schema_version: typeof RECIPE_SCHEMA_VERSION;
  title: string;
  interpretation: string;
  assumptions: string[];
  design: {
    composition: DesignIntent["composition"];
    focal_object_id: string;
    sightline: string;
    open_foreground_min: number;
    mood: DesignIntent["mood"];
    maintenance_tier: DesignIntent["maintenanceTier"];
    story: string;
  };
  tank: { width_m: number; depth_m: number; height_m: number; substrate_depth_m: number };
  objects: RecipeObject[];
};

export class RecipeExportError extends Error {
  readonly detail: string[];
  constructor(message: string, detail: string[] = []) {
    super(message);
    this.name = "RecipeExportError";
    this.detail = detail;
  }
}

const round = (value: number, places = 6) => Number(value.toFixed(places));
const clamp = (value: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, value));

/** Wrap to (-180, 180] so the recipe's yaw_deg bounds always hold. */
function normaliseYaw(radians: number) {
  const degrees = (radians * 180) / Math.PI;
  const wrapped = ((degrees % 360) + 540) % 360 - 180;
  return round(wrapped === -180 ? 180 : wrapped, 4);
}

/** Deterministic non-negative seed so the same scene rebuilds the same meshes. */
function seedFrom(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % 1000000;
}

/** Coerce a browser object id into the recipe's id grammar, keeping it unique. */
export function recipeIdFor(rawId: string, used: Set<string>) {
  const body = rawId.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  // The grammar needs a leading letter; an id with nothing left to keep gets a plain name.
  let id = !body ? "object" : /^[a-z]/.test(body) ? body : `o-${body}`;
  id = id.slice(0, 48).replace(/-$/, "");
  if (!used.has(id)) { used.add(id); return id; }
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = `${id.slice(0, 48 - suffix.length).replace(/-$/, "")}${suffix}`;
    if (!used.has(candidate)) { used.add(candidate); return candidate; }
  }
}

export function assetFor(object: SceneObject): RecipeAsset {
  if (object.kind === "wood") return "branchwood";
  if (object.kind === "rock") return "rock";
  return GRASS_FORMS.has(object.form) ? "grass" : "bush";
}

/** Floor footprints in site coordinates, for the design review and derivation. */
export function footprintsOf(scene: SceneRecord): Footprint[] {
  return scene.objects.map(object => {
    const bounds = boundsOf(object);
    return {
      id: object.id,
      kind: object.kind,
      form: object.form,
      min: [bounds.min.x, bounds.min.z] as [number, number],
      max: [bounds.max.x, bounds.max.z] as [number, number],
      top: bounds.max.y,
    };
  });
}

/**
 * Envelope of one object with its yaw removed, plus the yaw itself.
 *
 * The recipe rotates a box about its own base-centre, while the browser rotates
 * a group about its origin. Measuring the pre-yaw box and then rotating the
 * pivot→centre offset reproduces the browser placement exactly for a box.
 */
function envelopeOf(object: SceneObject) {
  const yaw = object.rotation[1];
  const flat = boundsOf({ ...object, rotation: [object.rotation[0], 0, object.rotation[2]] });
  const size = flat.getSize(new T.Vector3());
  const centre = flat.getCenter(new T.Vector3());
  // Three.js rotation about +Y: (x, z) → (x cosθ + z sinθ, −x sinθ + z cosθ).
  const cos = Math.cos(yaw), sin = Math.sin(yaw);
  const offsetX = centre.x - object.position[0], offsetZ = centre.z - object.position[2];
  return {
    yaw,
    worldX: object.position[0] + offsetX * cos + offsetZ * sin,
    worldZ: object.position[2] - offsetX * sin + offsetZ * cos,
    baseY: flat.min.y,
    size,
  };
}

/** Conservative world AABB of a recipe object. Mirrors recipe_bounds in scene_recipe.py. */
export function recipeBounds(object: RecipeObject) {
  const [x, y, z] = object.position_m;
  const [width, depth, height] = object.size_m;
  const yaw = (object.yaw_deg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(yaw)), sin = Math.abs(Math.sin(yaw));
  const halfX = (cos * width + sin * depth) / 2;
  const halfY = (sin * width + cos * depth) / 2;
  return { min: [x - halfX, y - halfY, z], max: [x + halfX, y + halfY, z + height] };
}

/**
 * Fill the design block schema v2 requires when the scene carries no declared
 * intent. Everything here is measured from the geometry, never invented, and
 * the caller records it as an assumption.
 */
export function deriveDesign(scene: SceneRecord, footprints: Footprint[]): DesignIntent {
  const tank: Tank = { ...scene.tank, substrate: scene.substrate };
  const review = reviewDesign(tank, footprints);
  const measures = review.measures;
  const focal = measures.largestHardscapeId ?? footprints[0]?.id;
  const channel = measures.channel;
  return designSchema.parse({
    composition: inferComposition(measures),
    focalObjectId: focal ? recipeIdFor(focal, new Set()) : "object",
    sightline: channel
      ? `Open channel from the front glass at ${Math.round(channel.xFraction * 100)}% of the width, reaching ${Math.round(channel.depthFraction * 100)}% of the depth.`
      : `No single channel; ${Math.round(measures.openForegroundFraction * 100)}% of the front band is left open.`,
    openForegroundMin: round(clamp(measures.openForegroundFraction, 0, 0.95), 3),
    mood: "undetermined",
    maintenanceTier: inferMaintenance(measures),
    story: scene.brief.trim().slice(0, 300) || `${scene.name}, exported from the Fishy browser editor.`,
  });
}

/**
 * Convert a browser scene into a recipe Blender can build.
 *
 * Throws RecipeExportError rather than silently repairing geometry: a recipe
 * that does not describe what the editor shows is worse than a refusal.
 */
export function toRecipe(scene: SceneRecord, options: { interpretation?: string } = {}): Recipe {
  if (!scene.objects.length) throw new RecipeExportError("This scene has no objects to build.");
  if (scene.objects.length > MAX_OBJECTS) {
    throw new RecipeExportError(`A recipe holds at most ${MAX_OBJECTS} objects; this scene has ${scene.objects.length}. Remove ${scene.objects.length - MAX_OBJECTS} before exporting.`);
  }

  const assumptions: string[] = [];
  const { width, depth, height } = scene.tank;
  const substrateCap = Math.min(MAX_SUBSTRATE_M, height * SUBSTRATE_HEIGHT_FRACTION);
  const substrate = clamp(scene.substrate, 0, substrateCap);
  if (substrate !== scene.substrate) {
    assumptions.push(`Substrate reduced from ${round(scene.substrate * 100, 1)} cm to ${round(substrate * 100, 1)} cm: a recipe caps it at 30% of tank height.`);
  }
  if (scene.substrateCatalogId) assumptions.push("Selected substrate product is retained as browser-side floor metadata; the Blender recipe transfers only its visual depth envelope.");
  if (scene.equipment.length) assumptions.push(`${scene.equipment.length} installed filter/light system${scene.equipment.length===1?"":"s"} omitted from the Blender object recipe; their browser-only mounting, flow, and lighting behavior is not represented as loose hardscape.`);

  const used = new Set<string>();
  const idMap = new Map<string, string>();
  const objects: RecipeObject[] = scene.objects.map(object => {
    const id = recipeIdFor(object.id, used);
    idMap.set(object.id, id);
    const envelope = envelopeOf(object);
    const size: [number, number, number] = [
      clamp(round(envelope.size.x), MIN_SIZE_M, width),
      clamp(round(envelope.size.z), MIN_SIZE_M, depth),
      clamp(round(envelope.size.y), MIN_SIZE_M, height),
    ];
    return {
      id,
      label: object.name.slice(0, 100),
      asset: assetFor(object),
      position_m: [
        round(envelope.worldX + width / 2),
        round(depth / 2 - envelope.worldZ),
        round(Math.max(envelope.baseY, substrate)),
      ],
      size_m: size,
      yaw_deg: normaliseYaw(envelope.yaw),
      seed: seedFrom(`${scene.id}:${object.id}:${object.form}`),
    };
  });

  const sculpted = scene.objects.filter(object => object.sculpt?.nodes.length).length;
  if (sculpted) assumptions.push(`${sculpted} sculpted object${sculpted === 1 ? "" : "s"} transferred as ${sculpted === 1 ? "its" : "their"} bounding envelope only; Blender regenerates the mesh procedurally from the seed.`);
  if (scene.objects.some(object => object.rotation[0] || object.rotation[2])) {
    assumptions.push("Tilt on X or Z was absorbed into the exported envelope; a recipe carries yaw only.");
  }
  assumptions.push("Assets are procedural approximations built inside each envelope, not the browser's meshes.");

  const footprints = footprintsOf(scene);
  const declared = scene.design ? designSchema.parse(scene.design) : null;
  const design = declared ?? deriveDesign(scene, footprints);
  if (!declared) assumptions.push("Design block derived from the exported geometry; the scene carried no declared design intent.");

  const focalObjectId = idMap.get(design.focalObjectId) ?? (ID_PATTERN.test(design.focalObjectId) && used.has(design.focalObjectId) ? design.focalObjectId : objects[0].id);
  if (focalObjectId !== design.focalObjectId) {
    assumptions.push(`Focal object resolved to "${focalObjectId}"; the declared focal id did not match an exported object.`);
  }

  const recipe: Recipe = {
    schema_version: RECIPE_SCHEMA_VERSION,
    title: scene.name.slice(0, 120),
    interpretation: ((options.interpretation ?? scene.brief.trim()) || `Direct export of the Fishy browser scene "${scene.name}" at revision ${scene.revision}.`).slice(0, 2000),
    assumptions: assumptions.slice(0, 12).map(note => note.slice(0, 500)),
    design: {
      composition: design.composition,
      focal_object_id: focalObjectId,
      sightline: design.sightline,
      open_foreground_min: design.openForegroundMin,
      mood: design.mood,
      maintenance_tier: design.maintenanceTier,
      story: design.story,
    },
    tank: { width_m: round(width), depth_m: round(depth), height_m: round(height), substrate_depth_m: round(substrate) },
    objects,
  };

  const overflow = validateRecipeFit(recipe);
  if (overflow.length) {
    throw new RecipeExportError("Some objects do not fit inside the tank as a recipe envelope. Move or shrink them, then export again.", overflow);
  }
  return recipe;
}

/** Names of objects whose rotated envelope leaves the tank, mirroring the Blender check. */
export function validateRecipeFit(recipe: Recipe, tolerance = 1e-6) {
  const { width_m, depth_m, height_m, substrate_depth_m } = recipe.tank;
  const problems: string[] = [];
  for (const object of recipe.objects) {
    const bounds = recipeBounds(object);
    const outside =
      bounds.min[0] < -tolerance || bounds.max[0] > width_m + tolerance ||
      bounds.min[1] < -tolerance || bounds.max[1] > depth_m + tolerance ||
      bounds.min[2] < substrate_depth_m - tolerance || bounds.max[2] > height_m + tolerance;
    if (outside) problems.push(`${object.label} (${object.id})`);
  }
  return problems;
}
