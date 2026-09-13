"""Run with: python3 -m unittest discover -s blender/tests -v"""

from copy import deepcopy
import json
import math
from pathlib import Path
import sys
import tempfile
import unittest


BLENDER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BLENDER_DIR))
from scene_recipe import (  # noqa: E402
    BOUNDS_TOLERANCE_M, MAX_FILE_BYTES, RecipeError,
    load_recipe, recipe_bounds, recipe_schema, validate_recipe,
)


class RecipeValidationTests(unittest.TestCase):
    def setUp(self):
        self.recipe = load_recipe(BLENDER_DIR / "examples" / "recipe-example.json")

    def assert_invalid(self, mutate):
        document = deepcopy(self.recipe)
        mutate(document)
        with self.assertRaises(RecipeError):
            validate_recipe(document)

    def test_fixture_is_explicitly_hand_authored_and_all_assets_validate(self):
        self.assertIn("Hand-authored", self.recipe["title"])
        self.assertEqual({o["asset"] for o in self.recipe["objects"]},
                         {"rock", "branchwood", "grass", "bush"})
        before = deepcopy(self.recipe)
        self.assertIs(validate_recipe(self.recipe), self.recipe)
        self.assertEqual(self.recipe, before)

    def test_missing_extra_and_incorrect_container_types(self):
        mutations = [
            lambda r: r.pop("assumptions"),
            lambda r: r.update(code="print('unexpected')"),
            lambda r: r["tank"].update(volume=64.8),
            lambda r: r["objects"][0].update(script="arbitrary code"),
            lambda r: r["objects"][0].pop("seed"),
            lambda r: r.update(objects=()),
            lambda r: r.update(assumptions={}),
            lambda r: r["objects"][0].update(position_m=(0.3, 0.1, 0.03)),
            lambda r: r["objects"][0].update(size_m=[0.1, 0.1]),
        ]
        for index, mutation in enumerate(mutations):
            with self.subTest(case=index):
                self.assert_invalid(mutation)
        for root in (None, [], True, "recipe"):
            with self.subTest(root=root), self.assertRaises(RecipeError):
                validate_recipe(root)

    def test_numeric_fields_reject_booleans_nonfinite_strings_and_huge_integers(self):
        for value in (True, False, float("nan"), float("inf"), -float("inf"), "0.2", 10 ** 1000):
            setters = (
                lambda r, v: r["tank"].update(width_m=v),
                lambda r, v: r["tank"].update(substrate_depth_m=v),
                lambda r, v: r["objects"][0]["position_m"].__setitem__(0, v),
                lambda r, v: r["objects"][0]["size_m"].__setitem__(0, v),
                lambda r, v: r["objects"][0].update(yaw_deg=v),
                lambda r, v: r["objects"][0].update(seed=v),
            )
            for index, setter in enumerate(setters):
                with self.subTest(value_type=type(value).__name__, field=index):
                    self.assert_invalid(lambda r: setter(r, value))

    def test_identity_asset_and_seed_limits(self):
        for identifier in ("", "Uppercase", "a b", "a\n", "a" * 49, 5):
            with self.subTest(identifier=identifier):
                self.assert_invalid(lambda r: r["objects"][0].update(id=identifier))
        self.assert_invalid(lambda r: r["objects"][1].update(id=r["objects"][0]["id"]))
        for asset in ("fish", "Rock", None):
            self.assert_invalid(lambda r: r["objects"][0].update(asset=asset))
        for seed in (-1, 1000000, 3.0):
            self.assert_invalid(lambda r: r["objects"][0].update(seed=seed))
        for seed in (0, 999999):
            self.recipe["objects"][0]["seed"] = seed
            validate_recipe(self.recipe)

    def test_cardinality_and_string_limits(self):
        self.assert_invalid(lambda r: r.update(objects=[]))
        self.assert_invalid(lambda r: r.update(objects=r["objects"] * 5))
        self.assert_invalid(lambda r: r.update(assumptions=[""] * 13))
        self.assert_invalid(lambda r: r.update(assumptions=["a" * 501]))
        self.assert_invalid(lambda r: r.update(assumptions=[False]))
        for key, limit in (("title", 120), ("interpretation", 2000)):
            self.assert_invalid(lambda r: r.update({key: "a" * (limit + 1)}))
            self.recipe[key] = "a" * limit
            validate_recipe(self.recipe)
        self.assert_invalid(lambda r: r["objects"][0].update(label="a" * 101))
        self.assert_invalid(lambda r: r.update(schema_version="fishy.recipe.v3"))
        self.assert_invalid(lambda r: r.update(schema_version=2))

    def test_tank_and_size_limits(self):
        for key in ("width_m", "depth_m", "height_m"):
            for value in (0.099, 3.001):
                self.assert_invalid(lambda r: r["tank"].update({key: value}))
        for value in (-0.001, 0.109, 0.201):
            self.assert_invalid(lambda r: r["tank"].update(substrate_depth_m=value))
        for axis, dimension in enumerate((0.6, 0.3, 0.36)):
            for value in (0, -0.1, 0.001999, dimension + 0.01):
                self.assert_invalid(lambda r: r["objects"][0]["size_m"].__setitem__(axis, value))
        for yaw in (-180.01, 180.01):
            self.assert_invalid(lambda r: r["objects"][0].update(yaw_deg=yaw))

    def test_exact_fit_and_minimum_size(self):
        self.recipe["objects"] = [self.recipe["objects"][0]]
        obj = self.recipe["objects"][0]
        obj.update(position_m=[0.3, 0.15, 0.03], size_m=[0.6, 0.3, 0.33], yaw_deg=0)
        validate_recipe(self.recipe)
        for yaw in (-180, 180):
            obj["yaw_deg"] = yaw
            validate_recipe(self.recipe)
        obj.update(position_m=[0.001, 0.001, 0.03], size_m=[0.002] * 3, yaw_deg=0)
        validate_recipe(self.recipe)

    def test_tolerance_applies_to_each_lower_and_upper_surface(self):
        self.recipe["objects"] = [self.recipe["objects"][0]]
        obj = self.recipe["objects"][0]
        obj.update(position_m=[0.3, 0.15, 0.03], size_m=[0.6, 0.3, 0.33], yaw_deg=0)
        for axis in range(3):
            for direction in (-1, 1):
                with self.subTest(axis=axis, direction=direction):
                    inside = deepcopy(self.recipe)
                    inside["objects"][0]["position_m"][axis] += direction * BOUNDS_TOLERANCE_M * 0.5
                    validate_recipe(inside)
                    outside = deepcopy(self.recipe)
                    outside["objects"][0]["position_m"][axis] += direction * BOUNDS_TOLERANCE_M * 2
                    with self.assertRaises(RecipeError):
                        validate_recipe(outside)

    def test_rotated_envelope_bounds_not_only_position_are_checked(self):
        self.recipe["objects"] = [self.recipe["objects"][0]]
        obj = self.recipe["objects"][0]
        obj.update(position_m=[0.3, 0.15, 0.03], size_m=[0.4, 0.2, 0.1], yaw_deg=0)
        validate_recipe(self.recipe)
        obj["yaw_deg"] = 45
        bounds = recipe_bounds(obj)
        self.assertAlmostEqual(bounds["min_m"][0], 0.3 - 0.3 / math.sqrt(2))
        self.assertLess(bounds["min_m"][1], 0)
        with self.assertRaisesRegex(RecipeError, "crosses Y"):
            validate_recipe(self.recipe)
        obj.update(size_m=[0.2, 0.1, 0.1], yaw_deg=90)
        validate_recipe(self.recipe)
        self.assertAlmostEqual(recipe_bounds(obj)["max_m"][0], 0.35)
        self.assertAlmostEqual(recipe_bounds(obj)["max_m"][1], 0.25)

    def test_expected_tank_compares_every_value_without_mutating(self):
        expected = deepcopy(self.recipe["tank"])
        validate_recipe(self.recipe, expected_tank=expected)
        for key in expected:
            changed = dict(expected)
            changed[key] += 0.001
            with self.subTest(key=key), self.assertRaisesRegex(RecipeError, key):
                validate_recipe(self.recipe, expected_tank=changed)
        with self.assertRaises(RecipeError):
            validate_recipe(self.recipe, expected_tank={"width_m": 0.6})
        self.assertEqual(expected, self.recipe["tank"])

    def test_schema_file_matches_authoritative_schema_and_is_independent(self):
        schema = recipe_schema()
        committed = json.loads((BLENDER_DIR / "scene_recipe.schema.json").read_text())
        self.assertEqual(schema, committed)
        schema["properties"]["schema_version"]["const"] = "changed"
        self.assertEqual(recipe_schema()["properties"]["schema_version"]["const"], "fishy.recipe.v2")
        self.assertIn("design", recipe_schema()["required"])
        design = recipe_schema()["properties"]["design"]
        self.assertFalse(design["additionalProperties"])
        self.assertEqual(set(design["required"]), set(design["properties"]))


