"""Strict, dependency-free contract for an editable Fishy scene recipe.

Coordinates are metres: X right, Y back, Z up. Object position is its base
centre; size is its full envelope before yaw. This validates geometry and
input shape only, not biological compatibility or reconstruction accuracy.

Version 2 adds a required ``design`` block: the composition scheme, focal
object, sightline, open-foreground target, mood, maintenance tier, and story
that DESIGN_PRINCIPLES.md makes the core consideration. Version 1 recipes
(no design block) still load so earlier runs remain reproducible.
"""

from copy import deepcopy
import json
import math
from pathlib import Path
import re


SCHEMA_VERSION = "fishy.recipe.v2"
LEGACY_VERSIONS = ("fishy.recipe.v1",)
MAX_FILE_BYTES = 256 * 1024
BOUNDS_TOLERANCE_M = 1e-6
TANK_KEYS = ("width_m", "depth_m", "height_m", "substrate_depth_m")
ASSETS = ("rock", "branchwood", "grass", "bush")
ID_PATTERN = r"[a-z][a-z0-9_-]{0,47}"
DESIGN_KEYS = ("composition", "focal_object_id", "sightline", "open_foreground_min",
               "mood", "maintenance_tier", "story")
COMPOSITIONS = ("triangular", "concave", "convex", "diorama", "hardscape-only", "undetermined")
MOODS = ("bright", "lush", "dark-mysterious", "minimal", "undetermined")
MAINTENANCE = ("low", "medium", "high")


class RecipeError(ValueError):
    """The recipe cannot safely be interpreted as the declared scene."""


_SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "title": "Fishy aquarium scene recipe",
    "type": "object",
    "additionalProperties": False,
    "required": ["schema_version", "title", "interpretation", "assumptions", "tank", "design", "objects"],
    "properties": {
        "schema_version": {"type": "string", "const": SCHEMA_VERSION},
        "title": {"type": "string", "maxLength": 120},
        "interpretation": {"type": "string", "maxLength": 2000},
        "assumptions": {
            "type": "array", "maxItems": 12,
            "items": {"type": "string", "maxLength": 500},
        },
        "design": {
            "type": "object", "additionalProperties": False,
            "required": list(DESIGN_KEYS),
            "description": "Design intent per DESIGN_PRINCIPLES.md. Reviewed geometrically by design_review.py.",
            "properties": {
                "composition": {"type": "string", "enum": list(COMPOSITIONS),
                                "description": "Mass scheme: triangular (one side heavy), concave (open centre), convex (island), diorama (paths, cliffs, forced perspective), hardscape-only, or undetermined."},
                "focal_object_id": {"type": "string", "pattern": "^" + ID_PATTERN + "$", "maxLength": 48,
                                    "description": "ID of the object the eye should land on first. Must match an object in this recipe."},
                "sightline": {"type": "string", "maxLength": 300,
                              "description": "Where the open path for the eye runs, in words."},
                "open_foreground_min": {"type": "number", "minimum": 0, "maximum": 0.95,
                                        "description": "Fraction of the front 30 percent of the floor intended to stay clear."},
                "mood": {"type": "string", "enum": list(MOODS)},
                "maintenance_tier": {"type": "string", "enum": list(MAINTENANCE),
                                     "description": "low: hardscape, moss, epiphytes. high: stem plants needing weekly trimming."},
                "story": {"type": "string", "maxLength": 300,
                          "description": "One sentence: what this tank is."},
            },
        },
        "tank": {
            "type": "object", "additionalProperties": False,
            "required": list(TANK_KEYS),
            "properties": {
                "width_m": {"type": "number", "minimum": 0.1, "maximum": 3},
                "depth_m": {"type": "number", "minimum": 0.1, "maximum": 3},
                "height_m": {"type": "number", "minimum": 0.1, "maximum": 3},
                "substrate_depth_m": {
                    "type": "number", "minimum": 0, "maximum": 0.2,
                    "description": "Must also be at most 30% of tank height.",
                },
            },
        },
        "objects": {
            "type": "array", "minItems": 1, "maxItems": 24,
            "items": {
                "type": "object", "additionalProperties": False,
                "required": ["id", "label", "asset", "position_m", "size_m", "yaw_deg", "seed"],
                "properties": {
                    "id": {"type": "string", "pattern": "^" + ID_PATTERN + "$", "maxLength": 48},
                    "label": {"type": "string", "maxLength": 100},
                    "asset": {"type": "string", "enum": list(ASSETS)},
                    "position_m": {
                        "type": "array", "minItems": 3, "maxItems": 3,
                        "items": {"type": "number"},
                        "description": "[X, Y, Z] base-centre in metres; Z is the lowest mesh point, at or above substrate.",
                    },
                    "size_m": {
                        "type": "array", "minItems": 3, "maxItems": 3,
                        "items": {"type": "number", "minimum": 0.002, "maximum": 3},
                        "description": "[width, depth, height] full envelope before yaw, each no larger than the corresponding tank dimension. Rotated envelope must fit inside tank.",
                    },
                    "yaw_deg": {"type": "number", "minimum": -180, "maximum": 180},
                    "seed": {"type": "integer", "minimum": 0, "maximum": 999999},
                },
            },
        },
    },
}


