"""Verify an actual model-built result against its exact captured native state."""
import argparse
import json
import math
from pathlib import Path
import sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import fishy_controls
import native_snapshot
from frontier_contract import load_json, validate_review
from scene_recipe import load_recipe


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot", required=True, type=Path)
    parser.add_argument("--run", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    options = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    snapshot = native_snapshot.validate_snapshot(load_json(options.snapshot))
    manifest = load_json(options.run / "manifest.json")
    review = validate_review(load_json(options.run / "frontier-review.json"))
    recipe = load_recipe(options.run / "recipe.json")
    raw = load_json(options.run / "raw-proposal.json")
    assert Path(bpy.data.filepath).resolve() == (options.run / "aquarium.blend").resolve()
    assert manifest["status"] == "complete" and manifest["source"] == "model_generated"
    assert manifest["model_calls_attempted"] == 1
    assert manifest["frontier"]["baseRevision"] == snapshot["baseRevision"]
    assert manifest["frontier"]["revision"] == snapshot["baseRevision"] + 1
    assert manifest["frontier"]["protection"]["protectedIds"] == snapshot["protectedIds"]
    objects = {obj["tank_id"]: obj for obj in fishy_controls.fishy_objects(bpy.context.scene)}
    assert set(objects) == {obj["id"] for obj in recipe["objects"]}
    before = {obj["id"]: obj for obj in snapshot["recipe"]["objects"]}
    after = {obj["id"]: obj for obj in recipe["objects"]}
    proposed = {obj["id"]: obj for obj in raw["recipe"]["objects"]}
    protected_results = []
    for record in snapshot["objects"]:
        if not record["protected"]:
            continue
        obj = objects[record["id"]]
        assert native_snapshot.mesh_digest(obj) == record["meshHash"]
        assert native_snapshot.matrix_values(obj) == record["matrix"]
        assert bool(obj[native_snapshot.PROTECTED])
        assert before[record["id"]] == after[record["id"]]
        attempted = proposed.get(record["id"]) != before[record["id"]]
        raw_object = proposed.get(record["id"])
        attempted_fields = ["deleted"] if raw_object is None else [key for key in before[record["id"]] if raw_object[key] != before[record["id"]][key]]
        blocked = any(item["objectId"] == record["id"] for item in review["protection"]["blockedAttempts"])
        assert attempted == blocked
        protected_results.append({"objectId": record["id"], "exactMeshPreserved": True,
                                  "exactWorldMatrixPreserved": True, "acceptedRecipePreserved": True,
                                  "rawOverrideAttempted": attempted, "overrideRecordedAsBlocked": blocked,
                                  "attemptedFields": attempted_fields,
                                  "rawPositionDeltaM": None if raw_object is None else math.dist(raw_object["position_m"], before[record["id"]]["position_m"])})
    request = next(item for item in review["requests"] if item["id"] == "request-r2-1")
    assert request["status"] in ("resolved_changed", "resolved_confirmed", "request_unresolved")
    answer = next(item for item in review["observations"] if item["id"] == request["answerObservationId"])
    assert answer["objectIds"] == ["r1"] and answer["view"] == "close_up"
    geometry_fields = ("asset", "position_m", "size_m", "yaw_deg", "seed")
    target_changed = any(before["r1"][field] != after["r1"][field] for field in geometry_fields)
    cited_changes = [item for item in review["changes"] if item["objectId"] == "r1" and answer["id"] in item["observationIds"]]
    if request["status"] == "resolved_changed":
        assert target_changed and cited_changes
    if request["status"] == "resolved_confirmed":
        assert not target_changed
    native_recipe = native_snapshot.adapt_scene(bpy.context)["recipe"]
    native_target = next(item for item in native_recipe["objects"] if item["id"] == "r1")
    for field in ("position_m", "size_m"):
        assert all(abs(actual - expected) <= 1e-6 for actual, expected in zip(native_target[field], after["r1"][field]))
    assert abs(native_target["yaw_deg"] - after["r1"]["yaw_deg"]) <= 1e-4
    result = {"runId": manifest["run_id"], "modelCalls": 1,
              "editProvenance": snapshot.get("editProvenance", "unspecified"),
              "description": "Actual model revision after a scripted native transform simulating a manual edit; no cursor-authored native edit claimed.",
              "baseRevision": snapshot["baseRevision"], "acceptedRevision": manifest["frontier"]["revision"],
              "protectedObjects": protected_results, "requestId": request["id"], "requestOutcome": request["status"],
              "answerObservationId": answer["id"], "answerSha256": answer["sha256"],
              "targetGeometryChanged": target_changed, "targetAnswerCitedInChange": bool(cited_changes),
              "targetNativeGeometryMatchesAcceptedRecipe": True, "targetNativeSizeM": native_target["size_m"],
              "acceptedChanges": len(review["changes"]), "evaluation": "Not evaluated; separate branch from sealed sequence"}
    with options.output.open("x") as stream:
        json.dump(result, stream, indent=2)
        stream.write("\n")
    print(json.dumps(result, indent=2))
    print("FISHY_NATIVE_MODEL_REVISION_VERIFIED=1")


if __name__ == "__main__":
    main()
