"""Bounded native evidence/revision protocol; no model, Blender or network calls.

Recipe v1/v2 stay independent. Model proposals cannot assign scene identity,
accepted revision, protection, evaluation policy or observation registration.
"""
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re

from scene_recipe import RecipeError, recipe_schema, validate_recipe, _unique_pairs, _invalid_constant

VERSION = "fishy.frontier.proposal.v1"
REVIEW_VERSION = "fishy.frontier.review.v1"
SNAPSHOT_VERSION = "fishy.native.snapshot.v1"
VIEWS = ("front", "left", "right", "top", "overview", "close_up")
REQUEST_VIEWS = ("front", "left", "right", "top", "close_up")
HASH = re.compile(r"[0-9a-f]{64}\Z")
IDENTIFIER = re.compile(r"[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,99}\Z")


class FrontierError(ValueError):
    pass


def canonical_hash(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode()).hexdigest()


def load_json(path, limit=1024 * 1024):
    with Path(path).open("rb") as handle:
        raw = handle.read(limit + 1)
    if len(raw) > limit:
        raise FrontierError("JSON exceeds its bounded file limit")
    try:
        return json.loads(raw.decode("utf-8"), object_pairs_hook=_unique_pairs, parse_constant=_invalid_constant)
    except (ValueError, UnicodeError, RecursionError) as exc:
        raise FrontierError(f"Invalid strict JSON: {exc}") from exc


def exact(value, required, optional=(), path="value"):
    if type(value) is not dict or set(value) - set(required) - set(optional) or set(required) - set(value):
        raise FrontierError(f"{path} has missing, unknown or invalid fields")


def text(value, path, limit=2000, nonempty=True):
    if type(value) is not str or len(value) > limit or (nonempty and not value.strip()):
        raise FrontierError(f"{path} must be bounded text")


def identifier(value, path="id"):
    if type(value) is not str or not IDENTIFIER.fullmatch(value):
        raise FrontierError(f"Invalid {path}")


def digest(value, path="sha256"):
    if type(value) is not str or not HASH.fullmatch(value):
        raise FrontierError(f"Invalid {path}")


def integer(value, path, minimum=0):
    if type(value) is not int or not minimum <= value <= 2 ** 31 - 1:
        raise FrontierError(f"Invalid {path}")


def unique_ids(values, path, limit=32):
    if type(values) is not list or len(values) > limit:
        raise FrontierError(f"{path} must be a bounded array")
    for value in values:
        identifier(value, path)
    if len(values) != len(set(values)):
        raise FrontierError(f"Duplicate {path}")


def validate_observations(values, previous=()):
    if type(values) is not list or len(values) > 20:
        raise FrontierError("At most 20 observations are supported")
    old = {item["id"]: item for item in previous}
    seen = set()
    for obs in values:
        exact(obs, ("id", "view", "role", "sha256", "note", "objectIds"), ("region",), "observation")
        identifier(obs["id"])
        if obs["id"] in seen:
            raise FrontierError("Duplicate observation ID")
        seen.add(obs["id"])
        if obs["role"] != "reconstruction" or obs["view"] not in VIEWS:
            raise FrontierError("Observation must be a reconstruction view")
        digest(obs["sha256"])
        text(obs["note"], "observation.note", nonempty=False)
        unique_ids(obs["objectIds"], "observation.objectIds", 24)
        if "region" in obs:
            region = obs["region"]
            if type(region) is not list or len(region) != 4 or any(type(v) not in (int, float) or not math.isfinite(v) for v in region):
                raise FrontierError("Invalid observation region")
            if not 0 <= region[0] < region[2] <= 1 or not 0 <= region[1] < region[3] <= 1:
                raise FrontierError("Observation region must be normalized and ordered")
        if obs["id"] in old and obs != old[obs["id"]]:
            raise FrontierError("An immutable observation ID was redefined")
    return values


