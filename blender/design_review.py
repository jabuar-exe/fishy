"""Geometric design review for a validated Fishy scene recipe.

Fishy's core consideration is aquascape design quality, defined in
DESIGN_PRINCIPLES.md at the workspace root. This module turns the measurable
part of those principles into proxies computed from object envelopes, and
reports findings that the generator, the editor, and the conversation layer
can all use.

Everything here is a proxy from axis-aligned envelopes in a rectangular tank.
It says nothing about biology, water chemistry, growth, fish welfare, or how
the real wood, stone, and plants will look. The review never edits a recipe.

Run standalone::

    python3 blender/design_review.py path/to/recipe.json
"""

from __future__ import annotations

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scene_recipe import RecipeError, load_recipe, recipe_bounds  # noqa: E402


REVIEW_VERSION = "fishy.design-review.v1"
GRID = (120, 60)
HARDSCAPE = frozenset({"rock", "branchwood"})
PLANTS = frozenset({"grass", "bush"})
COMPOSITIONS = ("triangular", "concave", "convex", "diorama", "hardscape-only", "undetermined")
MOODS = ("bright", "lush", "dark-mysterious", "minimal", "undetermined")
MAINTENANCE = ("low", "medium", "high")
FRONT_BAND = 0.3
STATUS_ORDER = {"warn": 0, "note": 1, "ok": 2}

# (id, title, rule). Ids are stable; DESIGN_PRINCIPLES.md documents each one.
PRINCIPLES = (
    ("hardscape-first", "Hardscape carries the design",
     "Place and size wood and stone first, at a weight that reads clearly against the tank. Plants dress the structure; they do not replace it."),
    ("sightline", "One path for the eye",
     "Leave one open channel or open foreground that leads from the front glass into the layout. Keep tall objects out of the front band."),
    ("contrast", "Contrast in texture, colour and mass",
     "Pair fine against broad, low against tall, dark against light. A layout of one texture reads flat."),
    ("mood", "A deliberate mood",
     "Decide whether the tank is bright and open, lush, dark and mysterious, or minimal, and let every object serve that choice."),
    ("proportion", "Proportions that leave room to layer",
     "Prefer tank depth of at least 40 percent of width so foreground, midground, and background can exist. Fill roughly half to nine tenths of the height."),
    ("negative-space", "A clean frame",
     "Keep open sand or water visible, keep every object below the waterline, and keep equipment out of the composition."),
    ("story", "A story and a fish match",
     "Every good tank has a one-sentence story. Livestock is chosen to fit it, never the other way round."),
    ("maintenance", "Designed for the maintenance you will actually do",
     "Hardscape-only and moss or epiphyte layouts are low upkeep; stem-plant layouts need weekly trimming. Declare the tier and design to it."),
)
PRINCIPLE_IDS = tuple(identifier for identifier, _, _ in PRINCIPLES)


def prompt_guidance():
    """Compact principle text for a model prompt. Data for the model, not code."""
    lines = ["Fishy design principles (core consideration; apply them, do not merely mention them):"]
    for index, (identifier, title, rule) in enumerate(PRINCIPLES, 1):
        lines.append(f"{index}. {title} [{identifier}]: {rule}")
    lines.append(
        "Fill the recipe's design block honestly: composition is one of "
        + ", ".join(COMPOSITIONS) + "; focal_object_id names the object the eye should land on; "
        "sightline describes the open path in words; open_foreground_min is the fraction of the front "
        f"{int(FRONT_BAND * 100)} percent of the floor you intend to keep clear; mood is one of "
        + ", ".join(MOODS) + "; maintenance_tier is one of " + ", ".join(MAINTENANCE)
        + "; story is one sentence. Use 'undetermined' rather than inventing a scheme the reference does not show."
    )
    return "\n".join(lines)


def _clip(value, lower=0.0, upper=1.0):
    return max(lower, min(upper, value))


