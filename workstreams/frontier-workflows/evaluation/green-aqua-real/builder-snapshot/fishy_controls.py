"""Fishy controls for Blender's native desktop viewport.

Run with ``blender aquarium.blend --python fishy_controls.py`` or from Blender's
Text Editor. The script registers a sidebar; it does not change preferences.
Scene coordinates are metres: +X right, +Y toward the back, +Z upward, with
the origin at the tank's front-left-bottom corner.
"""

import json
import math
from pathlib import Path
import sys
from collections import Counter
from datetime import datetime, timezone

import bpy
from bpy.props import StringProperty
from bpy_extras.io_utils import ExportHelper
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
import native_snapshot


TOLERANCE_M = 1e-6
REPORT_KEY = "fishy_bounds_report"
SCHEMA_VERSION = "fishy.blender.scene.v1"


def fishy_objects(scene):
    """Only tagged meshes in this scene are user-editable aquarium items."""
    return sorted(
        (
            obj
            for obj in scene.objects
            if obj.type == "MESH"
            and isinstance(obj.get("tank_id"), str)
            and bool(obj.get("tank_id"))
            and isinstance(obj.get("fishy_kind"), str)
        ),
        key=lambda obj: (obj["tank_id"], obj.name),
    )


def tank_dimensions(scene):
    values = {
        "width_m": float(scene.get("fishy_width_m", 0.6)),
        "depth_m": float(scene.get("fishy_depth_m", 0.3)),
        "height_m": float(scene.get("fishy_height_m", 0.36)),
    }
    if any(not math.isfinite(value) or value <= 0 for value in values.values()):
        raise ValueError("Tank dimensions must be finite positive values in metres.")
    return values


def world_bounds(obj, depsgraph=None):
    """World-space AABB, including evaluated modifier bounds when available."""
    source = obj.evaluated_get(depsgraph) if depsgraph is not None else obj
    corners = [source.matrix_world @ Vector(corner) for corner in source.bound_box]
    return {
        "min_m": [min(corner[axis] for corner in corners) for axis in range(3)],
        "max_m": [max(corner[axis] for corner in corners) for axis in range(3)],
    }


def crossed_boundaries(bounds, dimensions):
    result = []
    for axis, low_name, high_name, upper in (
        (0, "Left", "Right", dimensions["width_m"]),
        (1, "Front", "Back", dimensions["depth_m"]),
        (2, "Bottom", "Top", dimensions["height_m"]),
    ):
        if bounds["min_m"][axis] < -TOLERANCE_M:
            result.append(low_name)
        if bounds["max_m"][axis] > upper + TOLERANCE_M:
            result.append(high_name)
    return result


def scene_snapshot(context):
    """Capture current evaluated bounds and the state used by an explicit check."""
    dimensions = tank_dimensions(context.scene)
    depsgraph = context.evaluated_depsgraph_get()
    items = []
    for obj in fishy_objects(context.scene):
        bounds = world_bounds(obj, depsgraph)
        items.append(
            {
                "id": obj["tank_id"],
                "name": obj.name,
                "matrix_world": [[float(value) for value in row] for row in obj.matrix_world],
                "bounds": bounds,
                "crossed_boundaries": crossed_boundaries(bounds, dimensions),
            }
        )
    return {"tank": dimensions, "objects": items}


def snapshot_fingerprint(snapshot):
    # The last check stays visible only while the checked transforms and bounds
    # remain identical. Native gizmo movement never receives a silent rollback.
    return json.dumps(snapshot, sort_keys=True, separators=(",", ":"), allow_nan=False)


def active_fishy_object(context):
    obj = context.active_object
    if (
        context.mode == "OBJECT"
        and obj is not None
        and obj.select_get()
        and obj.type == "MESH"
        and isinstance(obj.get("tank_id"), str)
        and bool(obj.get("tank_id"))
        and isinstance(obj.get("fishy_kind"), str)
    ):
        return obj
    return None


