"""Capture current unsaved native state; unsupported edits fail before inference.

The supported adapter is translation, yaw and positive scale on known,
unmodified procedural meshes. Protected objects are copied with their exact
mesh and world matrix when building a new scene, not re-fitted from an AABB.
"""
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import uuid

from frontier_contract import SNAPSHOT_VERSION, FrontierError, canonical_hash, exact, integer, unique_ids, load_json, digest
from scene_recipe import validate_recipe

SUPPRESS = False
BASELINE = "fishy_transform_baseline"
PROTECTED = "fishy_human_protected"
MESH_BASELINE = "fishy_mesh_baseline_sha256"


def mesh_digest(obj):
    return canonical_hash({"vertices": [[float(v) for v in vertex.co] for vertex in obj.data.vertices],
                           "edges": [list(edge.vertices) for edge in obj.data.edges],
                           "polygons": [list(face.vertices) for face in obj.data.polygons]})


def matrix_values(obj):
    return [[float(v) for v in row] for row in obj.matrix_world]


def object_state_hash(obj):
    return canonical_hash({"matrix": matrix_values(obj), "mesh": mesh_digest(obj)})


def initialize_object(obj):
    obj[MESH_BASELINE] = mesh_digest(obj)
    obj[BASELINE] = object_state_hash(obj)
    obj[PROTECTED] = False


def sync_protection(scene):
    if SUPPRESS:
        return
    for obj in scene.objects:
        if obj.type == "MESH" and "tank_id" in obj and BASELINE in obj:
            if not obj.get(PROTECTED, False) and object_state_hash(obj) != obj[BASELINE]:
                obj[PROTECTED] = True


def release_protection(obj):
    if obj.type != "MESH" or "tank_id" not in obj:
        raise FrontierError("Select one supported aquarium object")
    obj[BASELINE] = object_state_hash(obj)
    obj[PROTECTED] = False


def adapt_scene(context, *, flush=False):
    import bpy
    context.view_layer.update()
    scene = context.scene
    text = bpy.data.texts.get("FISHY_RECIPE.json")
    if text is None:
        raise FrontierError("Current-scene revision requires a recipe-generated tank")
    recipe = json.loads(text.as_string())
    validate_recipe(recipe)
    sync_protection(scene)
    objects = [obj for obj in scene.objects if obj.type == "MESH" and "tank_id" in obj]
    expected = {item["id"] for item in recipe["objects"]}
    if len(objects) != len(expected) or {obj["tank_id"] for obj in objects} != expected:
        raise FrontierError("Native object additions/deletions or duplicate IDs need an explicit adapter; revision stopped")
    fixed_baselines = json.loads(scene.get("fishy_fixed_mesh_baselines_json", "{}"))
    fixed_meshes = {obj.name: obj for obj in scene.objects if obj.type == "MESH" and "tank_id" not in obj}
    if not fixed_baselines or set(fixed_baselines) != set(fixed_meshes):
        raise FrontierError("Added/deleted native meshes or missing tank baseline are unsupported; revision stopped")
    if any(object_state_hash(fixed_meshes[name]) != fingerprint for name, fingerprint in fixed_baselines.items()):
        raise FrontierError("Native tank/studio mesh edits are unsupported; revision stopped")
    records, adapted = [], []
    for obj in objects:
        if MESH_BASELINE not in obj:
            raise FrontierError("This older scene has no verified mesh baseline. Rebuild its recipe once before native revisions.")
        if obj.parent or obj.constraints or obj.modifiers or obj.data.shape_keys or obj.animation_data:
            raise FrontierError(f"{obj.name}: parents, constraints, modifiers, shape keys and animation are unsupported")
        actual_mesh = mesh_digest(obj)
        if actual_mesh != obj[MESH_BASELINE]:
            raise FrontierError(f"{obj.name}: native topology/vertex edits are unsupported; no model request was sent")
        matrix = obj.matrix_world
        position, rotation, scale = matrix.decompose()
        if any(v <= 0 for v in scale):
            raise FrontierError(f"{obj.name}: negative/zero native scale is unsupported")
        rotation_matrix = rotation.to_matrix()
        if max(abs(rotation_matrix[2][0]), abs(rotation_matrix[2][1]), abs(rotation_matrix[0][2]), abs(rotation_matrix[1][2]), abs(rotation_matrix[2][2] - 1)) > 1e-6:
            raise FrontierError(f"{obj.name}: native tilt is unsupported; preserve the scene and remove tilt before revising")
        from mathutils import Matrix
        rebuilt = Matrix.LocRotScale(position, rotation, scale)
        if max(abs(matrix[row][col] - rebuilt[row][col]) for row in range(4) for col in range(4)) > 1e-6:
            raise FrontierError(f"{obj.name}: native shear is unsupported")
        original = json.loads(obj["fishy_recipe_item_json"])
        if original["id"] != obj["tank_id"] or original["asset"] != obj.get("fishy_recipe_asset") or original["seed"] != obj.get("fishy_recipe_seed"):
            raise FrontierError("Native procedural identity was changed without an adapter")
        lower = [min(v.co[axis] for v in obj.data.vertices) for axis in range(3)]
        upper = [max(v.co[axis] for v in obj.data.vertices) for axis in range(3)]
        size = [(upper[axis] - lower[axis]) * scale[axis] for axis in range(3)]
        if max(abs(lower[0] + (upper[0] - lower[0]) / 2), abs(lower[1] + (upper[1] - lower[1]) / 2), abs(lower[2])) > 1e-6:
            raise FrontierError(f"{obj.name}: native origin is not the supported base-centre")
        item = deepcopy(original)
        item.update(position_m=[float(v) for v in position], size_m=[float(v) for v in size],
                    yaw_deg=math.degrees(math.atan2(rotation_matrix[1][0], rotation_matrix[0][0])))
        # Preserve original recipe numbers when float32 noise is the only change.
        for field in ("position_m", "size_m"):
            if max(abs(a - b) for a, b in zip(item[field], original[field])) <= 1e-7:
                item[field] = deepcopy(original[field])
        if abs(item["yaw_deg"] - original["yaw_deg"]) <= 1e-5:
            item["yaw_deg"] = original["yaw_deg"]
        adapted.append(item)
        records.append({"id": obj["tank_id"], "name": obj.name, "meshHash": actual_mesh,
                        "matrix": matrix_values(obj), "protected": bool(obj.get(PROTECTED, False))})
    effective = deepcopy(recipe)
    effective["objects"] = sorted(adapted, key=lambda item: item["id"])
    for key in ("width_m", "depth_m", "height_m", "substrate_depth_m"):
        current = float(scene.get("fishy_" + key, recipe["tank"][key]))
        if abs(current - recipe["tank"][key]) > 1e-7:
            raise FrontierError("Native tank dimension metadata changed without its geometry adapter")
        effective["tank"][key] = current
    validate_recipe(effective)
    records.sort(key=lambda item: item["id"])
    state_hash = canonical_hash({"recipe": effective, "objects": records})
    scene_id = scene.get("fishy_scene_id") or "native-" + uuid.uuid4().hex
    revision = int(scene.get("fishy_revision", 0))
    if flush:
        previous_hash = scene.get("fishy_committed_state_hash")
        if previous_hash and previous_hash != state_hash:
            revision += 1
            log = json.loads(scene.get("fishy_edit_log_json", "[]"))
            log.append({"revision": revision, "source": "native_transform",
                        "objectIds": [item["id"] for item in records if item["protected"]],
                        "committedAt": datetime.now(timezone.utc).isoformat(), "stateHash": state_hash})
            scene["fishy_edit_log_json"] = json.dumps(log[-200:])
        scene["fishy_scene_id"] = scene_id
        scene["fishy_revision"] = revision
        scene["fishy_committed_state_hash"] = state_hash
    return {"schemaVersion": SNAPSHOT_VERSION, "sceneId": scene_id, "baseRevision": revision,
            "stateHash": state_hash, "recipe": effective, "objects": records,
            "protectedIds": [item["id"] for item in records if item["protected"]]}