class DesignBlockTests(unittest.TestCase):
    """Version 2 requires the design block; version 1 recipes still load without it."""

    def setUp(self):
        self.recipe = load_recipe(BLENDER_DIR / "examples" / "recipe-example.json")

    def assert_invalid(self, mutate, pattern=None):
        document = deepcopy(self.recipe)
        mutate(document)
        if pattern:
            with self.assertRaisesRegex(RecipeError, pattern):
                validate_recipe(document)
        else:
            with self.assertRaises(RecipeError):
                validate_recipe(document)

    def test_fixture_declares_a_complete_design_block(self):
        design = self.recipe["design"]
        self.assertEqual(set(design), {"composition", "focal_object_id", "sightline", "open_foreground_min",
                                       "mood", "maintenance_tier", "story"})
        self.assertIn(design["focal_object_id"], {o["id"] for o in self.recipe["objects"]})

    def test_v2_requires_design_and_v1_does_not(self):
        self.assert_invalid(lambda r: r.pop("design"), "missing design")
        legacy = deepcopy(self.recipe)
        legacy["schema_version"] = "fishy.recipe.v1"
        legacy.pop("design")
        self.assertIs(validate_recipe(legacy), legacy)
        legacy["design"] = deepcopy(self.recipe["design"])
        validate_recipe(legacy)
        legacy["design"]["mood"] = "gloomy"
        with self.assertRaisesRegex(RecipeError, "mood"):
            validate_recipe(legacy)

    def test_enumerations_focal_reference_and_limits(self):
        for key, bad in (("composition", "island"), ("composition", 1), ("mood", "Lush"),
                         ("maintenance_tier", "none"), ("maintenance_tier", None)):
            with self.subTest(key=key, bad=bad):
                self.assert_invalid(lambda r: r["design"].update({key: bad}), key)
        self.assert_invalid(lambda r: r["design"].update(focal_object_id="wood-99"), "does not name an object")
        self.assert_invalid(lambda r: r["design"].update(focal_object_id="Wood-01"), "focal_object_id")
        for value in (-0.01, 0.951, "0.4", True, float("nan")):
            with self.subTest(value=value):
                self.assert_invalid(lambda r: r["design"].update(open_foreground_min=value), "open_foreground_min")
        for key in ("sightline", "story"):
            self.assert_invalid(lambda r: r["design"].update({key: "a" * 301}), key)
            self.recipe["design"][key] = "a" * 300
            validate_recipe(self.recipe)
        self.assert_invalid(lambda r: r["design"].update(fish="neon tetra"), "unexpected")
        self.assert_invalid(lambda r: r["design"].pop("story"), "missing story")
        self.assert_invalid(lambda r: r.update(design=[]), "must be an object")

    def test_every_enumeration_value_validates(self):
        from scene_recipe import COMPOSITIONS, MAINTENANCE, MOODS
        for key, choices in (("composition", COMPOSITIONS), ("mood", MOODS), ("maintenance_tier", MAINTENANCE)):
            for choice in choices:
                self.recipe["design"][key] = choice
                validate_recipe(self.recipe)
        for value in (0, 0.95):
            self.recipe["design"]["open_foreground_min"] = value
            validate_recipe(self.recipe)


class RecipeLoadingTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="fishy-recipe-tests-")
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / "recipe.json"

    def test_strict_json_rejects_duplicate_keys_at_any_depth_and_constants(self):
        texts = (
            '{"title":"a","title":"b"}',
            '{"objects":[{"seed":1,"seed":2}]}',
            '{"tank":{"width_m":1,"width_m":2}}',
            '{"x":NaN}', '{"x":Infinity}', '{"x":-Infinity}',
            '{} {}', '{"a":1,}', '```json\n{}\n```',
        )
        for text in texts:
            with self.subTest(text=text):
                self.path.write_text(text)
                with self.assertRaises(RecipeError):
                    load_recipe(self.path)

    def test_file_size_limit_exactly_and_above(self):
        raw = (BLENDER_DIR / "examples" / "recipe-example.json").read_bytes()
        self.path.write_bytes(raw + b" " * (MAX_FILE_BYTES - len(raw)))
        load_recipe(self.path)
        with self.path.open("ab") as handle:
            handle.write(b" ")
        with self.assertRaisesRegex(RecipeError, "exceeds"):
            load_recipe(self.path)

    def test_invalid_encoding_deep_nesting_and_missing_file_report_recipe_error(self):
        for raw in (b"\xff", b"[" * 2000 + b"]" * 2000):
            self.path.write_bytes(raw)
            with self.assertRaises(RecipeError):
                load_recipe(self.path)
        with self.assertRaisesRegex(RecipeError, "Cannot read"):
            load_recipe(self.path.with_name("missing.json"))

    def test_exponent_overflow_is_rejected_and_expected_tank_is_forwarded(self):
        raw = (BLENDER_DIR / "examples" / "recipe-example.json").read_text()
        self.path.write_text(raw.replace('"width_m": 0.6', '"width_m": 1e999'))
        with self.assertRaisesRegex(RecipeError, "finite"):
            load_recipe(self.path)
        self.path.write_text(raw)
        expected = {"width_m": 0.7, "depth_m": 0.3, "height_m": 0.36, "substrate_depth_m": 0.03}
        with self.assertRaisesRegex(RecipeError, "expected_tank.width_m"):
            load_recipe(self.path, expected_tank=expected)


if __name__ == "__main__":
    unittest.main()
