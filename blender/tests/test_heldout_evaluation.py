"""Deterministic native evaluation contracts; no model calls or paid services."""
from copy import deepcopy
import json
import math
from pathlib import Path
import sys
import tempfile
import unittest

try:
    from PIL import Image
except ImportError:
    Image = None

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import heldout_evaluation as evaluation


def camera(policy="fixture"):
    return {"projection": "orthographic", "positionM": [.3, -1.5, .35],
            "targetM": [.3, .15, .2], "lensMm": 50, "sensorWidthMm": 36,
            "orthoScaleM": .75, "shiftX": 0, "shiftY": 0, "resolution": [16, 16],
            "quality": {"method": "synthetic_fixture" if policy == "fixture" else "manual",
                        "assumptions": ["Synthetic unit fixture; no physical camera calibration."],
                        "alignmentResidualPx": None, "accepted": True}}


class SilhouetteMetricTests(unittest.TestCase):
    def test_perfect_overlap(self):
        result = evaluation.silhouette_metrics([[1, 0], [1, 0]], [[1, 0], [1, 0]])
        self.assertEqual(result["iou"], 1)
        self.assertEqual(result["centroidErrorPx"], 0)
        self.assertIsNone(result["ssim"])

    def test_disjoint_overlap(self):
        result = evaluation.silhouette_metrics([[1, 0], [1, 0]], [[0, 1], [0, 1]])
        self.assertEqual(result["iou"], 0)
        self.assertEqual(result["centroidErrorPx"], 1)
        self.assertEqual(result["unionPixels"], 4)

    def test_partial_overlap(self):
        result = evaluation.silhouette_metrics([[1, 1, 0]], [[0, 1, 1]])
        self.assertAlmostEqual(result["iou"], 1/3)
        self.assertEqual(result["centroidErrorPx"], 1)

    def test_empty_prediction_is_penalized(self):
        result = evaluation.silhouette_metrics([[1, 0]], [[0, 0]])
        self.assertEqual(result["iou"], 0)
        self.assertIsNone(result["centroidErrorPx"])
        self.assertEqual(result["predictionStatus"], "missing_hardscape")

    def test_empty_reference_is_not_perfect_even_when_both_empty(self):
        for prediction in ([[0, 0]], [[1, 0]]):
            with self.assertRaisesRegex(evaluation.EvaluationError, "Reference.*empty"):
                evaluation.silhouette_metrics([[0, 0]], prediction)

    def test_invalid_empty_ragged_and_wrong_resolution(self):
        for value in ([], [[]], [[1], [0, 0]], [[1]], None, "mask"):
            with self.subTest(value=value), self.assertRaises(evaluation.EvaluationError):
                evaluation.silhouette_metrics([[1, 0]], value)

    def test_nonfinite_nonbinary_and_coerced_values_rejected(self):
        for value in (float("nan"), float("inf"), -float("inf"), .5, 1.0, 2, -1, "1", None):
            with self.subTest(value=value), self.assertRaises(evaluation.EvaluationError):
                evaluation.silhouette_metrics([[1]], [[value]])

    def test_centroid_uses_both_axes(self):
        result = evaluation.silhouette_metrics([[1, 0], [0, 0]], [[0, 0], [0, 1]])
        self.assertEqual(result["centroidErrorPx"], math.sqrt(2))


class FrozenSeriesTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name in ("photo.png", "mask.png", "recipe.json", "render.png", "render-mask.png"):
            (self.root / name).write_bytes(("fixture-" + name).encode())

    def config(self, policy="fixture"):
        return {"seriesId": "fixture-series", "policy": policy, "camera": camera(policy),
                "photoPath": "photo.png", "maskPath": "mask.png", "rendererVersion": "5.2.0 LTS",
                "maskQuality": {"method": "synthetic_fixture" if policy == "fixture" else "manual_reviewed",
                                "accepted": True, "note": "Accepted synthetic test mask; no physical-image accuracy claim."},
                "note": "Protocol fixture only; not evidence of model or photographic accuracy."}

    def freeze(self, policy="fixture"):
        return evaluation.freeze_series(self.root, self.config(policy), "series.json")

    def test_frozen_camera_photo_mask_builder_hashes(self):
        series = self.freeze()
        self.assertEqual(series["photo"]["sha256"], evaluation.file_hash(self.root / "photo.png"))
        self.assertEqual(series["cameraHash"], evaluation.canonical_hash(series["camera"]))
        self.assertEqual(evaluation.load_series(self.root, "series.json"), series)

    def test_cannot_overwrite_frozen_series(self):
        self.freeze()
        with self.assertRaises(FileExistsError):
            self.freeze()

    def test_changed_mask_or_photo_invalidates_series(self):
        series = self.freeze()
        for name in ("photo.png", "mask.png"):
            original = (self.root / name).read_bytes()
            (self.root / name).write_bytes(b"changed")
            with self.subTest(name=name), self.assertRaises(evaluation.EvaluationError):
                evaluation.validate_series(self.root, series)
            (self.root / name).write_bytes(original)

    def test_changed_camera_metric_and_builder_rejected(self):
        original = self.freeze()
        for key in ("cameraHash", "builderHash", "seriesHash"):
            series = deepcopy(original)
            series[key] = "0" * 64
            with self.subTest(key=key), self.assertRaises(evaluation.EvaluationError):
                evaluation.validate_series(self.root, series)
        series = deepcopy(original)
        series["metric"]["maskThreshold"] = 1
        series["seriesHash"] = evaluation.canonical_hash({k: v for k, v in series.items() if k != "seriesHash"})
        with self.assertRaises(evaluation.EvaluationError):
            evaluation.validate_series(self.root, series)

    def test_missing_input_fails_explicitly(self):
        (self.root / "photo.png").unlink()
        with self.assertRaisesRegex(evaluation.EvaluationError, "Missing"):
            self.freeze()

    def test_traversal_absolute_path_symlink_escape_and_missing_input(self):
        with tempfile.TemporaryDirectory() as outside:
            source = Path(outside) / "outside.png"
            source.write_bytes(b"outside")
            (self.root / "escape.png").symlink_to(source)
            for value in ("../outside.png", str(source), "escape.png", "absent.png"):
                with self.subTest(value=value), self.assertRaises(evaluation.EvaluationError):
                    evaluation.confined_path(self.root, value)

    def test_output_symlink_escape_rejected(self):
        with tempfile.TemporaryDirectory() as outside:
            (self.root / "outputs").symlink_to(outside, target_is_directory=True)
            with self.assertRaises(evaluation.EvaluationError):
                evaluation.confined_path(self.root, "outputs/score.json", must_exist=False)

    def test_unknown_config_and_camera_fields_rejected(self):
        for mutate in (lambda c: c.update(extra="untrusted"),
                       lambda c: c["camera"].update(fitEachRevision=True)):
            config = self.config()
            mutate(config)
            with self.assertRaises(evaluation.EvaluationError):
                evaluation.freeze_series(self.root, config, "series.json")

    def test_camera_assumptions_and_acceptance_required(self):
        for mutate in (lambda c: c["quality"].update(assumptions=[]),
                       lambda c: c["quality"].update(accepted=False),
                       lambda c: c.update(targetM=c["positionM"]),
                       lambda c: c.update(lensMm=float("nan")),
                       lambda c: c.update(resolution=[True, 16]),
                       lambda c: c["quality"].update(alignmentResidualPx=float("inf"))):
            value = camera()
            mutate(value)
            with self.assertRaises(evaluation.EvaluationError):
                evaluation.validate_camera(value, "fixture")

    def test_synthetic_camera_cannot_be_real_test_or_validation(self):
        for policy in ("strict_test", "validation"):
            with self.assertRaises(evaluation.EvaluationError):
                evaluation.validate_camera(camera(), policy)

    def test_mask_quality_cannot_be_missing_unreviewed_or_synthetic_real_test(self):
        for value in ({}, {"method": "manual_reviewed", "accepted": False, "note": "Unreviewed"},
                      {"method": "synthetic_fixture", "accepted": True, "note": "Generated"}):
            with self.assertRaises(evaluation.EvaluationError):
                evaluation.validate_mask_quality(value, "strict_test")

    def test_strict_test_is_sealed_until_sequence_finalized(self):
        series = self.freeze("strict_test")
        with self.assertRaisesRegex(evaluation.EvaluationError, "sealed"):
            evaluation.validate_sequence(series, None, 0, evaluation.file_hash(self.root / "recipe.json"))
        sequence = evaluation.freeze_sequence(self.root, series, [{"revision": 0, "path": "recipe.json"}])
        evaluation.require_sequence_seal(self.root, series, sequence)
        self.assertEqual(evaluation.validate_sequence(series, sequence, 0, evaluation.file_hash(self.root / "recipe.json")),
                         evaluation.canonical_hash(sequence))

    def test_finalized_boolean_alone_does_not_unlock_strict_test(self):
        series = self.freeze("strict_test")
        sequence = {"schemaVersion": evaluation.SEQUENCE_SCHEMA, "seriesHash": series["seriesHash"],
                    "finalized": True, "revisions": [{"revision": 0, "recipeHash": evaluation.file_hash(self.root / "recipe.json")}]}
        with self.assertRaises(evaluation.EvaluationError):
            evaluation.require_sequence_seal(self.root, series, sequence)

    def test_strict_sequence_cannot_be_overwritten_or_extended(self):
        series = self.freeze("strict_test")
        records = [{"revision": 0, "path": "recipe.json"}]
        sequence = evaluation.freeze_sequence(self.root, series, records)
        with self.assertRaises(FileExistsError):
            evaluation.freeze_sequence(self.root, series, records)
        sequence["revisions"].append({"revision": 1, "recipeHash": "a" * 64})
        with self.assertRaises(evaluation.EvaluationError):
            evaluation.require_sequence_seal(self.root, series, sequence)

    def test_changed_recipe_or_revision_excluded_from_final_sequence(self):
        series = self.freeze("strict_test")
        sequence = evaluation.freeze_sequence(self.root, series, [{"revision": 0, "path": "recipe.json"}])
        for revision, sha in ((1, evaluation.file_hash(self.root / "recipe.json")), (0, "a" * 64)):
            with self.assertRaises(evaluation.EvaluationError):
                evaluation.validate_sequence(series, sequence, revision, sha)

    def test_validation_and_fixture_can_score_without_sequence(self):
        for policy in ("validation", "fixture"):
            self.assertIsNone(evaluation.validate_sequence({"policy": policy}, None, 0, "a" * 64))

    def test_duplicate_revisions_and_noninteger_revisions_rejected(self):
        series = self.freeze("strict_test")
        for records in ([{"revision": 0, "path": "recipe.json"}]*2,
                        [{"revision": True, "path": "recipe.json"}],
                        [{"revision": -1, "path": "recipe.json"}]):
            with self.assertRaises(evaluation.EvaluationError):
                evaluation.freeze_sequence(self.root, series, records)

    def score(self, series):
        return {"schemaVersion": evaluation.SCORE_SCHEMA, "seriesHash": series["seriesHash"],
                "revision": 0, "recipeHash": evaluation.file_hash(self.root / "recipe.json"),
                "sequenceHash": None, "runtime": "blender", "builder": series["builder"],
                "builderHash": series["builderHash"], "cameraHash": series["cameraHash"],
                "photoHash": series["photo"]["sha256"], "maskHash": series["mask"]["sha256"],
                "policy": series["policy"], "iou": .5, "ssim": None, "centroidErrorPx": 2,
                "metric": series["metric"], "renderer": series["renderer"]}

    def test_export_matches_contract_without_local_paths(self):
        series = self.freeze()
        result = evaluation.review_evaluation(series, [self.score(series)])
        self.assertEqual(result["status"], "complete")
        self.assertEqual(result["runtime"], "blender")
        self.assertEqual(result["policy"], "fixture")
        self.assertEqual(set(result), {"seriesId", "runtime", "builder", "builderHash", "cameraHash",
                                     "photoHash", "maskHash", "policy", "status", "note", "scores"})
        self.assertNotIn("path", json.dumps(result))
        self.assertEqual(evaluation.review_evaluation(series, [])["status"], "pending")

    def test_export_rejects_nonfinite_scores_and_wrong_native_identity(self):
        series = self.freeze()
        for key, value in (("iou", float("nan")), ("iou", 1.1), ("centroidErrorPx", float("inf")),
                           ("centroidErrorPx", -1), ("ssim", .8), ("revision", True),
                           ("runtime", "browser"), ("cameraHash", "a" * 64), ("recipeHash", "notsha")):
            score = self.score(series)
            score[key] = value
            with self.subTest(key=key), self.assertRaises(evaluation.EvaluationError):
                evaluation.review_evaluation(series, [score])

    def test_export_retains_optional_render_hash_and_older_records(self):
        series = self.freeze()
        score = self.score(series)
        self.assertNotIn("renderHash", evaluation.review_evaluation(series, [score])["scores"][0])
        score["renderHash"] = "ab" * 32
        self.assertEqual(evaluation.review_evaluation(series, [score])["scores"][0]["renderHash"], "ab" * 32)
        for invalid in (None, "AB" * 32, "a" * 63, "not-a-hash", 1):
            score["renderHash"] = invalid
            with self.subTest(value=invalid), self.assertRaises(evaluation.EvaluationError):
                evaluation.review_evaluation(series, [score])

    def test_strict_export_cannot_reveal_unfinalized_score(self):
        series = self.freeze("strict_test")
        with self.assertRaises(evaluation.EvaluationError):
            evaluation.review_evaluation(series, [self.score(series)])

    def test_json_duplicate_keys_and_nonfinite_rejected(self):
        for value in ('{"x": 1, "x": 2}', '{"x": NaN}', '{"x": Infinity}'):
            (self.root / "bad.json").write_text(value)
            with self.assertRaises(evaluation.EvaluationError):
                evaluation.read_json(self.root / "bad.json")