def register_observation(observations, record, view, object_ids=(), note="Registered reconstruction image"):
    """Content-derived observation identity; registration happens in trusted code."""
    validate_observations(observations)
    if view not in VIEWS:
        raise FrontierError("Unsupported reconstruction view")
    digest(record["sha256"])
    obs = {"id": record.get("observation_id", "obs-" + record["sha256"][:24]), "view": view,
           "role": "reconstruction", "sha256": record["sha256"], "note": note, "objectIds": list(object_ids)}
    candidate = [*observations, obs]
    validate_observations(candidate, observations)
    return obs


def validate_requests(requests, observations, object_ids=None, changes=()):
    if type(requests) is not list or len(requests) > 2:
        raise FrontierError("At most two requests are supported")
    obs_by_id = {item["id"]: item for item in observations}
    seen = set()
    for request in requests:
        exact(request, ("id", "objectId", "question", "requestedView", "why", "status"), ("answerObservationId",), "request")
        identifier(request["id"])
        identifier(request["objectId"])
        if request["id"] in seen:
            raise FrontierError("Duplicate request ID")
        seen.add(request["id"])
        if object_ids is not None and request["objectId"] not in object_ids:
            raise FrontierError("Request names an unknown object")
        text(request["question"], "request.question")
        text(request["why"], "request.why")
        if request["requestedView"] not in REQUEST_VIEWS or request["status"] not in ("requested", "answered", "resolved_changed", "resolved_confirmed", "request_unresolved"):
            raise FrontierError("Invalid request view/status")
        answer = request.get("answerObservationId")
        if request["status"] == "requested" and answer is not None:
            raise FrontierError("An unanswered request cannot already cite an answer")
        if answer is not None:
            if answer not in obs_by_id:
                raise FrontierError("Unknown answer observation")
            observation = obs_by_id[answer]
            if observation["view"] != request["requestedView"] or request["objectId"] not in observation["objectIds"]:
                raise FrontierError("Answer view/object does not match its request")
        if request["status"] in ("answered", "resolved_changed", "resolved_confirmed") and answer is None:
            raise FrontierError("Answered/resolved request needs a registered answer")
        actual = [c for c in changes if c["objectId"] == request["objectId"]]
        if request["status"] == "resolved_changed" and not any(answer in c["observationIds"] for c in actual):
            raise FrontierError("Resolved change needs actual same-object change and answer citation")
        if request["status"] == "resolved_confirmed" and actual:
            raise FrontierError("Confirmed request cannot conceal a same-object geometry change")
    return requests


def answer_request(requests, observations, request_id, record, view):
    """Bind a selected photo to exactly one existing pending request."""
    current = deepcopy(requests)
    target = next((r for r in current if r["id"] == request_id), None)
    if target is None or target["status"] not in ("requested", "request_unresolved"):
        raise FrontierError("Answer must target an existing unanswered photo request")
    if target["requestedView"] != view:
        raise FrontierError("Answer view must match the requested view")
    obs = register_observation(observations, record, view, [target["objectId"]], "Answer to " + request_id)
    target["status"] = "answered"
    target["answerObservationId"] = obs["id"]
    registered = [*deepcopy(observations), obs]
    validate_requests(current, registered)
    return current, registered, obs


def _schema_object(properties):
    return {"type": "object", "additionalProperties": False, "required": list(properties), "properties": properties}


