"""Opt-in real Blender raster/visibility integration test (no model calls).

FISHY_RUN_NATIVE_EVALUATION_TESTS=1 bundled-python -m unittest discover \
    -s blender/tests -p test_render_heldout_native.py -v
"""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

BLENDER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BLENDER_DIR))
import heldout_evaluation as evaluation

try:
    from PIL import Image
except ImportError:
    Image = None


@unittest.skipUnless(os.environ.get("FISHY_RUN_NATIVE_EVALUATION_TESTS") == "1" and Image is not None,
                     "Opt-in native render test requires Blender and bundled Python/Pillow")
class NativeFrozenRenderTests(unittest.TestCase):
    def test_exact_rerender_and_plant_occlusion_with_one_camera(self):
        binary = Path(os.environ.get("FISHY_BLENDER_BIN", "/Users/joshuabanzon/Applications/Blender.app/Contents/MacOS/Blender"))
        self.assertTrue(binary.is_file(), "Blender executable is missing")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            recipe = json.loads((BLENDER_DIR / "examples/recipe-example.json").read_text())
            (root / "recipe.json").write_text(json.dumps(recipe))
            Image.new("RGB", (128, 96), (0, 0, 0)).save(root / "photo.png")
            Image.new("L", (128, 96), 255).save(root / "mask.png")
            config = {"seriesId": "native-visibility-fixture", "policy": "fixture",
                      "camera": {"projection": "orthographic", "positionM": [.3, -1.5, .35],
                                 "targetM": [.3, .15, .2], "lensMm": 50, "sensorWidthMm": 36,
                                 "orthoScaleM": .75, "shiftX": 0, "shiftY": 0, "resolution": [128, 96],
                                 "quality": {"method": "synthetic_fixture", "accepted": True,
                                             "alignmentResidualPx": None,
                                             "assumptions": ["Synthetic authored camera; no physical calibration claim."]}},
                      "photoPath": "photo.png", "maskPath": "mask.png",
                      "maskQuality": {"method": "synthetic_fixture", "accepted": True,
                                      "note": "Native object-identity mask fixture."},
                      "rendererVersion": "5.2.0 LTS", "note": "Native fixture only, not a model run."}
            evaluation.freeze_series(root, config, "bootstrap-series.json")

            def render(series_path, recipe_path, revision, output):
                result = subprocess.run([str(binary), "--background", "--factory-startup", "--python-exit-code", "1",
                                         "--python", str(BLENDER_DIR / "render_heldout.py"), "--", "--root", str(root),
                                         "--series", series_path, "--recipe", recipe_path, "--revision", str(revision),
                                         "--output-dir", output], text=True, capture_output=True, timeout=90)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                return evaluation.read_json(root / output / "render-report.json")

            bootstrap = render("bootstrap-series.json", "recipe.json", 0, "bootstrap")
            shutil.copy2(root / bootstrap["render"]["path"], root / "reference.png")
            shutil.copy2(root / bootstrap["mask"]["path"], root / "reference-mask.png")
            config.update(photoPath="reference.png", maskPath="reference-mask.png")
            series = evaluation.freeze_series(root, config, "series.json")
            baseline = render("series.json", "recipe.json", 0, "baseline")
            score = evaluation.score_revision(root, series, baseline)
            self.assertEqual(score["iou"], 1)
            self.assertEqual(score["centroidErrorPx"], 0)
            self.assertEqual(baseline["hardscapeIds"], ["rock-01", "rock-02", "wood-01"])
            # PNG metadata can differ between processes; the frozen raster must
            # match exactly. Each actual file still keeps its own SHA identity.
            with Image.open(root / baseline["mask"]["path"]) as left, Image.open(root / bootstrap["mask"]["path"]) as right:
                self.assertEqual(left.convert("RGB").tobytes(), right.convert("RGB").tobytes())
            recipe["objects"] = [item for item in recipe["objects"] if item["asset"] in ("rock", "branchwood")]
            (root / "no-plants.json").write_text(json.dumps(recipe))
            no_plants = render("series.json", "no-plants.json", 1, "no-plants")
            actual = evaluation.image_mask(root / baseline["mask"]["path"], [128, 96])
            unoccluded = evaluation.image_mask(root / no_plants["mask"]["path"], [128, 96])
            self.assertGreater(sum(map(sum, unoccluded)), sum(map(sum, actual)), "Plants must occlude hardscape in the ID pass")
            self.assertTrue(all(a <= b for row_a, row_b in zip(actual, unoccluded) for a, b in zip(row_a, row_b)))
            self.assertEqual(baseline["cameraHash"], no_plants["cameraHash"])
            with Image.open(root / baseline["mask"]["path"]) as image:
                self.assertLessEqual(set(image.convert("L").tobytes()), {0, 255}, "Mask pass must be flat object identity, without material shading")


if __name__ == "__main__":
    unittest.main()