def _raster(recipe):
    """Mark grid cells covered by each object's rotated envelope."""
    tank = recipe["tank"]
    width, depth, substrate = tank["width_m"], tank["depth_m"], tank["substrate_depth_m"]
    columns, rows = GRID
    cells = [[None for _ in range(rows)] for _ in range(columns)]
    for obj in recipe["objects"]:
        bounds = recipe_bounds(obj)
        x0 = int(_clip(bounds["min_m"][0] / width) * columns)
        x1 = int(_clip(bounds["max_m"][0] / width) * columns)
        y0 = int(_clip(bounds["min_m"][1] / depth) * rows)
        y1 = int(_clip(bounds["max_m"][1] / depth) * rows)
        top = max(0.0, bounds["max_m"][2] - substrate)
        for i in range(x0, min(x1 + 1, columns)):
            centre_x = (i + 0.5) * width / columns
            if not bounds["min_m"][0] <= centre_x <= bounds["max_m"][0]:
                continue
            for j in range(y0, min(y1 + 1, rows)):
                centre_y = (j + 0.5) * depth / rows
                if not bounds["min_m"][1] <= centre_y <= bounds["max_m"][1]:
                    continue
                current = cells[i][j]
                if current is None:
                    cells[i][j] = {"top": top, "hardscape": obj["asset"] in HARDSCAPE, "plant": obj["asset"] in PLANTS}
                else:
                    current["top"] = max(current["top"], top)
                    current["hardscape"] = current["hardscape"] or obj["asset"] in HARDSCAPE
                    current["plant"] = current["plant"] or obj["asset"] in PLANTS
    return cells


