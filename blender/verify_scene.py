"""Runtime checks for the starter scene; modifies memory only, never saves it."""
import importlib.util
import json
from pathlib import Path
import tempfile

import bpy

root = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("fishy_controls", root / "fishy_controls.py")
controls = importlib.util.module_from_spec(spec)
spec.loader.exec_module(controls)
controls.register()
controls.register()

items = controls.fishy_objects(bpy.context.scene)
assert len(items) == 6, f"Expected six editable items, got {len(items)}"
assert len({obj["tank_id"] for obj in items}) == len(items)
snapshot = controls.scene_snapshot(bpy.context)
assert all(not item["crossed_boundaries"] for item in snapshot["objects"]), snapshot
print("PASS: all six identified editable objects begin within the tank")
print("PASS: controls register idempotently")

wood = next(obj for obj in items if obj["tank_id"] == "wood-01")
original = wood.matrix_world.copy()
others = {obj["tank_id"]: obj.matrix_world.copy() for obj in items if obj != wood}
bpy.ops.object.select_all(action="DESELECT")
wood.select_set(True)
bpy.context.view_layer.objects.active = wood
assert bpy.ops.fishy.rotate_quarter_turn() == {"FINISHED"}
assert wood.matrix_world != original
assert all(obj.matrix_world == others[obj["tank_id"]] for obj in items if obj != wood)
wood.matrix_world = original
bpy.context.view_layer.update()
print("PASS: quarter-turn rotates the selected item without changing other items")

bpy.ops.fishy.check_bounds()
report = json.loads(bpy.context.scene[controls.REPORT_KEY])
assert report["fingerprint"] == controls.snapshot_fingerprint(controls.scene_snapshot(bpy.context))
wood.location.x += 1
bpy.context.view_layer.update()
assert report["fingerprint"] != controls.snapshot_fingerprint(controls.scene_snapshot(bpy.context))
before_check = wood.matrix_world.copy()
bpy.ops.fishy.check_bounds()
report = json.loads(bpy.context.scene[controls.REPORT_KEY])
violation = next(item for item in report["objects"] if item["id"] == "wood-01")
assert "Right" in violation["crossed_boundaries"]
assert wood.matrix_world == before_check
wood.matrix_world = original
bpy.context.view_layer.update()
print("PASS: moved scene marks the prior check stale and reports Right boundary without changing transforms")

dimensions = controls.tank_dimensions(bpy.context.scene)
assert controls.crossed_boundaries({"min_m": [0, 0, 0], "max_m": [0.6, 0.3, 0.36]}, dimensions) == []
assert controls.crossed_boundaries({"min_m": [-0.01, 0, 0], "max_m": [0.2, 0.3, 0.36]}, dimensions) == ["Left"]
print("PASS: exact boundary contact passes and a crossed boundary fails")

with tempfile.TemporaryDirectory(prefix="fishy-check-") as directory:
    output = Path(directory) / "scene.json"
    assert bpy.ops.fishy.export_scene(filepath=str(output)) == {"FINISHED"}
    document = json.loads(output.read_text())
    assert document["units"] == "metres"
    assert document["coordinate_system"]["z"] == "up / height"
    assert len(document["objects"]) == 6
    assert all(not obj["crossed_boundaries"] for obj in document["objects"])
print("PASS: JSON export contains current transforms, six objects and explicit metre/Z-up conventions")
print("FISHY_RUNTIME_CHECKS_PASSED=6")
print("Native viewport navigation and Undo require interactive verification.")
