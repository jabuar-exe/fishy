"""Export clearly labelled W1/W3 protocol fixtures; never makes a model call."""
import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "tests"))
from test_frontier_contract import fixture_manifest
from frontier_contract import review_artifact


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=False)
    for outcome in ("resolved_changed", "resolved_confirmed", "request_unresolved"):
        directory = args.output / outcome
        directory.mkdir()
        manifest, accepted, raw = fixture_manifest(outcome)
        for name, value in (("manifest.json", manifest), ("raw-proposal.json", raw), ("recipe.json", accepted["recipe"]), ("frontier-review.json", review_artifact(manifest))):
            (directory / name).write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")
    print(args.output.resolve())


if __name__ == "__main__":
    main()
