"""Real Blender checks for current unsaved snapshots and protected native meshes.

--capture-dir captures supported unsaved edits and verifies unsupported edits
fail. --snapshot verifies a separately built effective result against its exact
protected mesh and matrix. Neither mode overwrites the input .blend.
"""
import argparse
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import sys

import bpy

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
import native_snapshot
import fishy_controls
from frontier_contract import FrontierError, accept_proposal, load_json, VERSION


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--capture-dir", type=Path)
    parser.add_argument("--snapshot", type=Path)
    tail = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    options = parser.parse_args(tail)
    fishy_controls.register()
    if options.snapshot:
        snapshot = native_snapshot.validate_snapshot(load_json(options.snapshot))
        objects = {obj["tank_id"]: obj for obj in fishy_controls.fishy_objects(bpy.context.scene)}
        assert set(objects) == {o["id"] for o in snapshot["objects"]}
        for record in snapshot["objects"]:
            if not record["protected"]:
                continue
            obj = objects[record["id"]]
            assert native_snapshot.mesh_digest(obj) == record["meshHash"], "Protected shape changed"
            assert native_snapshot.matrix_values(obj) == record["matrix"], "Protected world matrix changed"
            assert obj[native_snapshot.PROTECTED]
        rock = objects["rock-01"]
        prior = next(o for o in snapshot["recipe"]["objects"] if o["id"] == "rock-01")
        assert abs(rock.matrix_world.translation.x - prior["position_m"][0] - 0.01) < 1e-6, "Unprotected rock change was lost"
        print("PASS: protected native mesh/world matrix/stable IDs preserved exactly; unprotected rock changed")
        print("FISHY_NATIVE_PRESERVATION_CHECKS_PASSED=4")
        return
    if not options.capture_dir:
        raise ValueError("Supply --capture-dir or --snapshot")
    original_path = Path(bpy.data.filepath)
    original_hash = hashlib.sha256(original_path.read_bytes()).hexdigest()
    wood = next(obj for obj in fishy_controls.fishy_objects(bpy.context.scene) if obj["tank_id"] == "wood-01")
    original_mesh = native_snapshot.mesh_digest(wood)
    wood.location.x += 0.012
    wood.rotation_euler.z += 0.06
    wood.scale *= 1.05
    bpy.context.view_layer.update()
    native_snapshot.sync_protection(bpy.context.scene)
    assert wood[native_snapshot.PROTECTED], "Manual transform did not protect wood"
    path, snapshot = native_snapshot.capture_scene(bpy.context, options.capture_dir)
    assert Path(bpy.data.filepath) == original_path, "Saving a copy changed current file identity"
    assert hashlib.sha256(original_path.read_bytes()).hexdigest() == original_hash, "Source file was overwritten"
    captured = next(o for o in snapshot["objects"] if o["id"] == "wood-01")
    assert captured["matrix"] == native_snapshot.matrix_values(wood)
    assert captured["meshHash"] == original_mesh
    assert snapshot["protectedIds"] == ["wood-01"], snapshot["protectedIds"]
    assert snapshot["baseRevision"] == 1, snapshot["baseRevision"]
    wood.location.x += 0.002
    bpy.context.view_layer.update()
    assert native_snapshot.adapt_scene(bpy.context)["stateHash"] != snapshot["stateHash"], "Stale current scene was not detected"
    wood.location.x -= 0.002
    bpy.context.view_layer.update()
    for kind in ("topology", "tilt", "modifier"):
        if kind == "topology":
            original_vertex = wood.data.vertices[0].co.copy()
            wood.data.vertices[0].co.x += 0.001
        elif kind == "tilt":
            wood.rotation_euler.x += 0.1
        else:
            modifier = wood.modifiers.new("Unsupported test", "BEVEL")
        bpy.context.view_layer.update()
        try:
            native_snapshot.adapt_scene(bpy.context)
            raise AssertionError(kind + " silently accepted")
        except FrontierError:
            pass
        finally:
            if kind == "topology":
                wood.data.vertices[0].co = original_vertex
            elif kind == "tilt":
                wood.rotation_euler.x -= 0.1
            else:
                wood.modifiers.remove(modifier)
            bpy.context.view_layer.update()
    prior = snapshot["recipe"]
    proposal_recipe = deepcopy(prior)
    next(o for o in proposal_recipe["objects"] if o["id"] == "wood-01")["position_m"][0] = 10
    next(o for o in proposal_recipe["objects"] if o["id"] == "rock-01")["position_m"][0] += 0.01
    proposal = {"schemaVersion": VERSION, "baseRevision": snapshot["baseRevision"], "recipe": proposal_recipe,
                "objectEvidence": [{"objectId": obj["id"], "observationIds": [], "inferred": True, "note": "Native preservation protocol fixture"} for obj in prior["objects"]],
                "uncertainties": [], "resolutions": []}
    accepted = accept_proposal(proposal, previous=prior, base_revision=snapshot["baseRevision"], observations=[], protected_ids=snapshot["protectedIds"])
    accepted["sceneId"] = snapshot["sceneId"]
    manifest = {"run_id": "native-preservation-fixture", "created_at_utc": snapshot["capturedAt"], "status": "building", "source": "imported_recipe", "model_calls_attempted": 0,
                "protocol_fixture": True, "frontier": {k: v for k, v in accepted.items() if k != "recipe"}}
    for filename, value in (("raw-proposal.json", proposal), ("effective-recipe.json", accepted["recipe"]), ("effective-manifest.json", manifest)):
        (options.capture_dir / filename).write_text(json.dumps(value, indent=2) + "\n")
    print("PASS: unsaved translation/yaw/scale captured; protection automatic; source .blend unchanged")
    print("PASS: stale state detected; unsupported topology/tilt/modifier edits rejected before dispatch")
    print("PASS: attempted protected override preserved raw; effective merge retains protected wood and changes rock")
    print(f"FISHY_CURRENT_SNAPSHOT={path}")
    print("FISHY_NATIVE_SNAPSHOT_CHECKS_PASSED=9")


if __name__ == "__main__":
    main()