def tag_viewports(context):
    for window in context.window_manager.windows:
        for area in window.screen.areas:
            if area.type == "VIEW_3D":
                area.tag_redraw()


class FISHY_OT_rotate_quarter_turn(bpy.types.Operator):
    bl_idname = "fishy.rotate_quarter_turn"
    bl_label = "Rotate 90°"
    bl_description = "Rotate the selected aquarium item 90 degrees around global Z; use native Undo to revert"
    bl_options = {"REGISTER", "UNDO"}

    @classmethod
    def poll(cls, context):
        return active_fishy_object(context) is not None

    def execute(self, context):
        obj = active_fishy_object(context)
        pivot = obj.matrix_world.translation.copy()
        obj.matrix_world = (
            Matrix.Translation(pivot)
            @ Matrix.Rotation(math.pi / 2, 4, "Z")
            @ Matrix.Translation(-pivot)
            @ obj.matrix_world
        )
        context.view_layer.update()
        tag_viewports(context)
        return {"FINISHED"}


class FISHY_OT_check_bounds(bpy.types.Operator):
    bl_idname = "fishy.check_bounds"
    bl_label = "Check Bounds"
    bl_description = "Check all tagged aquarium items against tank walls; this never moves or changes an item"

    @classmethod
    def poll(cls, context):
        if context.mode != "OBJECT":
            cls.poll_message_set("Return to Object Mode to check completed mesh edits.")
            return False
        return True

    def execute(self, context):
        context.view_layer.update()
        try:
            snapshot = scene_snapshot(context)
            report = {
                "checked_at_utc": datetime.now(timezone.utc).isoformat(),
                "fingerprint": snapshot_fingerprint(snapshot),
                "objects": snapshot["objects"],
            }
            context.scene[REPORT_KEY] = json.dumps(report, allow_nan=False)
        except (TypeError, ValueError, OverflowError) as exc:
            self.report({"ERROR"}, str(exc))
            return {"CANCELLED"}
        violations = [item for item in report["objects"] if item["crossed_boundaries"]]
        if not report["objects"]:
            self.report({"INFO"}, "No tagged aquarium items to check.")
        elif violations:
            self.report({"WARNING"}, f"{len(violations)} item(s) cross tank boundaries. See the Fishy sidebar.")
        else:
            self.report({"INFO"}, f"All {len(report['objects'])} item bounds are inside the tank.")
        tag_viewports(context)
        return {"FINISHED"}


def scene_document(context):
    """JSON uses world transforms, so it remains useful after native editing."""
    snapshot = scene_snapshot(context)
    objects = fishy_objects(context.scene)
    duplicate_ids = [item_id for item_id, count in Counter(obj["tank_id"] for obj in objects).items() if count > 1]
    if duplicate_ids:
        raise ValueError("Duplicate tank_id values; assign unique IDs before export: " + ", ".join(duplicate_ids))
    if not objects:
        raise ValueError("There are no tagged aquarium items to export.")
    records = []
    for obj, state in zip(objects, snapshot["objects"]):
        position, orientation, scale = obj.matrix_world.decompose()
        # obj.bound_box can already include modifiers even on the original
        # object. Read mesh vertices to export actual unmodified local bounds.
        if not obj.data.vertices:
            raise ValueError(f"{obj.name}: no base mesh vertices to export.")
        local_min = [min(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)]
        local_max = [max(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)]
        records.append(
            {
                "id": obj["tank_id"],
                "name": obj.name,
                "kind": obj["fishy_kind"],
                "position_m": list(position),
                "rotation_quaternion_wxyz": list(orientation),
                "scale_xyz": list(scale),
                "matrix_world_row_major": state["matrix_world"],
                "local_mesh_bounds_m": {"min_m": local_min, "max_m": local_max},
                "local_mesh_dimensions_m": [local_max[axis] - local_min[axis] for axis in range(3)],
                "world_aabb_m": state["bounds"],
                "world_aabb_dimensions_m": [
                    state["bounds"]["max_m"][axis] - state["bounds"]["min_m"][axis]
                    for axis in range(3)
                ],
                "crossed_boundaries": state["crossed_boundaries"],
            }
        )
    return {
        "schema": SCHEMA_VERSION,
        "exported_at_utc": datetime.now(timezone.utc).isoformat(),
        "units": "metres",
        "coordinate_system": {
            "origin": "tank front-left-bottom",
            "x": "right / width",
            "y": "back / depth",
            "z": "up / height",
        },
        "field_notes": {
            "position_m": "World position of the object's origin, not necessarily its geometric center.",
            "matrix_world_row_major": "Authoritative 4x4 local-to-world transform; translation is in metres. Preserves shear if present.",
            "rotation_quaternion_wxyz": "World orientation from matrix decomposition; quaternion component order is W, X, Y, Z.",
            "scale_xyz": "Dimensionless scale from world matrix decomposition; matrix is authoritative if shear is present.",
            "local_mesh_bounds_m": "Base-mesh bounding box in object-local coordinates before scale/rotation; does not serialize mesh topology.",
            "world_aabb_m": "Axis-aligned world bounds, including evaluated modifiers; these bounds drive tank-boundary checks.",
            "crossed_boundaries": "Geometric tank containment only; no object collision, equipment, livestock, or biological checks.",
        },
        "tank": snapshot["tank"],
        "bounds_tolerance_m": TOLERANCE_M,
        "objects": records,
    }


