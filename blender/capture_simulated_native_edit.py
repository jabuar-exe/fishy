"""Explicit scripted fixture: simulate an unsaved native transform, never a cursor action."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import fishy_controls
import native_snapshot


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    tail = sys.argv[sys.argv.index("--") + 1:]
    options = parser.parse_args(tail)
    fishy_controls.register()
    source = Path(bpy.data.filepath)
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    objects = {obj["tank_id"]: obj for obj in fishy_controls.fishy_objects(bpy.context.scene)}
    rock = objects["r3"]
    before_matrix = native_snapshot.matrix_values(rock)
    before_mesh = native_snapshot.mesh_digest(rock)
    rock.location.x += 0.01
    rock.rotation_euler.z += 0.035  # Approximately two degrees; remains inside the tank.
    bpy.context.view_layer.update()
    native_snapshot.sync_protection(bpy.context.scene)
    path, snapshot = native_snapshot.capture_scene(bpy.context, options.output,
                                                   edit_provenance="scripted_transform_fixture")
    native_snapshot.validate_snapshot(snapshot)
    assert snapshot["protectedIds"] == ["r3"], snapshot["protectedIds"]
    assert snapshot["baseRevision"] == 3, snapshot["baseRevision"]
    record = next(item for item in snapshot["objects"] if item["id"] == "r3")
    assert record["meshHash"] == before_mesh
    assert record["matrix"] != before_matrix
    assert Path(bpy.data.filepath) == source
    assert hashlib.sha256(source.read_bytes()).hexdigest() == source_hash
    provenance = {
        "description": "Scripted native transform simulating a manual edit; no cursor-authored native edit claimed.",
        "sourceBlend": str(source), "sourceBlendSha256": source_hash,
        "objectId": "r3", "translationDeltaM": [0.01, 0, 0], "yawDeltaRadians": 0.035,
        "beforeMatrix": before_matrix, "afterMatrix": record["matrix"],
        "meshSha256": before_mesh, "snapshotSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "sourceFileUnchanged": True, "nativeRevision": snapshot["baseRevision"],
    }
    (options.output / "scripted-edit-provenance.json").write_text(json.dumps(provenance, indent=2) + "\n")
    print("SCRIPTED_EDIT_SNAPSHOT=" + str(path))
    print("PROVENANCE=scripted native transform simulating a manual edit; no cursor-authored native edit claimed")
    print("VERIFIED=revision3; protected r3; unchanged mesh; changed matrix; original file unchanged")


if __name__ == "__main__":
    main()
