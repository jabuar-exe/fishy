"""Offline checks for the geometric design review. No Blender or model calls."""

from contextlib import redirect_stderr, redirect_stdout
from copy import deepcopy
import io
import json
from pathlib import Path
import sys
import unittest


BLENDER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BLENDER_DIR))
import design_review as review  # noqa: E402
from scene_recipe import COMPOSITIONS, MAINTENANCE, MOODS, load_recipe, validate_recipe  # noqa: E402


def obj(identifier, asset, x, y, size, yaw=0, z=0.03):
    return {"id": identifier, "label": identifier, "asset": asset, "position_m": [x, y, z],
            "size_m": list(size), "yaw_deg": yaw, "seed": 1}


class DesignReviewTestCase(unittest.TestCase):
    def setUp(self):
        self.fixture = load_recipe(BLENDER_DIR / "examples" / "recipe-example.json")

    def recipe(self, objects, design=None):
        document = deepcopy(self.fixture)
        document["objects"] = objects
        if design is None:
            document["schema_version"] = "fishy.recipe.v1"
            document.pop("design")
        else:
            document["design"] = {**self.fixture["design"], **design}
        return validate_recipe(document)

    def statuses(self, result, principle):
        return {item["status"] for item in result["findings"] if item["principle"] == principle}

    def messages(self, result, principle):
        return " ".join(item["message"] for item in result["findings"] if item["principle"] == principle)


class ReviewShapeTests(DesignReviewTestCase):
    def test_fixture_review_is_complete_serialisable_and_non_mutating(self):
        before = deepcopy(self.fixture)
        result = review.review_recipe(self.fixture)
        self.assertEqual(self.fixture, before)
        json.dumps(result, allow_nan=False)
        self.assertEqual(result["review_version"], review.REVIEW_VERSION)
        self.assertEqual([p["id"] for p in result["principles"]], list(review.PRINCIPLE_IDS))
        self.assertEqual(sum(result["counts"].values()), len(result["findings"]))
        self.assertEqual(result["declared_design"], self.fixture["design"])
        covered = {item["principle"] for item in result["findings"]}
        self.assertEqual(covered, set(review.PRINCIPLE_IDS))
        self.assertIn("Not a judgement of biology", result["disclaimer"])

    def test_findings_are_sorted_warnings_first(self):
        result = review.review_recipe(self.recipe([obj("grass-only", "grass", 0.3, 0.15, [0.5, 0.2, 0.05])]))
        order = [review.STATUS_ORDER[item["status"]] for item in result["findings"]]
        self.assertEqual(order, sorted(order))
        self.assertEqual(result["findings"][0]["status"], "warn")

    def test_prompt_guidance_names_every_principle_and_enumeration(self):
        text = review.prompt_guidance()
        for identifier, title, rule in review.PRINCIPLES:
            self.assertIn(identifier, text)
            self.assertIn(title, text)
            self.assertIn(rule, text)
        for choice in (*COMPOSITIONS, *MOODS, *MAINTENANCE):
            self.assertIn(choice, text)
        self.assertNotIn("```", text)

    def test_principle_ids_match_the_workspace_design_document(self):
        document = (BLENDER_DIR.parent / "DESIGN_PRINCIPLES.md").read_text(encoding="utf-8")
        for identifier, title, _ in review.PRINCIPLES:
            self.assertIn(f"`{identifier}`", document)
            self.assertIn(title, document)

    def test_enumerations_stay_aligned_with_the_recipe_contract(self):
        self.assertEqual(review.COMPOSITIONS, COMPOSITIONS)
        self.assertEqual(review.MOODS, MOODS)
        self.assertEqual(review.MAINTENANCE, MAINTENANCE)