def proposal_schema():
    prose = {"type": "string", "maxLength": 2000}
    ident = {"type": "string", "maxLength": 100}
    citations = {"type": "array", "maxItems": 20, "items": ident}
    recipe = recipe_schema()
    recipe.pop("$schema", None)
    recipe["properties"]["objects"]["minItems"] = 0
    # Model output remains structurally bounded; effective geometry is checked after protection merge.
    return _schema_object({
        "schemaVersion": {"type": "string", "const": VERSION},
        "baseRevision": {"type": "integer", "minimum": 0},
        "recipe": recipe,
        "objectEvidence": {"type": "array", "maxItems": 24, "items": _schema_object({"objectId": ident, "observationIds": citations, "inferred": {"type": "boolean"}, "note": prose})},
        "uncertainties": {"type": "array", "maxItems": 2, "items": _schema_object({"objectId": ident, "question": prose, "requestedView": {"type": "string", "enum": list(REQUEST_VIEWS)}, "why": prose})},
        "resolutions": {"type": "array", "maxItems": 2, "items": _schema_object({"requestId": ident, "status": {"type": "string", "enum": ["resolved_changed", "resolved_confirmed", "request_unresolved"]}, "explanation": prose, "observationIds": citations})},
    })


def recipe_changes(previous, accepted, evidence):
    before = {obj["id"]: obj for obj in (previous or {}).get("objects", [])}
    after = {obj["id"]: obj for obj in accepted["objects"]}
    citations = {item["objectId"]: item["observationIds"] for item in evidence}
    inferred = {item["objectId"]: item["inferred"] for item in evidence}
    result = []
    for object_id in sorted(set(before) | set(after)):
        if before.get(object_id) == after.get(object_id):
            continue
        if object_id not in before:
            summary = "Added native object"
        elif object_id not in after:
            summary = "Removed native object"
        else:
            fields = [field for field in after[object_id] if before[object_id].get(field) != after[object_id][field]]
            summary = "Changed " + ", ".join(fields)
            if "position_m" in fields:
                displacement = math.dist(before[object_id]["position_m"], after[object_id]["position_m"]) * 100
                summary += f"; base-centre displacement {displacement:.3f} cm"
        change = {"objectId": object_id, "summary": summary, "observationIds": citations.get(object_id, [])}
        if not change["observationIds"]:
            if not inferred.get(object_id):
                raise FrontierError("An uncited change must have explicit inferred object evidence")
            change["inferred"] = True
        result.append(change)
    return result


