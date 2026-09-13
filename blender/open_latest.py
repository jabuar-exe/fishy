"""Open the most recent successful Astra design in a separate Blender instance."""
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
BLENDER = Path.home() / "Applications/Blender.app/Contents/MacOS/Blender"


def latest_scene():
    for path in sorted((ROOT / "runs").glob("*/manifest.json"), reverse=True):
        try:
            manifest = json.loads(path.read_text())
            scene = path.parent / "aquarium.blend"
            if (manifest.get("status") == "complete" and manifest.get("source") == "model_generated"
                    and scene.is_file() and scene.resolve().is_relative_to((ROOT / "runs").resolve())):
                return scene
        except (OSError, ValueError):
            continue
    raise FileNotFoundError("No completed Astra design exists yet. Open Fishy and generate one from a photo.")


if __name__ == "__main__":
    try:
        scene = latest_scene()
        subprocess.Popen([str(BLENDER), str(scene), "--python", str(ROOT / "fishy_controls.py"),
                          "--python", str(ROOT / "fishy_generation.py")],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        print(f"Opened {scene}")
    except OSError as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