@unittest.skipIf(Image is None, "Pillow file tests require bundled workspace Python")
class ImageFileScoringTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        Image.new("RGB", (16, 16), (50, 75, 100)).save(self.root / "photo.png")
        Image.new("RGB", (16, 16), (50, 75, 100)).save(self.root / "render.png")
        for name in ("mask.png", "render-mask.png"):
            image = Image.new("L", (16, 16), 0)
            for x in range(4, 10):
                for y in range(2, 12):
                    image.putpixel((x, y), 255)
            image.save(self.root / name)
        (self.root / "recipe.json").write_text("{}")
        self.series = evaluation.freeze_series(self.root, FrozenSeriesTests.config(self), "series.json")

    def report(self):
        def record(name):
            return {"path": name, "sha256": evaluation.file_hash(self.root / name)}
        return {"schemaVersion": "fishy.heldout.render.v1", "seriesHash": self.series["seriesHash"],
                "revision": 0, "recipe": record("recipe.json"), "builderHash": self.series["builderHash"],
                "cameraHash": self.series["cameraHash"], "renderer": self.series["renderer"],
                "render": record("render.png"), "mask": record("render-mask.png"),
                "hardscapeIds": ["rock-1"], "sequenceHash": None}

    def test_actual_png_scoring_and_review_export(self):
        score = evaluation.score_revision(self.root, self.series, self.report())
        self.assertEqual(score["iou"], 1)
        self.assertEqual(score["referencePixels"], 60)
        self.assertEqual(evaluation.review_evaluation(self.series, [score])["scores"][0]["iou"], 1)

    def test_changed_render_recipe_or_mask_bytes_rejected(self):
        report = self.report()
        for name in ("render.png", "render-mask.png", "recipe.json"):
            original = (self.root / name).read_bytes()
            (self.root / name).write_bytes(b"changed")
            with self.subTest(name=name), self.assertRaises(evaluation.EvaluationError):
                evaluation.score_revision(self.root, self.series, report)
            (self.root / name).write_bytes(original)

    def test_colored_transparent_and_wrong_size_masks_rejected(self):
        for image in (Image.new("RGB", (16, 16), (255, 0, 0)),
                      Image.new("RGBA", (16, 16), (255, 255, 255, 0)),
                      Image.new("L", (8, 8), 255)):
            image.save(self.root / "invalid.png")
            with self.assertRaises(evaluation.EvaluationError):
                evaluation.image_mask(self.root / "invalid.png", [16, 16])

    def test_fixed_threshold(self):
        image = Image.new("L", (16, 16), 127)
        image.putpixel((0, 0), 128)
        image.save(self.root / "threshold.png")
        mask = evaluation.image_mask(self.root / "threshold.png", [16, 16])
        self.assertEqual(sum(sum(row) for row in mask), 1)

    def test_empty_prediction_file_keeps_zero_score(self):
        Image.new("L", (16, 16), 0).save(self.root / "render-mask.png")
        score = evaluation.score_revision(self.root, self.series, self.report())
        self.assertEqual(score["iou"], 0)
        self.assertEqual(score["predictionStatus"], "missing_hardscape")

    def test_missing_render_file_fails_explicitly(self):
        report = self.report()
        (self.root / "render.png").unlink()
        with self.assertRaises(evaluation.EvaluationError):
            evaluation.score_revision(self.root, self.series, report)

    def test_wrong_photo_resolution_prevents_score(self):
        Image.new("RGB", (8, 8)).save(self.root / "photo.png")
        config = FrozenSeriesTests.config(self)
        series = evaluation.freeze_series(self.root, config, "other-series.json")
        self.series = series
        with self.assertRaisesRegex(evaluation.EvaluationError, "resolutions differ"):
            evaluation.score_revision(self.root, series, self.report())


if __name__ == "__main__":
    unittest.main()