class CompositionInferenceTests(DesignReviewTestCase):
    def test_concave_layout_finds_the_central_channel(self):
        result = review.review_recipe(self.recipe([
            obj("rock-left", "rock", 0.09, 0.15, [0.17, 0.24, 0.2]),
            obj("rock-right", "rock", 0.51, 0.15, [0.17, 0.24, 0.2]),
            obj("grass-left", "grass", 0.09, 0.15, [0.15, 0.2, 0.05]),
            obj("bush-right", "bush", 0.5, 0.2, [0.12, 0.1, 0.1]),
        ]))
        self.assertEqual(result["inferred_composition"], "concave")
        channel = result["measures"]["channel"]
        self.assertIsNotNone(channel)
        self.assertAlmostEqual(channel["x_fraction"], 0.5, delta=0.05)
        self.assertGreaterEqual(channel["depth_fraction"], 0.99)
        self.assertEqual(self.statuses(result, "sightline"), {"ok"})

    def test_triangular_and_convex_layouts(self):
        heavy_left = self.recipe([
            obj("rock-big", "rock", 0.12, 0.18, [0.22, 0.2, 0.25]),
            obj("wood", "branchwood", 0.1, 0.12, [0.18, 0.1, 0.3]),
            obj("grass", "grass", 0.45, 0.08, [0.2, 0.08, 0.04]),
        ])
        self.assertEqual(review.review_recipe(heavy_left)["inferred_composition"], "triangular")
        island = self.recipe([
            obj("rock-centre", "rock", 0.3, 0.16, [0.18, 0.16, 0.22]),
            obj("bush-centre", "bush", 0.3, 0.2, [0.16, 0.1, 0.18]),
            obj("grass-front", "grass", 0.3, 0.05, [0.3, 0.05, 0.03]),
        ])
        self.assertEqual(review.review_recipe(island)["inferred_composition"], "convex")

    def test_hardscape_only_and_planting_only(self):
        stones = self.recipe([obj("rock-a", "rock", 0.2, 0.15, [0.2, 0.15, 0.2]),
                              obj("rock-b", "rock", 0.42, 0.14, [0.14, 0.12, 0.12])],
                             {"composition": "hardscape-only", "focal_object_id": "rock-a"})
        result = review.review_recipe(stones)
        self.assertEqual(result["inferred_composition"], "hardscape-only")
        self.assertEqual(result["inferred_maintenance"], "low")
        self.assertIn("ok", self.statuses(result, "contrast"))
        self.assertNotIn("warn", self.statuses(result, "hardscape-first"))
        planted = review.review_recipe(self.recipe([obj("bush", "bush", 0.3, 0.2, [0.4, 0.15, 0.2])]))
        self.assertEqual(self.statuses(planted, "hardscape-first"), {"warn"})
        self.assertIn("nothing anchors", self.messages(planted, "hardscape-first"))

    def test_even_mass_is_called_out_as_directionless(self):
        result = review.review_recipe(self.recipe([
            obj("rock-1", "rock", 0.1, 0.15, [0.1, 0.1, 0.1]),
            obj("rock-2", "rock", 0.3, 0.15, [0.1, 0.1, 0.1]),
            obj("rock-3", "rock", 0.5, 0.15, [0.1, 0.1, 0.1]),
            obj("grass", "grass", 0.3, 0.25, [0.5, 0.05, 0.05]),
        ]))
        self.assertEqual(result["inferred_composition"], "undetermined")
        self.assertIn("Even mass", self.messages(result, "contrast"))


class DeclaredIntentTests(DesignReviewTestCase):
    def test_declared_composition_conflicting_with_mass_is_a_warning(self):
        concave = [obj("rock-left", "rock", 0.09, 0.15, [0.17, 0.24, 0.2]),
                   obj("rock-right", "rock", 0.51, 0.15, [0.17, 0.24, 0.2]),
                   obj("grass", "grass", 0.09, 0.15, [0.1, 0.1, 0.05])]
        mismatch = review.review_recipe(self.recipe(concave, {"composition": "triangular", "focal_object_id": "rock-left"}))
        self.assertIn("reads as concave", self.messages(mismatch, "contrast"))
        agreeing = review.review_recipe(self.recipe(concave, {"composition": "concave", "focal_object_id": "rock-left"}))
        self.assertNotIn("reads as", self.messages(agreeing, "contrast"))
        diorama = review.review_recipe(self.recipe(concave, {"composition": "diorama", "focal_object_id": "rock-left"}))
        self.assertNotIn("reads as", self.messages(diorama, "contrast"))

    def test_declared_open_foreground_is_checked_against_envelopes(self):
        blocked = [obj("wall", "rock", 0.3, 0.06, [0.58, 0.1, 0.1]), obj("grass", "grass", 0.3, 0.25, [0.2, 0.05, 0.05])]
        result = review.review_recipe(self.recipe(blocked, {"open_foreground_min": 0.9, "focal_object_id": "wall"}))
        self.assertIn("Declared open_foreground_min 90%", self.messages(result, "sightline"))
        self.assertIn("warn", self.statuses(result, "sightline"))

    def test_declared_mood_story_and_tier_are_reported(self):
        result = review.review_recipe(self.fixture)
        self.assertIn("Mood declared: lush", self.messages(result, "mood"))
        self.assertIn("Story declared", self.messages(result, "story"))
        undeclared = review.review_recipe(self.recipe(deepcopy(self.fixture["objects"])))
        self.assertEqual(self.statuses(undeclared, "mood"), {"note"})
        self.assertEqual(self.statuses(undeclared, "story"), {"note"})
        self.assertEqual(self.statuses(undeclared, "maintenance"), {"note"})

    def test_maintenance_tier_mismatch(self):
        dense = [obj("wood", "branchwood", 0.3, 0.15, [0.3, 0.1, 0.2])]
        dense += [obj(f"bush-{i}", "bush", 0.06 + i * 0.07, 0.22, [0.07, 0.1, 0.2]) for i in range(8)]
        result = review.review_recipe(self.recipe(dense, {"maintenance_tier": "low", "focal_object_id": "wood"}))
        self.assertEqual(result["inferred_maintenance"], "high")
        self.assertEqual(self.statuses(result, "maintenance"), {"warn"})