def accept_proposal(proposal, *, previous, base_revision, observations, requests=(), protected_ids=()):
    exact(proposal, ("schemaVersion", "baseRevision", "recipe", "objectEvidence", "uncertainties", "resolutions"), path="proposal")
    if proposal["schemaVersion"] != VERSION or proposal["baseRevision"] != base_revision:
        raise FrontierError("Unknown proposal version or stale base revision")
    integer(proposal["baseRevision"], "proposal.baseRevision")
    validate_observations(observations)
    raw_recipe = proposal["recipe"]
    validate_recipe(raw_recipe, expected_tank=previous["tank"] if previous else None, geometry=False)
    old = {item["id"]: item for item in (previous or {}).get("objects", [])}
    unique_ids(list(protected_ids), "protectedIds", 24)
    if any(item not in old for item in protected_ids):
        raise FrontierError("Protected object is absent from authoritative current scene")
    effective = deepcopy(raw_recipe)
    proposed = {item["id"]: item for item in raw_recipe["objects"]}
    blocked = []
    for object_id in protected_ids:
        attempted = proposed.get(object_id)
        fields = ["deleted"] if attempted is None else [key for key in old[object_id] if attempted[key] != old[object_id][key]]
        if fields:
            blocked.append({"objectId": object_id, "fields": fields, "reason": "Current native scene protects this object; trusted state preserved."})
        effective["objects"] = [item for item in effective["objects"] if item["id"] != object_id]
        effective["objects"].append(deepcopy(old[object_id]))
    validate_recipe(effective, expected_tank=previous["tank"] if previous else None)
    ids = {obj["id"] for obj in effective["objects"]}
    allowed_evidence_ids = ids | set(old)
    obs_ids = {obs["id"] for obs in observations}
    obs_by_id = {obs["id"]: obs for obs in observations}
    evidence = proposal["objectEvidence"]
    if type(evidence) is not list or len(evidence) > 24:
        raise FrontierError("Object evidence exceeds its bound")
    seen = set()
    for item in evidence:
        exact(item, ("objectId", "observationIds", "inferred", "note"), path="object evidence")
        if item["objectId"] not in allowed_evidence_ids or item["objectId"] in seen:
            raise FrontierError("Unknown/duplicate evidence object")
        seen.add(item["objectId"])
        unique_ids(item["observationIds"], "evidence citations", 20)
        if set(item["observationIds"]) - obs_ids:
            raise FrontierError("Unknown reconstruction citation")
        if any(obs_by_id[citation]["objectIds"] and item["objectId"] not in obs_by_id[citation]["objectIds"] for citation in item["observationIds"]):
            raise FrontierError("Object evidence cites an observation assigned to a different object")
        if type(item["inferred"]) is not bool or (not item["observationIds"] and not item["inferred"]):
            raise FrontierError("Uncited geometry must be explicitly inferred")
        text(item["note"], "evidence.note", nonempty=False)
    if ids - seen:
        raise FrontierError("Every effective object needs explicit evidence or inference")
    changes = recipe_changes(previous, effective, evidence)
    # Resolved requests remain in their immutable historical run; this review
    # carries active requests only, so old outcomes never claim a new diff.
    updated = deepcopy([r for r in requests if r["status"] not in ("resolved_changed", "resolved_confirmed")])
    validate_requests(updated, observations)
    resolutions = proposal["resolutions"]
    if type(resolutions) is not list or len(resolutions) > 2:
        raise FrontierError("At most two resolutions are supported")
    resolved = set()
    for item in resolutions:
        exact(item, ("requestId", "status", "explanation", "observationIds"), path="resolution")
        target = next((r for r in updated if r["id"] == item["requestId"]), None)
        if target is None or target["status"] != "answered" or item["requestId"] in resolved:
            raise FrontierError("Resolution must target one answered request")
        resolved.add(item["requestId"])
        unique_ids(item["observationIds"], "resolution citations", 20)
        if set(item["observationIds"]) - obs_ids or target["answerObservationId"] not in item["observationIds"]:
            raise FrontierError("Resolution must cite its registered answer")
        if item["status"] not in ("resolved_changed", "resolved_confirmed", "request_unresolved"):
            raise FrontierError("Invalid resolution outcome")
        text(item["explanation"], "resolution explanation")
        target["status"], target["why"] = item["status"], item["explanation"]
    for target in updated:
        if target["status"] == "answered":
            target["status"] = "request_unresolved"
            target["why"] = "A photo was registered, but no cited resolution was returned."
    uncertainties = proposal["uncertainties"]
    if type(uncertainties) is not list or len(uncertainties) > 2:
        raise FrontierError("At most two named-object uncertainties are supported")
    if len(updated) + len(uncertainties) > 2:
        raise FrontierError("At most two requests may be carried in one review artifact")
    for index, item in enumerate(uncertainties):
        exact(item, ("objectId", "question", "requestedView", "why"), path="uncertainty")
        updated.append({"id": f"request-r{base_revision + 1}-{index + 1}", **item, "status": "requested"})
    validate_requests(updated, observations, ids, changes)
    return {"recipe": effective, "baseRevision": base_revision, "revision": base_revision + 1,
            "observations": deepcopy(observations), "requests": updated, "changes": changes,
            "objectEvidence": deepcopy(evidence), "protection": {"protectedIds": list(protected_ids), "blockedAttempts": blocked}}