class FISHY_OT_export_scene(bpy.types.Operator, ExportHelper):
    bl_idname = "fishy.export_scene"
    bl_label = "Export Scene JSON"
    bl_description = "Save the current tank dimensions, item transforms, and geometry bounds as JSON"

    filename_ext = ".json"
    filter_glob: StringProperty(default="*.json", options={"HIDDEN"})

    @classmethod
    def poll(cls, context):
        if context.mode != "OBJECT":
            cls.poll_message_set("Return to Object Mode to export completed mesh edits.")
            return False
        return True

    def invoke(self, context, event):
        if not self.filepath:
            self.filepath = bpy.path.abspath("//fishy-scene.json")
        return ExportHelper.invoke(self, context, event)

    def execute(self, context):
        context.view_layer.update()
        try:
            document = scene_document(context)
            contents = json.dumps(document, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
            with open(self.filepath, "w", encoding="utf-8") as handle:
                handle.write(contents)
        except (OSError, TypeError, ValueError, OverflowError) as exc:
            self.report({"ERROR"}, f"Could not export scene: {exc}")
            return {"CANCELLED"}
        self.report({"INFO"}, f"Exported {len(document['objects'])} aquarium items.")
        return {"FINISHED"}


class FISHY_OT_release_protection(bpy.types.Operator):
    bl_idname = "fishy.release_protection"
    bl_label = "Release Human Protection"
    bl_description = "Explicitly allow future Astra proposals to change this object"
    bl_options = {"REGISTER", "UNDO"}

    @classmethod
    def poll(cls, context):
        return active_fishy_object(context) is not None

    def execute(self, context):
        native_snapshot.release_protection(active_fishy_object(context))
        self.report({"INFO"}, "Protection released; another manual edit protects the object again.")
        return {"FINISHED"}


def track_human_transforms(scene, depsgraph):
    # Coalesced protection flag; authoritative final transforms/log are flushed
    # synchronously when Revise Current Scene captures the unsaved snapshot.
    try:
        if not native_snapshot.SUPPRESS and any(update.is_updated_transform or update.is_updated_geometry for update in depsgraph.updates):
            native_snapshot.sync_protection(scene)
    except (ReferenceError, RuntimeError, ValueError):
        pass


track_human_transforms._fishy_native_protection = True


class FISHY_PT_viewport(bpy.types.Panel):
    bl_label = "Fishy Aquarium"
    bl_idname = "FISHY_PT_viewport"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "Fishy"

    def draw(self, context):
        layout = self.layout
        layout.use_property_split = False
        hints = layout.column(align=True)
        hints.label(text="Orbit: drag the top-right axis gizmo")
        hints.label(text="Pan: Shift + middle-mouse drag")
        hints.label(text="Zoom: scroll or pinch")
        hints.separator()
        hints.label(text="Select an item, then drag its arrows.")
        hints.label(text="Undo: Edit > Undo")
        views = layout.row(align=True)
        views.operator("view3d.view_axis", text="Front", icon="AXIS_FRONT").type = "FRONT"
        views.operator("view3d.view_axis", text="Top", icon="AXIS_TOP").type = "TOP"

        layout.separator()
        selection = layout.box()
        obj = active_fishy_object(context)
        selection.label(text="Selected item")
        if obj is None:
            selection.label(text="Select a tagged item in Object Mode.")
        else:
            selection.label(text=obj.name, icon="MESH_DATA")
            selection.label(text=f"Type: {obj['fishy_kind']}")
            if native_snapshot.MESH_BASELINE in obj:
                protected = bool(obj.get(native_snapshot.PROTECTED, False))
                selection.label(text="Human protected" if protected else "Astra may revise this item", icon="LOCKED" if protected else "UNLOCKED")
                if protected:
                    selection.operator("fishy.release_protection", icon="UNLOCKED")
        row = selection.row()
        row.enabled = obj is not None
        row.operator("fishy.rotate_quarter_turn", icon="DRIVER_ROTATIONAL_DIFFERENCE")

        layout.operator("fishy.check_bounds", icon="VIEWZOOM")
        status = layout.box()
        status.label(text="Tank boundary check")
        status.label(text="Run after moving or rotating items.")
        try:
            dimensions = tank_dimensions(context.scene)
            status.label(text=f"{dimensions['width_m'] * 100:g} × {dimensions['depth_m'] * 100:g} × {dimensions['height_m'] * 100:g} cm")
            if context.mode != "OBJECT":
                status.label(text="Return to Object Mode to check.", icon="INFO")
                layout.separator()
                layout.operator("fishy.export_scene", icon="EXPORT")
                return
            raw_report = context.scene.get(REPORT_KEY)
            if not raw_report:
                status.label(text="Not checked yet.", icon="INFO")
            else:
                report = json.loads(raw_report)
                if report.get("fingerprint") != snapshot_fingerprint(scene_snapshot(context)):
                    status.label(text="Scene changed. Run Check Bounds.", icon="INFO")
                else:
                    items = report.get("objects", [])
                    violations = [item for item in items if item["crossed_boundaries"]]
                    if not items:
                        status.label(text="No tagged items to check.", icon="INFO")
                    elif not violations:
                        status.label(text=f"{len(items)} items inside tank bounds.", icon="CHECKMARK")
                    else:
                        for item in violations:
                            row = status.column(align=True)
                            row.label(text=item["name"], icon="ERROR")
                            row.label(text="Crosses: " + ", ".join(item["crossed_boundaries"]))
        except (TypeError, ValueError, KeyError, OverflowError):
            status.label(text="Check tank dimensions and rerun.", icon="ERROR")
        layout.separator()
        layout.operator("fishy.export_scene", icon="EXPORT")


CLASSES = (
    FISHY_OT_rotate_quarter_turn,
    FISHY_OT_check_bounds,
    FISHY_OT_export_scene,
    FISHY_OT_release_protection,
    FISHY_PT_viewport,
)


def unregister():
    for handler in list(bpy.app.handlers.depsgraph_update_post):
        if getattr(handler, "_fishy_native_protection", False):
            bpy.app.handlers.depsgraph_update_post.remove(handler)
    # Resolve Blender's currently registered classes, not classes from this new
    # script execution, so repeated Run Script actions are safe.
    for cls in reversed(CLASSES):
        existing = getattr(bpy.types, cls.__name__, None)
        if existing is not None:
            bpy.utils.unregister_class(existing)


def register():
    unregister()
    for cls in CLASSES:
        bpy.utils.register_class(cls)
    bpy.app.handlers.depsgraph_update_post.append(track_human_transforms)


if __name__ == "__main__":
    register()
