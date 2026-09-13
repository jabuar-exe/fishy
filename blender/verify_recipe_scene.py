"""Verify a recipe-built .blend in an isolated background process; never saves it."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import sys

import bpy


ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import fishy_controls as controls
from scene_recipe import load_recipe, recipe_bounds, validate_recipe


TOLERANCE_M = 1e-6


def near(actual, expected, label):
    if abs(actual - expected) > TOLERANCE_M:
        raise AssertionError(f"{label}: expected {expected:g}, found {actual:g}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--recipe", type=Path, help="Independent input recipe; otherwise validate the embedded recipe.")
    tail = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    options = parser.parse_args(tail)
    scene = bpy.context.scene
    text = bpy.data.texts.get("FISHY_RECIPE.json")
    assert text is not None, "The full recipe must be embedded in the .blend."
    embedded = json.loads(text.as_string())
    validate_recipe(embedded)
    recipe = load_recipe(options.recipe) if options.recipe else embedded
    assert embedded == recipe, "Embedded recipe does not match independently supplied input."
    assert scene.get("fishy_scene_source") == "Recipe-generated editable approximation"
    assert scene.get("fishy_recipe_schema") == recipe["schema_version"]
    assert scene.get("fishy_interpretation") == recipe["interpretation"]
    assert json.loads(scene["fishy_assumptions_json"]) == recipe["assumptions"]
    for dimension in ("width", "depth", "height"):
        near(scene[f"fishy_{dimension}_m"], recipe["tank"][f"{dimension}_m"], f"tank {dimension}")
    near(scene["fishy_substrate_depth_m"], recipe["tank"]["substrate_depth_m"], "substrate depth")
    near(scene.unit_settings.scale_length, 1.0, "metre unit scale")
    items = controls.fishy_objects(scene)
    assert len(items) == len(recipe["objects"]), "Unexpected objects were inherited or omitted."
    expected_ids = {item["id"] for item in recipe["objects"]}
    assert len({obj["tank_id"] for obj in items}) == len(items), "Stable IDs must be unique."
    assert {obj["tank_id"] for obj in items} == expected_ids, "Scene IDs differ from this recipe."
    editable = bpy.data.collections.get("02 · Recipe aquascape")
    assert editable is not None and set(editable.objects) == set(items), "Editable collection contains unrelated fixture geometry."
    snapshot = controls.scene_snapshot(bpy.context)
    kinds = {"rock": "rock", "branchwood": "wood", "grass": "plant", "bush": "plant"}
    for item in recipe["objects"]:
        obj = next(obj for obj in items if obj["tank_id"] == item["id"])
        assert obj["fishy_kind"] == kinds[item["asset"]]
        assert obj["fishy_recipe_asset"] == item["asset"]
        assert obj["fishy_recipe_seed"] == item["seed"]
        assert json.loads(obj["fishy_recipe_item_json"]) == item
        assert len(obj.data.vertices) > 0
        assert tuple(obj.lock_location) == (False, False, True)
        assert tuple(obj.lock_rotation) == (True, True, False)
        for axis in range(3):
            near(obj.matrix_world.translation[axis], item["position_m"][axis], f"{item['id']} origin {axis}")
            low = min(vertex.co[axis] for vertex in obj.data.vertices)
            high = max(vertex.co[axis] for vertex in obj.data.vertices)
            expected_low = -item["size_m"][axis] / 2 if axis < 2 else 0
            near(low, expected_low, f"{item['id']} base mesh minimum {axis}")
            near(high - low, item["size_m"][axis], f"{item['id']} pre-yaw size {axis}")
            near(obj.scale[axis], 1.0, f"{item['id']} applied scale {axis}")
        angle = math.radians(item["yaw_deg"])
        for actual, expected, label in (
            (obj.matrix_world[0][0], math.cos(angle), "rotation xx"),
            (obj.matrix_world[0][1], -math.sin(angle), "rotation xy"),
            (obj.matrix_world[1][0], math.sin(angle), "rotation yx"),
            (obj.matrix_world[1][1], math.cos(angle), "rotation yy"),
            (obj.matrix_world[2][2], 1.0, "rotation zz"),
        ):
            near(actual, expected, f"{item['id']} {label}")
        actual_bounds = next(record for record in snapshot["objects"] if record["id"] == item["id"])
        expected_bounds = recipe_bounds(item)
        assert not actual_bounds["crossed_boundaries"], f"{item['id']} crosses a tank boundary."
        for edge in ("min_m", "max_m"):
            for axis in range(3):
                near(actual_bounds["bounds"][edge][axis], expected_bounds[edge][axis], f"{item['id']} evaluated {edge} {axis}")
        assert actual_bounds["bounds"]["min_m"][2] >= recipe["tank"]["substrate_depth_m"] - TOLERANCE_M
    print("PASS: independently supplied and embedded recipes match" if options.recipe else "PASS: embedded recipe passes schema and geometry validation (no independent input supplied)")
    print("PASS: tank dimensions, metre units and provenance label match recipe")
    print("PASS: exact object IDs and editable collection contain only this recipe's assets")
    print("PASS: every actual base mesh fits its requested dimensions and base-center origin")
    print("PASS: every yaw/world transform and evaluated envelope matches the recipe")
    print("PASS: all object envelopes fit the tank and begin at or above the substrate")
    print(f"FISHY_RECIPE_VERIFIED_OBJECTS={len(items)}")
    print("FISHY_RECIPE_RUNTIME_CHECKS_PASSED=6")


if __name__ == "__main__":
    main()