def review_artifact(manifest, evaluation=None):
    """Export authority from a completed native manifest, never from model fields."""
    if manifest.get("status") != "complete" or "frontier" not in manifest:
        raise FrontierError("Review export requires a completed frontier run")
    state = manifest["frontier"]
    provenance = "recorded_model_run" if manifest.get("source") == "model_generated" and manifest.get("model_calls_attempted") == 1 else "imported_run"
    if manifest.get("protocol_fixture") is True:
        provenance = "protocol_fixture"
    artifact = {"schemaVersion": REVIEW_VERSION, "provenance": provenance,
                "run": {"id": manifest["run_id"], "runtime": "blender", "builder": "fishy-native-recipe-v2",
                        "sceneId": state["sceneId"], "baseRevision": state["baseRevision"], "revision": state["revision"], "createdAt": manifest["created_at_utc"]},
                "observations": state["observations"], "requests": state["requests"], "changes": state["changes"],
                "protection": state["protection"], "evaluation": evaluation, "browserProposal": None}
    validate_review(artifact)
    return artifact


def validate_review(value):
    exact(value, ("schemaVersion", "provenance", "run", "observations", "requests", "changes", "protection", "evaluation", "browserProposal"), path="review")
    if value["schemaVersion"] != REVIEW_VERSION or value["provenance"] not in ("protocol_fixture", "recorded_model_run", "imported_run"):
        raise FrontierError("Unknown review version/provenance")
    run = value["run"]
    exact(run, ("id", "runtime", "builder", "sceneId", "baseRevision", "revision", "createdAt"), path="run")
    for key in ("id", "sceneId"):
        identifier(run[key], key)
    if run["runtime"] != "blender" or run["builder"] != "fishy-native-recipe-v2" or value["browserProposal"] is not None:
        raise FrontierError("Native artifacts are view-only and cannot apply browser geometry")
    integer(run["baseRevision"], "baseRevision")
    integer(run["revision"], "revision")
    if run["revision"] != run["baseRevision"] + 1:
        raise FrontierError("Accepted revision must follow its base")
    text(run["createdAt"], "createdAt", 100)
    validate_observations(value["observations"])
    observations = {item["id"] for item in value["observations"]}
    obs_by_id = {item["id"]: item for item in value["observations"]}
    changes = value["changes"]
    if type(changes) is not list or len(changes) > 32:
        raise FrontierError("Too many review changes")
    seen = set()
    for change in changes:
        exact(change, ("objectId", "summary", "observationIds"), ("inferred",), path="change")
        if "inferred" in change and change["inferred"] is not True:
            raise FrontierError("Optional inferred marker must explicitly be true")
        identifier(change["objectId"])
        if change["objectId"] in seen:
            raise FrontierError("Duplicate change object")
        seen.add(change["objectId"])
        text(change["summary"], "change.summary")
        unique_ids(change["observationIds"], "change citations", 20)
        if not change["observationIds"] and change.get("inferred") is not True:
            raise FrontierError("Uncited review change must be marked as inference")
        if set(change["observationIds"]) - observations:
            raise FrontierError("Unknown change citation")
        if any(obs_by_id[citation]["objectIds"] and change["objectId"] not in obs_by_id[citation]["objectIds"] for citation in change["observationIds"]):
            raise FrontierError("Change cites an observation assigned to a different object")
    validate_requests(value["requests"], value["observations"], changes=changes)
    protection = value["protection"]
    exact(protection, ("protectedIds", "blockedAttempts"), path="protection")
    unique_ids(protection["protectedIds"], "protectedIds")
    if type(protection["blockedAttempts"]) is not list or len(protection["blockedAttempts"]) > 64:
        raise FrontierError("Too many blocked attempts")
    for attempt in protection["blockedAttempts"]:
        exact(attempt, ("objectId", "fields", "reason"), path="blocked attempt")
        if attempt["objectId"] not in protection["protectedIds"]:
            raise FrontierError("Blocked attempt must name a protected object")
        unique_ids(attempt["fields"], "blocked fields", 16)
        text(attempt["reason"], "blocked reason")
    if value["evaluation"] is not None:
        evaluation = value["evaluation"]
        exact(evaluation, ("seriesId", "runtime", "builder", "builderHash", "cameraHash", "photoHash", "maskHash", "policy", "status", "note", "scores"), path="evaluation")
        identifier(evaluation["seriesId"])
        if evaluation["runtime"] != "blender" or evaluation["builder"] != run["builder"] or evaluation["policy"] not in ("strict_test", "validation", "fixture") or evaluation["status"] not in ("complete", "pending"):
            raise FrontierError("Invalid native evaluation identity")
        for key in ("builderHash", "cameraHash", "photoHash", "maskHash"):
            digest(evaluation[key], key)
        text(evaluation["note"], "evaluation.note", nonempty=False)
        if type(evaluation["scores"]) is not list or len(evaluation["scores"]) > 40:
            raise FrontierError("Too many scores")
        if evaluation["status"] == "complete" and not evaluation["scores"]:
            raise FrontierError("Complete evaluation needs scores")
        if value["provenance"] == "protocol_fixture" and evaluation["policy"] != "fixture":
            raise FrontierError("Fixture provenance requires fixture evaluation policy")
        revisions = set()
        previous_revision = -1
        for score in evaluation["scores"]:
            exact(score, ("revision", "recipeHash", "iou", "ssim", "centroidErrorPx"), ("renderHash",), path="score")
            if "renderHash" in score:
                digest(score["renderHash"], "renderHash")
            integer(score["revision"], "score revision")
            if score["revision"] <= previous_revision or score["revision"] > run["revision"]:
                raise FrontierError("Evaluation scores must ascend and cannot describe future revisions")
            previous_revision = score["revision"]
            if score["revision"] in revisions:
                raise FrontierError("Duplicate score revision")
            revisions.add(score["revision"])
            digest(score["recipeHash"], "recipeHash")
            for key, low, high, nullable in (("iou", 0, 1, False), ("ssim", -1, 1, True), ("centroidErrorPx", 0, math.inf, True)):
                number = score[key]
                if number is None and nullable:
                    continue
                if type(number) not in (int, float) or not math.isfinite(number) or not low <= number <= high:
                    raise FrontierError("Invalid evaluation score")
    if len(json.dumps(value).encode()) > 1024 * 1024:
        raise FrontierError("Review exceeds 1 MiB")
    return value