def recipe_schema():
    """Return an independent JSON Schema; cross-field rules are enforced below."""
    return deepcopy(_SCHEMA)


def _object(value, keys, path):
    if type(value) is not dict:
        raise RecipeError(f"{path} must be an object")
    missing = set(keys) - value.keys()
    extra = value.keys() - set(keys)
    if missing or extra:
        details = []
        if missing:
            details.append("missing " + ", ".join(sorted(missing)))
        if extra:
            details.append("unexpected " + ", ".join(sorted(map(repr, extra))))
        raise RecipeError(f"{path}: {'; '.join(details)}")


def _string(value, limit, path):
    if type(value) is not str or len(value) > limit:
        raise RecipeError(f"{path} must be a string of at most {limit} characters")


def _number(value, path, minimum=None, maximum=None):
    if type(value) not in (int, float):
        raise RecipeError(f"{path} must be a finite number, not {type(value).__name__}")
    try:
        finite = math.isfinite(value)
    except OverflowError:
        finite = False
    if not finite:
        raise RecipeError(f"{path} must be a finite number")
    if minimum is not None and value < minimum:
        raise RecipeError(f"{path} must be at least {minimum}")
    if maximum is not None and value > maximum:
        raise RecipeError(f"{path} must be at most {maximum}")


def _vector(value, path, minimum=None, maximum=None):
    if type(value) is not list or len(value) != 3:
        raise RecipeError(f"{path} must be an array of exactly three numbers")
    for index, item in enumerate(value):
        _number(item, f"{path}[{index}]", minimum, maximum)


def _tank(value, path):
    _object(value, TANK_KEYS, path)
    for key in TANK_KEYS[:3]:
        _number(value[key], f"{path}.{key}", 0.1, 3)
    _number(value["substrate_depth_m"], f"{path}.substrate_depth_m", 0,
            min(0.2, value["height_m"] * 0.3))


def recipe_bounds(obj):
    """Return the conservative world AABB for a valid object's rotated envelope.

    The object must meet the recipe contract. This uses the entire pre-yaw
    box, so sparse procedural shapes may occupy less space than this bound.
    """
    x, y, z = obj["position_m"]
    width, depth, height = obj["size_m"]
    yaw = math.radians(obj["yaw_deg"])
    cosine, sine = abs(math.cos(yaw)), abs(math.sin(yaw))
    half_x = (cosine * width + sine * depth) / 2
    half_y = (sine * width + cosine * depth) / 2
    return {"min_m": [x - half_x, y - half_y, z],
            "max_m": [x + half_x, y + half_y, z + height]}


