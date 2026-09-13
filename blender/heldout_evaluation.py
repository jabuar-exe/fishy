"""Isolated, frozen native silhouette evaluation. Never import this into prompts.

The standard-library metric functions accept rectangular 0/1 arrays. File scoring
uses Pillow (available in the bundled workspace Python); Blender rendering does
not need Pillow. A fixture score is a protocol test, not photographic accuracy.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import re

SCHEMA = "fishy.heldout.series.v1"
SCORE_SCHEMA = "fishy.heldout.score.v1"
SEQUENCE_SCHEMA = "fishy.heldout.sequence.v1"
BUILDER = "fishy-native-recipe-v2"
SOURCE_ROOT = Path(__file__).resolve().parent
BUILDER_FILES = ("build_recipe.py", "build_scene.py", "scene_recipe.py", "fishy_controls.py",
                 "native_snapshot.py", "frontier_contract.py", "heldout_evaluation.py", "render_heldout.py")
METRIC = {"version": "visible-hardscape-iou-v1", "maskThreshold": 127,
          "foregroundKinds": ["rock", "wood"],
          "occlusionPolicy": "plants-and-substrate-occlude; tank-glass-rim-studio-excluded",
          "centroid": "foreground-union-pixel-centres; null-if-prediction-empty",
          "ssim": "not-computed; procedural-materials-not-photometrically-calibrated"}
RENDERER_NAME = "BLENDER_WORKBENCH"
HEX = re.compile(r"[0-9a-f]{64}\Z")
ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,99}\Z")


class EvaluationError(ValueError):
    pass


def canonical_hash(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"),
                                     allow_nan=False).encode()).hexdigest()


def file_hash(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def confined_path(root, value, *, must_exist=True):
    root = Path(root).resolve(strict=True)
    if not isinstance(value, (str, Path)) or not str(value) or len(str(value)) > 4096:
        raise EvaluationError("Invalid input path")
    candidate = Path(value)
    if candidate.is_absolute() or ".." in candidate.parts:
        raise EvaluationError("Input paths must be relative and confined to --root")
    try:
        result = (root / candidate).resolve(strict=must_exist)
        result.relative_to(root)
    except (ValueError, FileNotFoundError, RuntimeError) as exc:
        raise EvaluationError("Missing or escaped input path") from exc
    if must_exist and not result.is_file():
        raise EvaluationError("Input path must identify a file")
    return result


def read_json(path):
    path = Path(path)
    if path.stat().st_size > 1024 * 1024:
        raise EvaluationError("JSON exceeds 1 MiB")
    def reject_constant(value):
        raise EvaluationError("Non-finite JSON number")
    def unique_pairs(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise EvaluationError("Duplicate JSON key")
            result[key] = value
        return result
    return json.loads(path.read_text(), parse_constant=reject_constant, object_pairs_hook=unique_pairs)


def write_new_json(path, value):
    encoded = json.dumps(value, indent=2, sort_keys=True, allow_nan=False) + "\n"
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with Path(path).open("x") as handle:
        handle.write(encoded)


def _keys(value, expected, label):
    if not isinstance(value, dict) or set(value) != set(expected):
        raise EvaluationError(f"{label}: missing or unsupported fields")


def _number(value, low, high, label):
    try:
        valid = type(value) in (int, float) and math.isfinite(value) and low <= value <= high
    except (OverflowError, TypeError):
        valid = False
    if not valid:
        raise EvaluationError(f"Invalid {label}")
    return value


def _hash(value):
    if not isinstance(value, str) or not HEX.fullmatch(value):
        raise EvaluationError("Invalid SHA256")
    return value


def _text(value, label, limit=2000):
    if not isinstance(value, str) or not value.strip() or len(value) > limit:
        raise EvaluationError(f"Invalid {label}")


def builder_identity():
    files = [{"path": name, "sha256": file_hash(SOURCE_ROOT / name)} for name in BUILDER_FILES]
    return files, canonical_hash(files)


def validate_camera(camera, policy):
    _keys(camera, ("projection", "positionM", "targetM", "lensMm", "sensorWidthMm",
                   "orthoScaleM", "shiftX", "shiftY", "resolution", "quality"), "camera")
    if camera["projection"] not in ("perspective", "orthographic"):
        raise EvaluationError("Unsupported camera projection")
    for field in ("positionM", "targetM"):
        if not isinstance(camera[field], list) or len(camera[field]) != 3:
            raise EvaluationError("Camera vectors must have three numbers")
        for value in camera[field]:
            _number(value, -1000, 1000, field)
    direction = [a - b for a, b in zip(camera["targetM"], camera["positionM"])]
    if sum(x*x for x in direction) < 1e-12 or direction[0]**2 + direction[1]**2 < 1e-12:
        raise EvaluationError("Camera aim is degenerate or parallel to fixed Z up")
    for field, low, high in (("lensMm", 1, 1000), ("sensorWidthMm", 1, 100),
                             ("orthoScaleM", .001, 100), ("shiftX", -2, 2), ("shiftY", -2, 2)):
        _number(camera[field], low, high, field)
    if (not isinstance(camera["resolution"], list) or len(camera["resolution"]) != 2
            or any(type(v) is not int or not 8 <= v <= 4096 for v in camera["resolution"])):
        raise EvaluationError("Camera resolution must contain two integers, 8..4096")
    quality = camera["quality"]
    _keys(quality, ("method", "assumptions", "alignmentResidualPx", "accepted"), "camera quality")
    if quality["method"] not in ("manual", "synthetic_fixture") or quality["accepted"] is not True:
        raise EvaluationError("Camera requires documented, explicitly accepted manual assumptions")
    if quality["method"] == "synthetic_fixture" and policy != "fixture":
        raise EvaluationError("Synthetic camera is only valid for fixture policy")
    if not isinstance(quality["assumptions"], list) or not 1 <= len(quality["assumptions"]) <= 20:
        raise EvaluationError("Camera assumptions are required")
    for assumption in quality["assumptions"]:
        _text(assumption, "camera assumption")
    if quality["alignmentResidualPx"] is not None:
        _number(quality["alignmentResidualPx"], 0, 10000, "alignment residual")
    return camera


def _input_record(root, record):
    _keys(record, ("path", "sha256"), "input record")
    _hash(record["sha256"])
    path = confined_path(root, record["path"])
    if file_hash(path) != record["sha256"]:
        raise EvaluationError("Input bytes changed after series freeze")
    return path


def validate_mask_quality(value, policy):
    _keys(value, ("method", "accepted", "note"), "mask quality")
    if value["accepted"] is not True or value["method"] not in ("manual_reviewed", "synthetic_fixture"):
        raise EvaluationError("Reference mask requires explicit review and acceptance")
    if value["method"] == "synthetic_fixture" and policy != "fixture":
        raise EvaluationError("Synthetic reference masks are only valid for fixtures")
    _text(value["note"], "mask review note")


def freeze_series(root, config, output):
    """Freeze one camera/mask/photo/renderer configuration; never overwrite it."""
    _keys(config, ("seriesId", "policy", "camera", "photoPath", "maskPath", "maskQuality", "rendererVersion", "note"), "series config")
    if not isinstance(config["seriesId"], str) or not ID.fullmatch(config["seriesId"]):
        raise EvaluationError("Invalid series ID")
    if config["policy"] not in ("fixture", "validation", "strict_test"):
        raise EvaluationError("Invalid evaluation policy")
    validate_camera(config["camera"], config["policy"])
    validate_mask_quality(config["maskQuality"], config["policy"])
    _text(config["note"], "series note")
    _text(config["rendererVersion"], "renderer version", 100)
    files, fingerprint = builder_identity()
    series = {"schemaVersion": SCHEMA, "seriesId": config["seriesId"], "runtime": "blender",
              "builder": BUILDER, "builderHash": fingerprint, "builderFiles": files,
              "policy": config["policy"], "camera": config["camera"],
              "cameraHash": canonical_hash(config["camera"]), "metric": METRIC, "maskQuality": config["maskQuality"],
              "renderer": {"name": RENDERER_NAME, "version": config["rendererVersion"], "samples": 1},
              "note": config["note"]}
    for name in ("photo", "mask"):
        relative = config[name + "Path"]
        path = confined_path(root, relative)
        series[name] = {"path": str(relative), "sha256": file_hash(path)}
    series["seriesHash"] = canonical_hash(series)
    validate_series(root, series)
    write_new_json(confined_path(root, output, must_exist=False), series)
    return series


def validate_series(root, series):
    _keys(series, ("schemaVersion", "seriesId", "runtime", "builder", "builderHash", "builderFiles",
                   "policy", "camera", "cameraHash", "metric", "maskQuality", "renderer", "note", "photo", "mask", "seriesHash"), "series")
    if series["schemaVersion"] != SCHEMA or series["runtime"] != "blender" or series["builder"] != BUILDER:
        raise EvaluationError("Unsupported evaluation series")
    if not isinstance(series["seriesId"], str) or not ID.fullmatch(series["seriesId"]):
        raise EvaluationError("Invalid series ID")
    if series["policy"] not in ("fixture", "validation", "strict_test"):
        raise EvaluationError("Invalid evaluation policy")
    _text(series["note"], "note")
    _hash(series["seriesHash"])
    if series["seriesHash"] != canonical_hash({k: v for k, v in series.items() if k != "seriesHash"}):
        raise EvaluationError("Frozen series identity changed")
    validate_camera(series["camera"], series["policy"])
    validate_mask_quality(series["maskQuality"], series["policy"])
    if series["cameraHash"] != canonical_hash(series["camera"]) or series["metric"] != METRIC:
        raise EvaluationError("Camera or metric changed")
    files, fingerprint = builder_identity()
    if series["builderFiles"] != files or series["builderHash"] != fingerprint:
        raise EvaluationError("Builder changed; start a separate series")
    _keys(series["renderer"], ("name", "version", "samples"), "renderer")
    if series["renderer"]["name"] != RENDERER_NAME or type(series["renderer"]["samples"]) is not int or series["renderer"]["samples"] != 1:
        raise EvaluationError("Renderer configuration changed")
    _text(series["renderer"]["version"], "renderer version", 100)
    for name in ("photo", "mask"):
        _input_record(root, series[name])
    return series


def load_series(root, relative):
    return validate_series(root, read_json(confined_path(root, relative)))


def validate_sequence(series, sequence, revision, recipe_hash):
    """A strict test requires the full final recipe sequence before any render."""
    if sequence is None:
        if series["policy"] == "strict_test":
            raise EvaluationError("Strict test is sealed until the revision sequence is finalized")
        return None
    _keys(sequence, ("schemaVersion", "seriesHash", "finalized", "revisions"), "revision sequence")
    if sequence["schemaVersion"] != SEQUENCE_SCHEMA or sequence["seriesHash"] != series["seriesHash"] or sequence["finalized"] is not True:
        raise EvaluationError("Revision sequence is not finalized for this series")
    revisions = sequence["revisions"]
    if not isinstance(revisions, list) or not 1 <= len(revisions) <= 40:
        raise EvaluationError("Invalid frozen revision count")
    seen = set()
    for item in revisions:
        _keys(item, ("revision", "recipeHash"), "frozen revision")
        if type(item["revision"]) is not int or not 0 <= item["revision"] <= 1_000_000 or item["revision"] in seen:
            raise EvaluationError("Invalid or duplicate revision")
        seen.add(item["revision"])
        _hash(item["recipeHash"])
    if {"revision": revision, "recipeHash": recipe_hash} not in revisions:
        raise EvaluationError("Recipe is not in the frozen revision sequence")
    return canonical_hash(sequence)


def freeze_sequence(root, series, revisions):
    """Seal the complete recipe sequence once, before strict-test rendering.

    Revisions are {revision, path} records. The fixed per-series seal prevents
    adding a score-informed revision to the same strict-test series later.
    It is a local workflow gate, not authentication against a host file editor.
    """
    validate_series(root, series)
    if not isinstance(revisions, list) or not 1 <= len(revisions) <= 40:
        raise EvaluationError("Invalid sequence revisions")
    records = []
    for record in revisions:
        _keys(record, ("revision", "path"), "sequence input")
        path = confined_path(root, record["path"])
        records.append({"revision": record["revision"], "recipeHash": file_hash(path)})
    sequence = {"schemaVersion": SEQUENCE_SCHEMA, "seriesHash": series["seriesHash"],
                "finalized": True, "revisions": records}
    validate_sequence(series, sequence, records[0]["revision"], records[0]["recipeHash"])
    relative = "sequence-seals/" + series["seriesHash"] + ".json"
    write_new_json(confined_path(root, relative, must_exist=False), sequence)
    return sequence


def require_sequence_seal(root, series, sequence):
    if series["policy"] != "strict_test":
        return
    if sequence is None:
        raise EvaluationError("Strict test requires a finalized sequence seal")
    path = confined_path(root, "sequence-seals/" + series["seriesHash"] + ".json")
    if read_json(path) != sequence:
        raise EvaluationError("Strict-test sequence differs from its immutable series seal")


def _binary_mask(value, label):
    if not isinstance(value, (list, tuple)) or not value or not isinstance(value[0], (list, tuple)) or not value[0]:
        raise EvaluationError(f"{label}: mask must be a nonempty rectangle")
    width = len(value[0])
    for row in value:
        if not isinstance(row, (list, tuple)) or len(row) != width:
            raise EvaluationError(f"{label}: ragged mask")
        if any(type(pixel) not in (int, bool) or pixel not in (0, 1) for pixel in row):
            raise EvaluationError(f"{label}: mask pixels must be binary finite values")
    return width, len(value)


def silhouette_metrics(reference, prediction):
    """Nonempty reference is mandatory. Empty prediction receives IoU zero."""
    dimensions = _binary_mask(reference, "reference")
    if _binary_mask(prediction, "prediction") != dimensions:
        raise EvaluationError("Mask resolutions differ")
    reference_count = prediction_count = intersection = union = 0
    reference_x = reference_y = prediction_x = prediction_y = 0.0
    for y, (left, right) in enumerate(zip(reference, prediction)):
        for x, (a, b) in enumerate(zip(left, right)):
            intersection += bool(a and b)
            union += bool(a or b)
            if a:
                reference_count += 1
                reference_x += x + .5
                reference_y += y + .5
            if b:
                prediction_count += 1
                prediction_x += x + .5
                prediction_y += y + .5
    if not reference_count:
        raise EvaluationError("Reference hardscape mask is empty; evaluation unavailable")
    centroid = (math.hypot(reference_x/reference_count - prediction_x/prediction_count,
                           reference_y/reference_count - prediction_y/prediction_count)
                if prediction_count else None)
    return {"iou": intersection / union, "ssim": None, "centroidErrorPx": centroid,
            "intersectionPixels": intersection, "unionPixels": union,
            "referencePixels": reference_count, "predictionPixels": prediction_count,
            "predictionStatus": "visible" if prediction_count else "missing_hardscape"}


def image_mask(path, resolution):
    try:
        from PIL import Image
    except ImportError as exc:
        raise EvaluationError("File scoring requires Pillow; use the bundled workspace Python") from exc
    with Image.open(path) as image:
        if image.format != "PNG":
            raise EvaluationError("Masks must use lossless PNG encoding")
        if image.size != tuple(resolution):
            raise EvaluationError("Image and frozen camera resolutions differ")
        if image.mode not in ("1", "L", "RGB", "RGBA"):
            raise EvaluationError("Masks must be 8-bit grayscale or RGB PNG images")
        rgb = image.convert("RGBA")
        pixels = rgb.tobytes()
        if any(pixels[i] != pixels[i+1] or pixels[i+1] != pixels[i+2] or pixels[i+3] != 255
               for i in range(0, len(pixels), 4)):
            raise EvaluationError("Mask must be opaque grayscale, not beauty colors")
        width, height = image.size
        return [[int(pixels[4*(y*width+x)] > METRIC["maskThreshold"]) for x in range(width)] for y in range(height)]


def _check_photo(path, resolution):
    try:
        from PIL import Image
    except ImportError as exc:
        raise EvaluationError("File scoring requires Pillow; use the bundled workspace Python") from exc
    with Image.open(path) as image:
        if image.size != tuple(resolution):
            raise EvaluationError("Photo and frozen camera resolutions differ")
        image.verify()


def score_revision(root, series, render_report, sequence=None):
    validate_series(root, series)
    require_sequence_seal(root, series, sequence)
    required = ("schemaVersion", "seriesHash", "revision", "recipe", "builderHash", "cameraHash",
                "renderer", "render", "mask", "hardscapeIds", "sequenceHash")
    _keys(render_report, required, "render report")
    if (render_report["schemaVersion"] != "fishy.heldout.render.v1"
            or render_report["seriesHash"] != series["seriesHash"]
            or render_report["builderHash"] != series["builderHash"]
            or render_report["cameraHash"] != series["cameraHash"]
            or render_report["renderer"] != series["renderer"]):
        raise EvaluationError("Render is not from the frozen native series")
    revision = render_report["revision"]
    if type(revision) is not int or not 0 <= revision <= 1_000_000:
        raise EvaluationError("Invalid revision")
    _input_record(root, render_report["recipe"])
    sequence_hash = validate_sequence(series, sequence, revision, render_report["recipe"]["sha256"])
    if sequence_hash != render_report["sequenceHash"]:
        raise EvaluationError("Render used a different finalized revision sequence")
    for key in ("render", "mask"):
        _input_record(root, render_report[key])
    hardscape_ids = render_report["hardscapeIds"]
    if (not isinstance(hardscape_ids, list) or len(hardscape_ids) > 32
            or any(not isinstance(value, str) or not ID.fullmatch(value) for value in hardscape_ids)
            or len(set(hardscape_ids)) != len(hardscape_ids)):
        raise EvaluationError("Invalid render hardscape IDs")
    resolution = series["camera"]["resolution"]
    _check_photo(confined_path(root, series["photo"]["path"]), resolution)
    _check_photo(confined_path(root, render_report["render"]["path"]), resolution)
    metrics = silhouette_metrics(image_mask(confined_path(root, series["mask"]["path"]), resolution),
                                 image_mask(confined_path(root, render_report["mask"]["path"]), resolution))
    return {"schemaVersion": SCORE_SCHEMA, "seriesHash": series["seriesHash"], "revision": revision,
            "recipeHash": render_report["recipe"]["sha256"], "sequenceHash": sequence_hash,
            "runtime": "blender", "builder": series["builder"], "builderHash": series["builderHash"],
            "cameraHash": series["cameraHash"], "photoHash": series["photo"]["sha256"],
            "maskHash": series["mask"]["sha256"], "renderHash": render_report["render"]["sha256"],
            "renderMaskHash": render_report["mask"]["sha256"], "policy": series["policy"],
            "metric": series["metric"], "renderer": series["renderer"], **metrics}


def review_evaluation(series, scores, *, sequence=None, root=None):
    """Export REVIEW_CONTRACT evaluation fields, never paths or photo content."""
    if (series.get("schemaVersion") != SCHEMA or series.get("runtime") != "blender"
            or series.get("builder") != BUILDER or series.get("seriesHash") != canonical_hash(
                {key: value for key, value in series.items() if key != "seriesHash"})):
        raise EvaluationError("Invalid frozen series metadata")
    if not isinstance(scores, list) or len(scores) > 40:
        raise EvaluationError("Invalid score list")
    if series["policy"] == "strict_test" and scores:
        if root is None:
            raise EvaluationError("Strict-test export requires its local sequence seal root")
        validate_series(root, series)
        require_sequence_seal(root, series, sequence)
    result = {"seriesId": series["seriesId"], "runtime": "blender", "builder": series["builder"],
              "builderHash": series["builderHash"], "cameraHash": series["cameraHash"],
              "photoHash": series["photo"]["sha256"], "maskHash": series["mask"]["sha256"],
              "policy": series["policy"], "status": "complete" if scores else "pending",
              "note": series["note"], "scores": []}
    seen = set()
    for score in scores:
        if score.get("schemaVersion") != SCORE_SCHEMA or score.get("seriesHash") != series["seriesHash"]:
            raise EvaluationError("Score belongs to a different series")
        for field in ("runtime", "builder", "builderHash", "cameraHash", "photoHash", "maskHash", "policy"):
            if score.get(field) != result[field]:
                raise EvaluationError("Score identity mismatch")
        if score.get("metric") != series["metric"] or score.get("renderer") != series["renderer"]:
            raise EvaluationError("Score metric or renderer identity mismatch")
        revision = score.get("revision")
        if type(revision) is not int or not 0 <= revision <= 1_000_000 or revision in seen:
            raise EvaluationError("Invalid or duplicate score revision")
        seen.add(revision)
        _hash(score.get("recipeHash"))
        frozen = validate_sequence(series, sequence, revision, score["recipeHash"])
        if frozen != score.get("sequenceHash"):
            raise EvaluationError("Score was not produced for the supplied frozen sequence")
        _number(score.get("iou"), 0, 1, "IoU")
        if score.get("ssim") is not None:
            raise EvaluationError("This metric version does not compute SSIM")
        if score.get("centroidErrorPx") is not None:
            _number(score["centroidErrorPx"], 0, 10000, "centroid error")
        exported_score = {key: score[key] for key in ("revision", "recipeHash", "iou", "ssim", "centroidErrorPx")}
        if "renderHash" in score:
            exported_score["renderHash"] = _hash(score["renderHash"])
        result["scores"].append(exported_score)
    result["scores"].sort(key=lambda item: item["revision"])
    if series["policy"] == "strict_test" and scores and seen != {item["revision"] for item in sequence["revisions"]}:
        result["status"] = "pending"
        result["note"] = "Finalized strict-test sequence is only partially scored. " + result["note"][:1900]
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    sub = parser.add_subparsers(dest="command", required=True)
    freeze = sub.add_parser("freeze")
    freeze.add_argument("--config", required=True)
    freeze.add_argument("--output", required=True)
    seal = sub.add_parser("seal-sequence")
    seal.add_argument("--series", required=True)
    seal.add_argument("--revisions", required=True, help="JSON array of {revision,path} records")
    score = sub.add_parser("score")
    score.add_argument("--series", required=True)
    score.add_argument("--report", required=True)
    score.add_argument("--sequence")
    score.add_argument("--output", required=True)
    options = parser.parse_args()
    if options.command == "freeze":
        result = freeze_series(options.root, read_json(confined_path(options.root, options.config)), options.output)
    elif options.command == "seal-sequence":
        result = freeze_sequence(options.root, load_series(options.root, options.series),
                                 read_json(confined_path(options.root, options.revisions)))
    else:
        series = load_series(options.root, options.series)
        sequence = read_json(confined_path(options.root, options.sequence)) if options.sequence else None
        result = score_revision(options.root, series, read_json(confined_path(options.root, options.report)), sequence)
        write_new_json(confined_path(options.root, options.output, must_exist=False), result)
    print(json.dumps(result, indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