def load_generator_gate(path):
    gate = load_json(path)
    exact(gate, ("schemaVersion", "seriesId", "policy", "finalized", "reconstruction", "heldout"), path="generator gate")
    if gate["schemaVersion"] != "fishy.evaluation.split.v1" or gate["finalized"] is not True or gate["policy"] not in ("strict_test", "validation", "fixture"):
        raise FrontierError("Evaluation split must be finalized before generation")
    identifier(gate["seriesId"])
    if type(gate["reconstruction"]) is not list or not 1 <= len(gate["reconstruction"]) <= 20 or type(gate["heldout"]) is not list or not 1 <= len(gate["heldout"]) <= 40:
        raise FrontierError("Invalid evaluation split sizes")
    ids, allowed, forbidden = set(), set(), set()
    root = Path(path).resolve().parent
    for entry in gate["reconstruction"]:
        exact(entry, ("id", "path", "sha256", "view"), path="split reconstruction")
        identifier(entry["id"])
        digest(entry["sha256"])
        if entry["id"] in ids or entry["view"] not in VIEWS:
            raise FrontierError("Duplicate split ID or invalid view")
        ids.add(entry["id"])
        if type(entry["path"]) is not str or Path(entry["path"]).is_absolute() or not (root / entry["path"]).resolve().is_relative_to(root):
            raise FrontierError("Split reconstruction path escapes its directory")
        allowed.add(entry["sha256"])
    for entry in gate["heldout"]:
        exact(entry, ("sha256",), path="heldout hash")
        digest(entry["sha256"])
        forbidden.add(entry["sha256"])
    if allowed & forbidden:
        raise FrontierError("Image bytes appear in both reconstruction and heldout splits")
    return gate
