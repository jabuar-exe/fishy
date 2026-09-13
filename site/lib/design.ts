/**
 * Fishy design principles for the browser editor.
 *
 * Mirror of blender/design_review.py in the site's coordinate system
 * (Y up, X right, Z toward the front glass, origin at the floor centre).
 * DESIGN_PRINCIPLES.md at the workspace root is the canonical text; keep the
 * ids, enumerations, and thresholds here identical to the Python module.
 *
 * Everything is a geometric proxy from object footprints. It says nothing
 * about biology, water, growth, livestock, or how real materials will look.
 */
import { z } from "zod";

export const COMPOSITIONS = ["triangular", "concave", "convex", "diorama", "hardscape-only", "undetermined"] as const;
export const MOODS = ["bright", "lush", "dark-mysterious", "minimal", "undetermined"] as const;
export const MAINTENANCE = ["low", "medium", "high"] as const;
export const FRONT_BAND = 0.3;
const GRID: [number, number] = [120, 60];

export const PRINCIPLES = [
  { id: "hardscape-first", title: "Hardscape carries the design", rule: "Place and size wood and stone first, at a weight that reads clearly against the tank. Plants dress the structure; they do not replace it." },
  { id: "sightline", title: "One path for the eye", rule: "Leave one open channel or open foreground that leads from the front glass into the layout. Keep tall objects out of the front band." },
  { id: "contrast", title: "Contrast in texture, colour and mass", rule: "Pair fine against broad, low against tall, dark against light. A layout of one texture reads flat." },
  { id: "mood", title: "A deliberate mood", rule: "Decide whether the tank is bright and open, lush, dark and mysterious, or minimal, and let every object serve that choice." },
  { id: "proportion", title: "Proportions that leave room to layer", rule: "Prefer tank depth of at least 40 percent of width so foreground, midground, and background can exist. Fill roughly half to nine tenths of the height." },
  { id: "negative-space", title: "A clean frame", rule: "Keep open sand or water visible, keep every object below the waterline, and keep equipment out of the composition." },
  { id: "story", title: "A story and a fish match", rule: "Every good tank has a one-sentence story. Livestock is chosen to fit it, never the other way round." },
  { id: "maintenance", title: "Designed for the maintenance you will actually do", rule: "Hardscape-only and moss or epiphyte layouts are low upkeep; stem-plant layouts need weekly trimming. Declare the tier and design to it." },
] as const;
export type PrincipleId = (typeof PRINCIPLES)[number]["id"];
const PRINCIPLE_INDEX = new Map<PrincipleId, number>(PRINCIPLES.map((p, i) => [p.id, i]));

export const designSchema = z.object({
  composition: z.enum(COMPOSITIONS),
  focalObjectId: z.string().regex(/^[a-z][a-z0-9_-]{0,47}$/),
  sightline: z.string().max(300),
  openForegroundMin: z.number().min(0).max(0.95),
  mood: z.enum(MOODS),
  maintenanceTier: z.enum(MAINTENANCE),
  story: z.string().max(300),
}).strict();
export type DesignIntent = z.infer<typeof designSchema>;

/** Axis-aligned floor footprint of one object in site coordinates (metres). */
export type Footprint = {
  id: string;
  kind: "wood" | "rock" | "plant";
  /** Plant form such as grass, moss, carpet, stem, broadleaf, fern. Ignored for hardscape. */
  form?: string;
  /** [minX, minZ] and [maxX, maxZ] on the floor plane. */
  min: [number, number];
  max: [number, number];
  /** Highest point above the floor, metres. */
  top: number;
};
export type Tank = { width: number; depth: number; height: number; substrate?: number };
export type Status = "warn" | "note" | "ok";
export type Finding = { principle: PrincipleId; status: Status; message: string };
export type DesignReview = {
  reviewVersion: "fishy.design-review.v1";
  inferredComposition: (typeof COMPOSITIONS)[number];
  inferredMaintenance: (typeof MAINTENANCE)[number];
  measures: Measures;
  findings: Finding[];
  counts: Record<Status, number>;
  disclaimer: string;
};
export type Measures = {
  coveredFraction: number;
  hardscapeFootprintFraction: number;
  plantedFootprintFraction: number;
  openForegroundFraction: number;
  massCentreXFraction: number | null;
  massThirds: [number, number, number];
  channel: { xFraction: number; widthFraction: number; depthFraction: number } | null;
  depthBands: Record<"front" | "mid" | "back", { hardscape: boolean; any: boolean }>;
  tallObjectsInFrontBand: string[];
  topFractionOfHeight: number;
  largestHardscapeId: string | null;
  largestHardscapeWidthFraction: number;
  plantForms: string[];
  stemGroupCount: number;
  depthToWidth: number;
};