class GeometryProxyTests(DesignReviewTestCase):
    def test_tall_front_object_and_waterline_breach(self):
        result = review.review_recipe(self.recipe([
            obj("pillar", "rock", 0.3, 0.05, [0.1, 0.08, 0.33]),
            obj("grass", "grass", 0.3, 0.25, [0.3, 0.05, 0.05]),
        ]))
        self.assertIn("pillar", self.messages(result, "sightline"))
        self.assertIn("warn", self.statuses(result, "sightline"))
        self.assertIn("break the waterline", self.messages(result, "negative-space"))

    def test_cluttered_floor_and_open_floor(self):
        cluttered = review.review_recipe(self.recipe([
            obj("slab", "rock", 0.3, 0.15, [0.58, 0.28, 0.1]),
            obj("grass", "grass", 0.3, 0.15, [0.58, 0.28, 0.05]),
        ]))
        self.assertGreater(cluttered["measures"]["covered_fraction"], 0.85)
        self.assertIn("warn", self.statuses(cluttered, "negative-space"))
        open_floor = review.review_recipe(self.recipe([
            obj("stone", "rock", 0.4, 0.2, [0.15, 0.1, 0.12]),
            obj("grass", "grass", 0.4, 0.27, [0.1, 0.04, 0.05]),
        ]))
        self.assertLess(open_floor["measures"]["covered_fraction"], 0.2)
        self.assertEqual(self.statuses(open_floor, "negative-space"), {"ok"})

    def test_shallow_tank_and_flat_layout_notes(self):
        document = deepcopy(self.fixture)
        document["tank"]["depth_m"] = 0.2
        document["objects"] = [obj("stone", "rock", 0.3, 0.1, [0.2, 0.1, 0.08]),
                               obj("grass", "grass", 0.3, 0.16, [0.3, 0.04, 0.03])]
        document["design"]["focal_object_id"] = "stone"
        result = review.review_recipe(validate_recipe(document))
        self.assertIn("Shallow", self.messages(result, "proportion"))
        self.assertIn("read flat", self.messages(result, "proportion"))

    def test_focal_position_thirds(self):
        third = review.review_recipe(self.recipe([obj("stone", "rock", 0.2, 0.15, [0.15, 0.12, 0.15]),
                                                  obj("grass", "grass", 0.45, 0.25, [0.2, 0.05, 0.04])]))
        self.assertIn("sits on a third", self.messages(third, "contrast"))
        edge = review.review_recipe(self.recipe([obj("stone", "rock", 0.05, 0.15, [0.1, 0.12, 0.15]),
                                                 obj("grass", "grass", 0.45, 0.25, [0.2, 0.05, 0.04])]))
        self.assertIn("too close to the glass", self.messages(edge, "contrast"))

    def test_summary_lines_follow_finding_order(self):
        result = review.review_recipe(self.fixture)
        lines = review.summarise(result, limit=3)
        self.assertEqual(len(lines), 3)
        for line, item in zip(lines, result["findings"]):
            self.assertTrue(line.startswith(f"[{item['status']}] {item['principle']}:"))


class CommandLineTests(DesignReviewTestCase):
    def test_cli_prints_review_and_reports_bad_input(self):
        out, err = io.StringIO(), io.StringIO()
        with redirect_stdout(out), redirect_stderr(err):
            code = review.main([str(BLENDER_DIR / "examples" / "recipe-example.json")])
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(out.getvalue())["review_version"], review.REVIEW_VERSION)
        with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
            self.assertEqual(review.main([str(BLENDER_DIR / "missing.json")]), 1)
            self.assertEqual(review.main([]), 2)


if __name__ == "__main__":
    unittest.main()