def capture_scene(context, directory, *, edit_provenance="native_scene"):
    import bpy
    global SUPPRESS
    if edit_provenance not in ("native_scene", "scripted_transform_fixture"):
        raise FrontierError("Unknown native edit provenance")
    snapshot = adapt_scene(context, flush=True)
    source = Path(bpy.data.filepath).resolve() if bpy.data.filepath else None
    if source is None or not (source.parent / "manifest.json").is_file():
        raise FrontierError("Current scene must belong to a recorded run with reconstruction inputs")
    manifest = load_json(source.parent / "manifest.json")
    if manifest.get("status") != "complete":
        raise FrontierError("Current scene's source run is incomplete")
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=False)
    destination = directory / "current.blend"
    SUPPRESS = True
    try:
        bpy.ops.wm.save_as_mainfile(filepath=str(destination), copy=True, check_existing=True)
    finally:
        SUPPRESS = False
    snapshot.update(sourceRun=str(source.parent), blendPath="current.blend",
                    blendHash=hashlib.sha256(destination.read_bytes()).hexdigest(),
                    capturedAt=datetime.now(timezone.utc).isoformat(), editProvenance=edit_provenance)
    path = directory / "snapshot.json"
    path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2, allow_nan=False) + "\n")
    return path, snapshot


def validate_snapshot(value):
    exact(value, ("schemaVersion", "sceneId", "baseRevision", "stateHash", "recipe", "objects", "protectedIds", "sourceRun", "blendPath", "blendHash", "capturedAt"), ("editProvenance",), path="native snapshot")
    if value["schemaVersion"] != SNAPSHOT_VERSION:
        raise FrontierError("Unknown native snapshot version")
    if "editProvenance" in value and value["editProvenance"] not in ("native_scene", "scripted_transform_fixture"):
        raise FrontierError("Unknown native edit provenance")
    integer(value["baseRevision"], "snapshot revision")
    validate_recipe(value["recipe"])
    unique_ids(value["protectedIds"], "snapshot protected IDs", 24)
    digest(value["stateHash"])
    digest(value["blendHash"])
    if type(value["objects"]) is not list or len(value["objects"]) != len(value["recipe"]["objects"]):
        raise FrontierError("Snapshot object count differs from recipe")
    ids = set()
    for item in value["objects"]:
        exact(item, ("id", "name", "meshHash", "matrix", "protected"), path="native object")
        if item["id"] in ids or type(item["protected"]) is not bool:
            raise FrontierError("Duplicate/invalid native object")
        ids.add(item["id"])
        digest(item["meshHash"])
        matrix = item["matrix"]
        if type(matrix) is not list or len(matrix) != 4 or any(type(row) is not list or len(row) != 4 for row in matrix) or any(type(number) not in (int, float) or not math.isfinite(number) for row in matrix for number in row):
            raise FrontierError("Invalid native matrix")
    if ids != {item["id"] for item in value["recipe"]["objects"]} or set(value["protectedIds"]) != {item["id"] for item in value["objects"] if item["protected"]}:
        raise FrontierError("Native snapshot IDs/protection are inconsistent")
    if canonical_hash({"recipe": value["recipe"], "objects": value["objects"]}) != value["stateHash"]:
        raise FrontierError("Native snapshot state hash mismatch")
    return value