def _measures(recipe, cells):
    tank = recipe["tank"]
    width, depth, height, substrate = (tank[key] for key in ("width_m", "depth_m", "height_m", "substrate_depth_m"))
    columns, rows = GRID
    total = columns * rows
    front_rows = max(1, int(round(rows * FRONT_BAND)))
    covered = hardscape_cells = plant_cells = 0
    front_open = 0
    mass = mass_x = 0.0
    thirds = [0.0, 0.0, 0.0]
    for i in range(columns):
        for j in range(rows):
            cell = cells[i][j]
            if cell is None:
                if j < front_rows:
                    front_open += 1
                continue
            covered += 1
            hardscape_cells += cell["hardscape"]
            plant_cells += cell["plant"]
            weight = cell["top"]
            mass += weight
            mass_x += weight * (i + 0.5) / columns
            thirds[min(2, i * 3 // columns)] += weight

    channel = None
    runs = []
    for i in range(columns):
        run = 0
        while run < rows and cells[i][run] is None:
            run += 1
        runs.append(run / rows)
    minimum_columns = max(2, int(round(columns * 0.06)))
    start = None
    for i in range(columns + 1):
        deep = i < columns and runs[i] >= 0.5
        if deep and start is None:
            start = i
        elif not deep and start is not None:
            if i - start >= minimum_columns:
                candidate = {"x_fraction": (start + i) / 2 / columns, "width_fraction": (i - start) / columns,
                             "depth_fraction": min(runs[start:i])}
                if channel is None or candidate["width_fraction"] > channel["width_fraction"]:
                    channel = candidate
            start = None

    bands = {"front": {"hardscape": False, "any": False}, "mid": {"hardscape": False, "any": False}, "back": {"hardscape": False, "any": False}}
    tall_front = []
    top_fraction = 0.0
    largest_hardscape = None
    hardscape_width = 0.0
    kinds = {"hardscape": set(), "plants": set()}
    for obj in recipe["objects"]:
        bounds = recipe_bounds(obj)
        centre_y = (bounds["min_m"][1] + bounds["max_m"][1]) / 2 / depth
        band = "front" if centre_y < 1 / 3 else "mid" if centre_y < 2 / 3 else "back"
        bands[band]["any"] = True
        top_fraction = max(top_fraction, bounds["max_m"][2] / height)
        if obj["asset"] in HARDSCAPE:
            kinds["hardscape"].add(obj["asset"])
            bands[band]["hardscape"] = True
            extent = bounds["max_m"][0] - bounds["min_m"][0]
            hardscape_width = max(hardscape_width, extent / width)
            volume = obj["size_m"][0] * obj["size_m"][1] * obj["size_m"][2]
            if largest_hardscape is None or volume > largest_hardscape[1]:
                largest_hardscape = (obj["id"], volume)
        else:
            kinds["plants"].add(obj["asset"])
        # Only objects that sit in the front band count; a bank that starts near
        # the glass and runs back is normal in concave and triangular layouts.
        if centre_y < FRONT_BAND and (bounds["max_m"][2] - substrate) > 0.5 * (height - substrate):
            tall_front.append(obj["id"])

    return {
        "grid": list(GRID),
        "covered_fraction": covered / total,
        "hardscape_footprint_fraction": hardscape_cells / total,
        "planted_footprint_fraction": plant_cells / total,
        "open_foreground_fraction": front_open / (front_rows * columns),
        "mass_centre_x_fraction": (mass_x / mass) if mass else None,
        "mass_thirds": [round(value / mass, 4) if mass else 0.0 for value in thirds],
        "channel": channel,
        "depth_bands": bands,
        "tall_objects_in_front_band": tall_front,
        "top_fraction_of_height": top_fraction,
        "largest_hardscape_id": largest_hardscape[0] if largest_hardscape else None,
        "largest_hardscape_width_fraction": hardscape_width,
        "hardscape_assets": sorted(kinds["hardscape"]),
        "plant_assets": sorted(kinds["plants"]),
        "bush_count": sum(obj["asset"] == "bush" for obj in recipe["objects"]),
        "depth_to_width": depth / width,
        "height_to_width": height / width,
    }


def infer_composition(measures):
    """Infer the mass scheme from left/centre/right thirds. Diorama is never inferred."""
    if not measures["hardscape_assets"] and not measures["plant_assets"]:
        return "undetermined"
    left, centre, right = measures["mass_thirds"]
    if not measures["plant_assets"]:
        return "hardscape-only"
    if centre <= 0.2 and left >= 0.3 and right >= 0.3:
        return "concave"
    if max(left, right) >= 0.5 and min(left, right) <= 0.2:
        return "triangular"
    if centre >= 0.5 and left < 0.3 and right < 0.3:
        return "convex"
    return "undetermined"


def infer_maintenance(measures):
    if measures["planted_footprint_fraction"] >= 0.45 or measures["bush_count"] >= 6:
        return "high"
    if measures["planted_footprint_fraction"] <= 0.15:
        return "low"
    return "medium"


def _finding(principle, status, message):
    assert principle in PRINCIPLE_IDS and status in STATUS_ORDER
    return {"principle": principle, "status": status, "message": message}


def _findings(recipe, measures, declared):
    findings = []
    ids = {obj["id"]: obj for obj in recipe["objects"]}
    width = recipe["tank"]["width_m"]
    height = recipe["tank"]["height_m"]

    # hardscape-first
    if not measures["hardscape_assets"]:
        findings.append(_finding("hardscape-first", "warn", "No wood or stone: nothing anchors the layout. Place the hardscape before any planting."))
    elif measures["hardscape_footprint_fraction"] >= 0.12 or measures["largest_hardscape_width_fraction"] >= 0.4:
        findings.append(_finding("hardscape-first", "ok",
                                 f"Hardscape covers {measures['hardscape_footprint_fraction']:.0%} of the floor; the largest piece spans {measures['largest_hardscape_width_fraction']:.0%} of the width."))
    else:
        findings.append(_finding("hardscape-first", "warn",
                                 f"Hardscape covers only {measures['hardscape_footprint_fraction']:.0%} of the floor and the largest piece spans {measures['largest_hardscape_width_fraction']:.0%} of the width. It will read as decoration, not structure."))

    # sightline
    channel = measures["channel"]
    if channel:
        findings.append(_finding("sightline", "ok",
                                 f"Open channel from the front at {channel['x_fraction']:.0%} of the width, {channel['width_fraction']:.0%} wide, reaching {channel['depth_fraction']:.0%} of the depth."))
    elif measures["open_foreground_fraction"] >= 0.5:
        findings.append(_finding("sightline", "note",
                                 f"{measures['open_foreground_fraction']:.0%} of the front band is open but no channel leads into the layout. Fine for a concave or minimal scheme; otherwise open a path."))
    else:
        findings.append(_finding("sightline", "warn",
                                 f"Only {measures['open_foreground_fraction']:.0%} of the front band is open. The eye has no way into the layout."))
    if measures["tall_objects_in_front_band"]:
        names = ", ".join(measures["tall_objects_in_front_band"])
        findings.append(_finding("sightline", "warn", f"Tall object(s) in the front band block the view: {names}."))
    if declared and declared["open_foreground_min"] > measures["open_foreground_fraction"] + 0.05:
        findings.append(_finding("sightline", "warn",
                                 f"Declared open_foreground_min {declared['open_foreground_min']:.0%} but the envelopes leave {measures['open_foreground_fraction']:.0%} open."))

    # focal point
    focal_id = declared["focal_object_id"] if declared else measures["largest_hardscape_id"]
    if focal_id and focal_id in ids:
        bounds = recipe_bounds(ids[focal_id])
        x = (bounds["min_m"][0] + bounds["max_m"][0]) / 2 / width
        inferred = infer_composition(measures)
        if 0.28 <= x <= 0.42 or 0.58 <= x <= 0.72:
            findings.append(_finding("contrast", "ok", f"Focal object {focal_id} sits on a third at {x:.0%} of the width."))
        elif 0.42 < x < 0.58:
            status = "ok" if (declared or {}).get("composition", inferred) == "convex" else "note"
            findings.append(_finding("contrast", status, f"Focal object {focal_id} is centred at {x:.0%}. Centred reads static unless the scheme is convex."))
        else:
            findings.append(_finding("contrast", "warn", f"Focal object {focal_id} sits at {x:.0%} of the width, too close to the glass to hold the eye."))

    # contrast (texture and mass)
    if measures["hardscape_assets"] and len(measures["plant_assets"]) >= 2:
        findings.append(_finding("contrast", "ok", "Hardscape plus at least two plant forms gives texture contrast."))
    elif measures["hardscape_assets"] and len(measures["plant_assets"]) == 1:
        findings.append(_finding("contrast", "note", "Only one plant form. Add a second texture (fine grass against broad leaves, or moss on the wood)."))
    elif measures["hardscape_assets"]:
        status = "ok" if (declared or {}).get("composition") == "hardscape-only" else "note"
        findings.append(_finding("contrast", status, "No planting. Valid as a hardscape-only design if the stone or wood is impressive on its own; declare it."))
    inferred = infer_composition(measures)
    left, centre, right = measures["mass_thirds"]
    if inferred == "undetermined" and measures["hardscape_assets"] and max(left, centre, right) < 0.45:
        findings.append(_finding("contrast", "note",
                                 f"Mass is spread evenly (thirds {left:.0%} / {centre:.0%} / {right:.0%}). Even mass has no direction; bias it toward one scheme."))
    if declared and declared["composition"] not in ("undetermined", "diorama") and inferred not in ("undetermined", declared["composition"]):
        findings.append(_finding("contrast", "warn",
                                 f"Declared composition {declared['composition']} but the mass distribution reads as {inferred}."))

    # mood and story
    if declared and declared["mood"] != "undetermined":
        findings.append(_finding("mood", "ok", f"Mood declared: {declared['mood']}."))
    else:
        findings.append(_finding("mood", "note", "No mood declared. Decide whether the tank is bright, lush, dark-mysterious, or minimal."))
    if declared and declared["story"].strip():
        findings.append(_finding("story", "ok", "Story declared: " + declared["story"].strip()))
    else:
        findings.append(_finding("story", "note", "No story declared. One sentence about what this tank is keeps later choices coherent."))

    # proportion
    ratio = measures["depth_to_width"]
    if ratio >= 0.4:
        findings.append(_finding("proportion", "ok", f"Depth is {ratio:.0%} of width; there is room for front, middle and back layers."))
    else:
        findings.append(_finding("proportion", "note", f"Depth is only {ratio:.0%} of width. Shallow tanks limit layering; keep the layout to two depth planes."))
    hardscape_bands = [name for name, band in measures["depth_bands"].items() if band["hardscape"]]
    if measures["hardscape_assets"]:
        if len(hardscape_bands) >= 2:
            findings.append(_finding("proportion", "ok", "Hardscape occupies " + " and ".join(hardscape_bands) + " depth bands."))
        else:
            findings.append(_finding("proportion", "note", "All hardscape sits in one depth band; stepping a piece forward or back adds depth."))
    top = measures["top_fraction_of_height"]
    if top < 0.35:
        findings.append(_finding("proportion", "note", f"Tallest object reaches {top:.0%} of the tank height; the layout will read flat unless minimal is the intent."))
    elif top <= 0.9:
        findings.append(_finding("proportion", "ok", f"Tallest object reaches {top:.0%} of the tank height."))

    # negative space and waterline
    if top > 0.97:
        findings.append(_finding("negative-space", "warn", f"Tallest object reaches {top:.0%} of the height and will break the waterline."))
    covered = measures["covered_fraction"]
    if covered > 0.85:
        findings.append(_finding("negative-space", "warn", f"{covered:.0%} of the floor is covered. There is no negative space left."))
    elif covered > 0.6:
        findings.append(_finding("negative-space", "note", f"{covered:.0%} of the floor is covered. Consider opening more sand or water."))
    else:
        findings.append(_finding("negative-space", "ok", f"{covered:.0%} of the floor is covered; negative space remains."))

    # maintenance
    proxy = infer_maintenance(measures)
    if declared:
        if declared["maintenance_tier"] == proxy:
            findings.append(_finding("maintenance", "ok", f"Declared maintenance tier {proxy} matches the planted footprint."))
        else:
            findings.append(_finding("maintenance", "warn",
                                     f"Declared maintenance tier {declared['maintenance_tier']} but {measures['planted_footprint_fraction']:.0%} planted floor and {measures['bush_count']} bush groups read as {proxy}."))
    else:
        findings.append(_finding("maintenance", "note", f"No tier declared. The planted footprint reads as {proxy} maintenance."))

    findings.sort(key=lambda item: (STATUS_ORDER[item["status"]], PRINCIPLE_IDS.index(item["principle"])))
    return findings


def review_recipe(recipe):
    """Return a JSON-serialisable review for a recipe that already passed validate_recipe."""
    cells = _raster(recipe)
    measures = _measures(recipe, cells)
    declared = recipe.get("design")
    findings = _findings(recipe, measures, declared)
    counts = {status: sum(item["status"] == status for item in findings) for status in STATUS_ORDER}
    return {
        "review_version": REVIEW_VERSION,
        "principles": [{"id": identifier, "title": title} for identifier, title, _ in PRINCIPLES],
        "declared_design": declared,
        "inferred_composition": infer_composition(measures),
        "inferred_maintenance": infer_maintenance(measures),
        "measures": measures,
        "findings": findings,
        "counts": counts,
        "disclaimer": "Geometric proxies from axis-aligned envelopes in a rectangular tank. Not a judgement of biology, water, growth, livestock, or the real materials' appearance.",
    }


def summarise(review, limit=6):
    """Short human lines, warnings first. For status panels and spoken explanations."""
    lines = []
    for item in review["findings"][:limit]:
        lines.append(f"[{item['status']}] {item['principle']}: {item['message']}")
    return lines


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if len(argv) != 1:
        print("usage: design_review.py RECIPE.json", file=sys.stderr)
        return 2
    try:
        recipe = load_recipe(argv[0])
    except RecipeError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print(json.dumps(review_recipe(recipe), indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