def validate_recipe(value, expected_tank=None, *, geometry=True):
    """Return the original validated dict, or raise RecipeError.

    expected_tank, when supplied, fixes all four tank measurements to within
    1 micrometre. Validation never repairs, rounds, clamps or mutates input.
    """
    if type(value) is not dict:
        raise RecipeError("recipe must be an object")
    version = value.get("schema_version")
    if type(version) is not str or version not in (SCHEMA_VERSION, *LEGACY_VERSIONS):
        raise RecipeError(f"recipe.schema_version must be {SCHEMA_VERSION!r} (or a legacy version: {', '.join(LEGACY_VERSIONS)})")
    legacy = version != SCHEMA_VERSION
    required = [key for key in _SCHEMA["required"] if not (legacy and key == "design")]
    if legacy and "design" in value:
        required.append("design")
    _object(value, required, "recipe")
    _string(value["title"], 120, "recipe.title")
    _string(value["interpretation"], 2000, "recipe.interpretation")
    assumptions = value["assumptions"]
    if type(assumptions) is not list or len(assumptions) > 12:
        raise RecipeError("recipe.assumptions must be an array of at most 12 strings")
    for index, assumption in enumerate(assumptions):
        _string(assumption, 500, f"recipe.assumptions[{index}]")
    tank = value["tank"]
    _tank(tank, "recipe.tank")
    if expected_tank is not None:
        _tank(expected_tank, "expected_tank")
        for key in TANK_KEYS:
            if abs(tank[key] - expected_tank[key]) > BOUNDS_TOLERANCE_M:
                raise RecipeError(f"recipe.tank.{key} differs from expected_tank.{key}")

    objects = value["objects"]
    if type(objects) is not list or not (1 if geometry else 0) <= len(objects) <= 24:
        raise RecipeError("recipe.objects must be an array of 1 to 24 objects")
    seen = set()
    dimensions = [tank[key] for key in TANK_KEYS[:3]]
    minimums = [0, 0, tank["substrate_depth_m"]]
    for index, obj in enumerate(objects):
        path = f"recipe.objects[{index}]"
        _object(obj, _SCHEMA["properties"]["objects"]["items"]["required"], path)
        identifier = obj["id"]
        if type(identifier) is not str or not re.fullmatch(ID_PATTERN, identifier):
            raise RecipeError(f"{path}.id must match {ID_PATTERN}")
        if identifier in seen:
            raise RecipeError(f"{path}.id duplicates {identifier!r}")
        seen.add(identifier)
        _string(obj["label"], 100, f"{path}.label")
        if type(obj["asset"]) is not str or obj["asset"] not in ASSETS:
            raise RecipeError(f"{path}.asset must be one of {', '.join(ASSETS)}")
        _vector(obj["position_m"], f"{path}.position_m")
        _vector(obj["size_m"], f"{path}.size_m", 0.002)
        for axis, (size, dimension) in enumerate(zip(obj["size_m"], dimensions)):
            if geometry and size > dimension:
                raise RecipeError(f"{path}.size_m[{axis}] exceeds its tank dimension")
        _number(obj["yaw_deg"], f"{path}.yaw_deg", -180, 180)
        if type(obj["seed"]) is not int or not 0 <= obj["seed"] <= 999999:
            raise RecipeError(f"{path}.seed must be an integer from 0 to 999999")
        bounds = recipe_bounds(obj)
        if not geometry:
            continue
        for axis, axis_name in enumerate(("X", "Y", "Z")):
            if bounds["min_m"][axis] < minimums[axis] - BOUNDS_TOLERANCE_M:
                surface = "substrate" if axis == 2 else "tank minimum"
                raise RecipeError(f"{path} ({identifier}) crosses {axis_name} {surface}")
            if bounds["max_m"][axis] > dimensions[axis] + BOUNDS_TOLERANCE_M:
                raise RecipeError(f"{path} ({identifier}) crosses {axis_name} tank maximum")
    if "design" in value:
        _design(value["design"], seen if geometry else None, "recipe.design")
    return value


def _design(value, object_ids, path):
    _object(value, DESIGN_KEYS, path)
    for key, choices in (("composition", COMPOSITIONS), ("mood", MOODS), ("maintenance_tier", MAINTENANCE)):
        if type(value[key]) is not str or value[key] not in choices:
            raise RecipeError(f"{path}.{key} must be one of {', '.join(choices)}")
    focal = value["focal_object_id"]
    if type(focal) is not str or not re.fullmatch(ID_PATTERN, focal):
        raise RecipeError(f"{path}.focal_object_id must match {ID_PATTERN}")
    if object_ids is not None and focal not in object_ids:
        raise RecipeError(f"{path}.focal_object_id {focal!r} does not name an object in this recipe")
    _string(value["sightline"], 300, f"{path}.sightline")
    _string(value["story"], 300, f"{path}.story")
    _number(value["open_foreground_min"], f"{path}.open_foreground_min", 0, 0.95)


def _unique_pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise RecipeError(f"Duplicate JSON key: {key!r}")
        result[key] = value
    return result


def _invalid_constant(value):
    raise RecipeError(f"Non-finite JSON constant is forbidden: {value}")


def load_recipe(path, expected_tank=None):
    """Read at most 256 KiB of strict UTF-8 JSON, then validate the recipe."""
    try:
        with Path(path).open("rb") as handle:
            raw = handle.read(MAX_FILE_BYTES + 1)
    except OSError as error:
        raise RecipeError(f"Cannot read recipe: {error}") from error
    if len(raw) > MAX_FILE_BYTES:
        raise RecipeError(f"Recipe exceeds {MAX_FILE_BYTES} bytes")
    try:
        value = json.loads(raw.decode("utf-8"), object_pairs_hook=_unique_pairs,
                           parse_constant=_invalid_constant)
    except (UnicodeDecodeError, json.JSONDecodeError, RecursionError, ValueError) as error:
        if isinstance(error, RecipeError):
            raise
        raise RecipeError(f"Invalid recipe JSON: {error}") from error
    return validate_recipe(value, expected_tank=expected_tank)
