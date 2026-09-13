"""Evaluate exactly two finalized recipes. This script never calls a model.

Arguments are repository-relative recipe paths and their already-finalized byte
hashes. Do not run until the reconstruction owner declares the sequence complete.
"""
from pathlib import Path
import argparse
import json
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[3]
sys.path.insert(0, str(REPO / "blender"))
from heldout_evaluation import (confined_path, file_hash, freeze_sequence, load_series,
                                read_json, review_evaluation, score_revision, write_new_json)
from PIL import Image, ImageDraw


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--initial-recipe", required=True)
    parser.add_argument("--initial-hash", required=True)
    parser.add_argument("--revision-recipe", required=True)
    parser.add_argument("--revision-hash", required=True)
    parser.add_argument("--initial-run", required=True)
    parser.add_argument("--revision-run", required=True)
    options = parser.parse_args()
    series = load_series(ROOT, "series.json")
    sources = [(options.initial_recipe, options.initial_hash), (options.revision_recipe, options.revision_hash)]
    recipes = []
    for relative, expected in sources:
        source = confined_path(REPO, relative)
        if file_hash(source) != expected:
            raise ValueError("A recipe differs from its owner-finalized hash")
        data = read_json(source)
        if data.get("tank") != {"width_m": .6, "depth_m": .3, "height_m": .36, "substrate_depth_m": .03}:
            raise ValueError("Recipe tank differs from the unchanged assumed geometry")
        recipes.append(source)
    snapshot = ROOT / "recipes"
    snapshot.mkdir(exist_ok=False)
    records = []
    for index, (source, (_, expected)) in enumerate(zip(recipes, sources)):
        revision = index + 1  # Trusted native accepted revisions, confirmed by run owner.
        destination = snapshot / f"revision-{revision}.json"
        shutil.copy2(source, destination)
        if file_hash(destination) != expected or file_hash(source) != expected:
            raise ValueError("Recipe changed while copying the finalized sequence")
        records.append({"revision": revision, "path": str(destination.relative_to(ROOT))})
    sequence = freeze_sequence(ROOT, series, records)
    sequence_path = "sequence-seals/" + series["seriesHash"] + ".json"
    write_new_json(ROOT / "finalized-run-lineage.json", {
        "sequenceFinalizedBeforeEvaluation": True,
        "initialRun": options.initial_run,
        "revisionRun": options.revision_run,
        "acceptedRecipes": [{"revision": index + 1, "sourcePath": sources[index][0], "recipeHash": sources[index][1]}
                            for index in (0, 1)],
        "revisionPolicy": "Initial + exactly one reconstruction/own-render-guided revision; no heldout feedback",
        "seriesHash": series["seriesHash"],
    })
    scores = []
    binary = "/Users/joshuabanzon/Applications/Blender.app/Contents/MacOS/Blender"
    for index, record in enumerate(records):
        revision = record["revision"]
        command = [binary, "--background", "--factory-startup", "--python-exit-code", "1",
                   "--python", str(REPO / "blender/render_heldout.py"), "--", "--root", str(ROOT),
                   "--series", "series.json", "--sequence", sequence_path,
                   "--recipe", record["path"], "--revision", str(revision), "--output-dir", f"revision-{revision}"]
        result = subprocess.run(command, text=True, capture_output=True, timeout=180)
        (ROOT / f"revision-{revision}.log").write_text(result.stdout + "\n" + result.stderr)
        if result.returncode:
            raise RuntimeError(result.stdout + result.stderr)
        report = read_json(ROOT / f"revision-{revision}/render-report.json")
        score = score_revision(ROOT, series, report, sequence)
        write_new_json(ROOT / f"revision-{revision}/score.json", score)
        scores.append(score)
    exported = review_evaluation(series, scores, sequence=sequence, root=ROOT)
    write_new_json(ROOT / "review-evaluation.json", exported)
    summary = {"status": "complete", "provenance": "recorded_model_run", "seriesId": series["seriesId"],
               "note": series["note"], "modelCallsByEvaluator": 0,
               "initialRun": options.initial_run, "revisionRun": options.revision_run,
               "scores": exported["scores"], "iouDelta": scores[1]["iou"] - scores[0]["iou"],
               "calibrated": False, "actualTankDimensionsKnown": False,
               "sourceFramesMayBeRehosted": False, "cameraOrMaskChangedAfterGeneration": False}
    write_new_json(ROOT / "result-summary.json", summary)
    # Only native generated images appear in the distributable comparison. The
    # source photograph, reference mask and annotations remain private.
    public = Image.new("RGB", (1280, 416), "#edf0ed")
    draw = ImageDraw.Draw(public)
    for index in (0, 1):
        revision = scores[index]["revision"]
        draw.text((index*640 + 12, 10), f"Native revision {revision}: exploratory IoU {scores[index]['iou']:.6f}", fill="black")
        public.paste(Image.open(ROOT / f"revision-{revision}/render.png").convert("RGB"), (index*640, 32))
    draw.text((12, 398), "Assumed tank geometry; manual camera; uncalibrated. This is a native render comparison, not the source video.", fill="black")
    public.save(ROOT / "native-render-comparison.png")
    private = Image.new("RGB", (1920, 784), "#edf0ed")
    draw = ImageDraw.Draw(private)
    labels = ["PRIVATE heldout source and manual mask", "Native initial reconstruction", "Native one-revision result"]
    photos = ["heldout/photo.png", "revision-1/render.png", "revision-2/render.png"]
    masks = ["heldout/visible-hardscape-mask.png", "revision-1/hardscape-mask.png", "revision-2/hardscape-mask.png"]
    for index in range(3):
        draw.text((index*640 + 12, 10), labels[index], fill="black")
        private.paste(Image.open(ROOT / photos[index]).convert("RGB"), (index*640, 32))
        private.paste(Image.open(ROOT / masks[index]).convert("RGB"), (index*640, 410))
    private.save(ROOT / "heldout/private-evaluation-comparison.png")
    status = read_json(ROOT / "status.json")
    status.update(status="complete_exploratory", pending=[], evaluation="review-evaluation.json",
                  realPhotoScores=exported["scores"], note=series["note"])
    (ROOT / "status.json").write_text(json.dumps(status, indent=2, allow_nan=False) + "\n")
    (ROOT.parent / "real-photo-status.json").write_text(json.dumps(status, indent=2, allow_nan=False) + "\n")
    print(json.dumps(summary, indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