const STATUS_ORDER: Record<Status, number> = { warn: 0, note: 1, ok: 2 };
const LOW_UPKEEP_FORMS = new Set(["grass", "moss", "carpet"]);
const clip = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const pct = (v: number) => `${Math.round(v * 100)}%`;

type Cell = { top: number; hardscape: boolean; plant: boolean } | null;

/** Convert a site footprint to recipe-style spans: x from the left wall, y from the front glass. */
function spans(f: Footprint, tank: Tank) {
  return {
    x0: f.min[0] + tank.width / 2, x1: f.max[0] + tank.width / 2,
    y0: tank.depth / 2 - f.max[1], y1: tank.depth / 2 - f.min[1],
  };
}

function raster(tank: Tank, footprints: Footprint[]): Cell[][] {
  const [columns, rows] = GRID;
  const substrate = tank.substrate ?? 0;
  const cells: Cell[][] = Array.from({ length: columns }, () => Array<Cell>(rows).fill(null));
  for (const f of footprints) {
    const s = spans(f, tank);
    const i0 = Math.floor(clip(s.x0 / tank.width) * columns), i1 = Math.floor(clip(s.x1 / tank.width) * columns);
    const j0 = Math.floor(clip(s.y0 / tank.depth) * rows), j1 = Math.floor(clip(s.y1 / tank.depth) * rows);
    const top = Math.max(0, f.top - substrate);
    const hardscape = f.kind !== "plant";
    for (let i = i0; i <= Math.min(i1, columns - 1); i++) {
      const cx = (i + 0.5) * tank.width / columns;
      if (cx < s.x0 || cx > s.x1) continue;
      for (let j = j0; j <= Math.min(j1, rows - 1); j++) {
        const cy = (j + 0.5) * tank.depth / rows;
        if (cy < s.y0 || cy > s.y1) continue;
        const cell = cells[i][j];
        if (!cell) cells[i][j] = { top, hardscape, plant: !hardscape };
        else { cell.top = Math.max(cell.top, top); cell.hardscape ||= hardscape; cell.plant ||= !hardscape; }
      }
    }
  }
  return cells;
}

function measure(tank: Tank, footprints: Footprint[], cells: Cell[][]): Measures {
  const [columns, rows] = GRID, total = columns * rows, frontRows = Math.max(1, Math.round(rows * FRONT_BAND));
  const substrate = tank.substrate ?? 0;
  let covered = 0, hard = 0, plant = 0, frontOpen = 0, mass = 0, massX = 0;
  const thirds = [0, 0, 0];
  for (let i = 0; i < columns; i++) for (let j = 0; j < rows; j++) {
    const cell = cells[i][j];
    if (!cell) { if (j < frontRows) frontOpen++; continue; }
    covered++; if (cell.hardscape) hard++; if (cell.plant) plant++;
    mass += cell.top; massX += cell.top * (i + 0.5) / columns; thirds[Math.min(2, Math.floor(i * 3 / columns))] += cell.top;
  }
  const runs: number[] = [];
  for (let i = 0; i < columns; i++) { let r = 0; while (r < rows && !cells[i][r]) r++; runs.push(r / rows); }
  let channel: Measures["channel"] = null, start: number | null = null;
  const minColumns = Math.max(2, Math.round(columns * 0.06));
  for (let i = 0; i <= columns; i++) {
    const deep = i < columns && runs[i] >= 0.5;
    if (deep && start === null) start = i;
    else if (!deep && start !== null) {
      if (i - start >= minColumns) {
        const candidate = { xFraction: (start + i) / 2 / columns, widthFraction: (i - start) / columns, depthFraction: Math.min(...runs.slice(start, i)) };
        if (!channel || candidate.widthFraction > channel.widthFraction) channel = candidate;
      }
      start = null;
    }
  }
  const depthBands: Measures["depthBands"] = { front: { hardscape: false, any: false }, mid: { hardscape: false, any: false }, back: { hardscape: false, any: false } };
  const tall: string[] = [], forms = new Set<string>();
  let topFraction = 0, largest: { id: string; volume: number } | null = null, hardWidth = 0, stems = 0;
  for (const f of footprints) {
    const s = spans(f, tank), cy = (s.y0 + s.y1) / 2 / tank.depth;
    const band = cy < 1 / 3 ? "front" : cy < 2 / 3 ? "mid" : "back";
    depthBands[band].any = true;
    topFraction = Math.max(topFraction, f.top / tank.height);
    if (f.kind !== "plant") {
      depthBands[band].hardscape = true;
      hardWidth = Math.max(hardWidth, (s.x1 - s.x0) / tank.width);
      const volume = (s.x1 - s.x0) * (s.y1 - s.y0) * f.top;
      if (!largest || volume > largest.volume) largest = { id: f.id, volume };
    } else {
      const form = f.form ?? "plant"; forms.add(form); if (!LOW_UPKEEP_FORMS.has(form)) stems++;
    }
    // Only objects centred in the front band count; a bank that starts near the glass and runs back is normal.
    if (cy < FRONT_BAND && f.top - substrate > 0.5 * (tank.height - substrate)) tall.push(f.id);
  }
  return {
    coveredFraction: covered / total, hardscapeFootprintFraction: hard / total, plantedFootprintFraction: plant / total,
    openForegroundFraction: frontOpen / (frontRows * columns), massCentreXFraction: mass ? massX / mass : null,
    massThirds: thirds.map(v => (mass ? v / mass : 0)) as [number, number, number], channel, depthBands,
    tallObjectsInFrontBand: tall, topFractionOfHeight: topFraction, largestHardscapeId: largest?.id ?? null,
    largestHardscapeWidthFraction: hardWidth, plantForms: [...forms].sort(), stemGroupCount: stems, depthToWidth: tank.depth / tank.width,
  };
}

export function inferComposition(m: Measures): DesignReview["inferredComposition"] {
  if (!m.largestHardscapeId && m.plantForms.length === 0) return "undetermined";
  const [left, centre, right] = m.massThirds;
  if (m.plantForms.length === 0) return "hardscape-only";
  if (centre <= 0.2 && left >= 0.3 && right >= 0.3) return "concave";
  if (Math.max(left, right) >= 0.5 && Math.min(left, right) <= 0.2) return "triangular";
  if (centre >= 0.5 && left < 0.3 && right < 0.3) return "convex";
  return "undetermined";
}

export function inferMaintenance(m: Measures): DesignReview["inferredMaintenance"] {
  if (m.plantedFootprintFraction >= 0.45 || m.stemGroupCount >= 6) return "high";
  if (m.plantedFootprintFraction <= 0.15) return "low";
  return "medium";
}

/** Review live footprints against the eight principles. `design` is the user's or model's declared intent, if any. */
export function reviewDesign(tank: Tank, footprints: Footprint[], design?: DesignIntent): DesignReview {
  const cells = raster(tank, footprints), m = measure(tank, footprints, cells);
  const byId = new Map(footprints.map(f => [f.id, f]));
  const out: Finding[] = [];
  const add = (principle: PrincipleId, status: Status, message: string) => out.push({ principle, status, message });
  const inferred = inferComposition(m);

  if (!m.largestHardscapeId) add("hardscape-first", "warn", "No wood or stone: nothing anchors the layout. Place the hardscape before any planting.");
  else if (m.hardscapeFootprintFraction >= 0.12 || m.largestHardscapeWidthFraction >= 0.4) add("hardscape-first", "ok", `Hardscape covers ${pct(m.hardscapeFootprintFraction)} of the floor; the largest piece spans ${pct(m.largestHardscapeWidthFraction)} of the width.`);
  else add("hardscape-first", "warn", `Hardscape covers only ${pct(m.hardscapeFootprintFraction)} of the floor and the largest piece spans ${pct(m.largestHardscapeWidthFraction)} of the width. It will read as decoration, not structure.`);

  if (m.channel) add("sightline", "ok", `Open channel from the front at ${pct(m.channel.xFraction)} of the width, ${pct(m.channel.widthFraction)} wide, reaching ${pct(m.channel.depthFraction)} of the depth.`);
  else if (m.openForegroundFraction >= 0.5) add("sightline", "note", `${pct(m.openForegroundFraction)} of the front band is open but no channel leads into the layout. Fine for a concave or minimal scheme; otherwise open a path.`);
  else add("sightline", "warn", `Only ${pct(m.openForegroundFraction)} of the front band is open. The eye has no way into the layout.`);
  if (m.tallObjectsInFrontBand.length) add("sightline", "warn", `Tall object(s) in the front band block the view: ${m.tallObjectsInFrontBand.join(", ")}.`);
  if (design && design.openForegroundMin > m.openForegroundFraction + 0.05) add("sightline", "warn", `Declared open foreground ${pct(design.openForegroundMin)} but the footprints leave ${pct(m.openForegroundFraction)} open.`);

  const focalId = design?.focalObjectId ?? m.largestHardscapeId;
  const focal = focalId ? byId.get(focalId) : undefined;
  if (focal) {
    const s = spans(focal, tank), x = (s.x0 + s.x1) / 2 / tank.width;
    if ((x >= 0.28 && x <= 0.42) || (x >= 0.58 && x <= 0.72)) add("contrast", "ok", `Focal object ${focal.id} sits on a third at ${pct(x)} of the width.`);
    else if (x > 0.42 && x < 0.58) add("contrast", (design?.composition ?? inferred) === "convex" ? "ok" : "note", `Focal object ${focal.id} is centred at ${pct(x)}. Centred reads static unless the scheme is convex.`);
    else add("contrast", "warn", `Focal object ${focal.id} sits at ${pct(x)} of the width, too close to the glass to hold the eye.`);
  }
  if (m.largestHardscapeId && m.plantForms.length >= 2) add("contrast", "ok", "Hardscape plus at least two plant forms gives texture contrast.");
  else if (m.largestHardscapeId && m.plantForms.length === 1) add("contrast", "note", "Only one plant form. Add a second texture (fine grass against broad leaves, or moss on the wood).");
  else if (m.largestHardscapeId) add("contrast", design?.composition === "hardscape-only" ? "ok" : "note", "No planting. Valid as a hardscape-only design if the stone or wood is impressive on its own; declare it.");
  const [left, centre, right] = m.massThirds;
  if (inferred === "undetermined" && m.largestHardscapeId && Math.max(left, centre, right) < 0.45) add("contrast", "note", `Mass is spread evenly (thirds ${pct(left)} / ${pct(centre)} / ${pct(right)}). Even mass has no direction; bias it toward one scheme.`);
  if (design && design.composition !== "undetermined" && design.composition !== "diorama" && inferred !== "undetermined" && inferred !== design.composition) add("contrast", "warn", `Declared composition ${design.composition} but the mass distribution reads as ${inferred}.`);

  if (design && design.mood !== "undetermined") add("mood", "ok", `Mood declared: ${design.mood}.`);
  else add("mood", "note", "No mood declared. Decide whether the tank is bright, lush, dark-mysterious, or minimal.");
  if (design?.story.trim()) add("story", "ok", `Story declared: ${design.story.trim()}`);
  else add("story", "note", "No story declared. One sentence about what this tank is keeps later choices coherent.");

  if (m.depthToWidth >= 0.4) add("proportion", "ok", `Depth is ${pct(m.depthToWidth)} of width; there is room for front, middle and back layers.`);
  else add("proportion", "note", `Depth is only ${pct(m.depthToWidth)} of width. Shallow tanks limit layering; keep the layout to two depth planes.`);
  const hardBands = (Object.keys(m.depthBands) as Array<keyof Measures["depthBands"]>).filter(b => m.depthBands[b].hardscape);
  if (m.largestHardscapeId) add("proportion", hardBands.length >= 2 ? "ok" : "note", hardBands.length >= 2 ? `Hardscape occupies ${hardBands.join(" and ")} depth bands.` : "All hardscape sits in one depth band; stepping a piece forward or back adds depth.");
  if (m.topFractionOfHeight < 0.35) add("proportion", "note", `Tallest object reaches ${pct(m.topFractionOfHeight)} of the tank height; the layout will read flat unless minimal is the intent.`);
  else if (m.topFractionOfHeight <= 0.9) add("proportion", "ok", `Tallest object reaches ${pct(m.topFractionOfHeight)} of the tank height.`);

  if (m.topFractionOfHeight > 0.97) add("negative-space", "warn", `Tallest object reaches ${pct(m.topFractionOfHeight)} of the height and will break the waterline.`);
  if (m.coveredFraction > 0.85) add("negative-space", "warn", `${pct(m.coveredFraction)} of the floor is covered. There is no negative space left.`);
  else if (m.coveredFraction > 0.6) add("negative-space", "note", `${pct(m.coveredFraction)} of the floor is covered. Consider opening more sand or water.`);
  else add("negative-space", "ok", `${pct(m.coveredFraction)} of the floor is covered; negative space remains.`);

  const proxy = inferMaintenance(m);
  if (design) add("maintenance", design.maintenanceTier === proxy ? "ok" : "warn", design.maintenanceTier === proxy ? `Declared maintenance tier ${proxy} matches the planted footprint.` : `Declared maintenance tier ${design.maintenanceTier} but ${pct(m.plantedFootprintFraction)} planted floor and ${m.stemGroupCount} stem groups read as ${proxy}.`);
  else add("maintenance", "note", `No tier declared. The planted footprint reads as ${proxy} maintenance.`);

  out.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || PRINCIPLE_INDEX.get(a.principle)! - PRINCIPLE_INDEX.get(b.principle)!);
  const counts: Record<Status, number> = { warn: 0, note: 0, ok: 0 };
  for (const f of out) counts[f.status]++;
  return {
    reviewVersion: "fishy.design-review.v1", inferredComposition: inferred, inferredMaintenance: proxy, measures: m, findings: out, counts,
    disclaimer: "Geometric proxies from axis-aligned footprints in a rectangular tank. Not a judgement of biology, water, growth, livestock, or the real materials' appearance.",
  };
}

/** Short lines, warnings first, for a status panel or a spoken explanation. */
export function summarise(review: DesignReview, limit = 6): string[] {
  return review.findings.slice(0, limit).map(f => `[${f.status}] ${f.principle}: ${f.message}`);
}
