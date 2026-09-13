"""Offline checks for model transport, provenance, and input boundaries.

No model, network, Blender process, or UI is invoked by these tests.
"""

from contextlib import redirect_stderr, redirect_stdout
from copy import deepcopy
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest import mock


BLENDER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BLENDER_DIR))
import generate_scene as runner  # noqa: E402
from scene_recipe import load_recipe, recipe_schema  # noqa: E402


PNG = b"\x89PNG\r\n\x1a\n" + b"signature-probe-fixture"


class RunnerTestCase(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="fishy-runner-tests-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.run = self.root / "run"
        self.run.mkdir()
        (self.run / "inputs").mkdir()
        self.fixture = load_recipe(BLENDER_DIR / "examples/recipe-example.json")
        runner.write_json(self.run / "schema.json", recipe_schema())

    def invoke_main(self, arguments):
        with mock.patch.object(sys, "argv", ["generate_scene.py"] + arguments), \
                redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
            return runner.main()

    def fake_generation(self, run, prompt, records, timeout):
        runner.write_json(run / "model-output.json", self.fixture)
        return {"usage": {"input_tokens": 100, "output_tokens": 50},
                "model_identity": "requested model; test transport"}

    @staticmethod
    def fake_build(run, manifest, blender):
        manifest["status"] = "complete"
        manifest["outputs"] = {"scene": "aquarium.blend"}
        runner.write_json(run / "manifest.json", manifest)


class ImageInputTests(RunnerTestCase):
    def test_signature_probe_ignores_extension_and_rejects_other_formats(self):
        fixtures = ((PNG, "image/png", ".png"),
                    (b"\xff\xd8\xfffake", "image/jpeg", ".jpg"),
                    (b"RIFF\x00\x00\x00\x00WEBPfake", "image/webp", ".webp"))
        for index, (data, mime, suffix) in enumerate(fixtures):
            path = self.root / f"file {index}.untrusted-extension"
            path.write_bytes(data)
            self.assertEqual(runner.check_image(path), (data, mime, suffix))
        for data in (b"GIF89a", b"%PDF-1.4", b"RIFF", b"plain text"):
            with self.subTest(data=data), self.assertRaises(runner.GenerationError):
                runner.image_type(data)

    def test_missing_empty_directory_and_over_limit_images_rejected(self):
        empty = self.root / "empty.png"
        empty.touch()
        for path in (empty, self.root / "missing.png", self.root):
            with self.subTest(path=path), self.assertRaises(runner.GenerationError):
                runner.check_image(path)
        path = self.root / "oversized.png"
        path.write_bytes(PNG)
        with mock.patch.object(runner, "MAX_IMAGE_BYTES", len(PNG) - 1):
            with self.assertRaises(runner.GenerationError):
                runner.check_image(path)
        with mock.patch.object(runner, "MAX_IMAGE_BYTES", len(PNG)):
            self.assertEqual(runner.check_image(path)[0], PNG)

    def test_read_is_bounded_and_rechecks_actual_length_after_stat(self):
        path = mock.MagicMock()
        path.name = "grew-after-stat.png"
        path.is_file.return_value = True
        path.stat.return_value = SimpleNamespace(st_size=8)
        reader = path.open.return_value.__enter__.return_value
        reader.read.return_value = PNG
        path.read_bytes.return_value = PNG
        with mock.patch.object(runner, "MAX_IMAGE_BYTES", len(PNG) - 1):
            with self.assertRaises(runner.GenerationError):
                runner.check_image(path)
        reader.read.assert_called_once_with(len(PNG))
        path.read_bytes.assert_not_called()

    def test_copy_records_actual_bytes_hash_role_and_relative_destination(self):
        path = self.root / "reference ; $(touch unwanted).png"
        path.write_bytes(PNG)
        records = runner.copy_images([path], self.run)
        self.assertEqual(len(records), 1)
        record = records[0]
        self.assertEqual(record["role"], "reference")
        self.assertEqual(record["original_name"], path.name)
        self.assertEqual(record["path"], "inputs/reference-1.png")
        self.assertEqual(record["sha256"], runner.hashlib.sha256(PNG).hexdigest())
        self.assertEqual(record["bytes"], len(PNG))
        self.assertEqual((self.run / record["path"]).read_bytes(), PNG)


class CodexTransportTests(RunnerTestCase):
    def fake_process(self, events, output=None, returncode=0):
        def process(command, **kwargs):
            for event in events:
                kwargs["stdout"].write(json.dumps(event) + "\n")
            if output is not None:
                (self.run / "model-output.json").write_text(output)
            self.assertNotIn("shell", kwargs)
            self.assertEqual(kwargs["input"], "brief passed through stdin")
            return SimpleNamespace(returncode=returncode)
        return process

    def invoke_codex(self, events, output=None, returncode=0):
        with mock.patch.object(runner.shutil, "which", return_value="/test/codex"), \
                mock.patch.object(runner.subprocess, "run", side_effect=self.fake_process(events, output, returncode)):
            return runner.codex_generate(self.run, "brief passed through stdin", [], 30)

    def test_paths_remain_separate_argv_values_and_prompt_comes_from_stdin(self):
        schema = Path("/tmp/schema ; $(touch x).json")
        image = Path("/tmp/image --disable protections.png")
        command = runner.codex_command("/fake/codex", schema, self.run / "result.json", [image], self.root)
        self.assertIsInstance(command, list)
        self.assertEqual(command[command.index("--output-schema") + 1], str(schema))
        self.assertEqual(command[command.index("--image") + 1], str(image))
        self.assertEqual(command[command.index("--model") + 1], "gpt-6-astra")
        self.assertEqual(command[command.index("--sandbox") + 1], "read-only")
        self.assertEqual(command[-1], "-")
        for feature in ("shell_tool", "unified_exec", "apps", "plugins", "multi_agent"):
            index = command.index(feature)
            self.assertEqual(command[index - 1], "--disable")

    def test_completed_turn_returns_usage_and_preserves_model_output(self):
        usage = {"input_tokens": 120, "output_tokens": 80}
        recipe_text = json.dumps(self.fixture)
        metadata = self.invoke_codex([{"type": "turn.completed", "usage": usage}], recipe_text)
        self.assertEqual(metadata["usage"], usage)
        self.assertIsNone(metadata["cost_usd"])
        self.assertIn("requested model", metadata["model_identity"])
        self.assertEqual((self.run / "model-output.json").read_text(), recipe_text)

    def test_failure_incomplete_and_missing_output_are_rejected(self):
        cases = (
            ([{"type": "turn.failed", "error": {"message": "failure"}}], "{}", 0),
            ([{"type": "turn.started"}], "{}", 0),
            ([], "{}", 0),
            ([{"type": "turn.completed"}], None, 0),
            ([{"type": "turn.completed"}], "{}", 1),
            ([{"type": "turn.completed"}, {"type": "turn.failed"}], "{}", 0),
        )
        for index, (events, output, code) in enumerate(cases):
            with self.subTest(case=index):
                (self.run / "model-output.json").unlink(missing_ok=True)
                with self.assertRaises(runner.GenerationError):
                    self.invoke_codex(events, output, code)

    def test_timeout_makes_no_retry(self):
        with mock.patch.object(runner.shutil, "which", return_value="/test/codex"), \
                mock.patch.object(runner.subprocess, "run", side_effect=subprocess.TimeoutExpired("codex", 30)) as request:
            with self.assertRaisesRegex(runner.GenerationError, "no automatic retry"):
                runner.codex_generate(self.run, "prompt", [], 30)
        self.assertEqual(request.call_count, 1)


class ApiTransportTests(RunnerTestCase):
    def invoke_api(self, document):
        with mock.patch.dict(runner.os.environ, {"OPENAI_API_KEY": "offline-test-secret"}), \
                mock.patch.object(runner.urllib.request, "urlopen", return_value=io.BytesIO(json.dumps(document).encode())) as request:
            metadata = runner.api_generate(self.run, "test brief", [], 30)
        return metadata, request.call_args.args[0]

    def test_completed_response_preserves_returned_model_usage_and_output(self):
        document = {"status": "completed", "id": "resp_test", "model": "gpt-6-astra-test-snapshot",
                    "usage": {"input_tokens": 100, "output_tokens": 70},
                    "output": [{"type": "message", "content": [{"type": "output_text", "text": json.dumps(self.fixture)}]}]}
        metadata, request = self.invoke_api(document)
        self.assertEqual(metadata["returned_model"], document["model"])
        self.assertEqual(metadata["response_id"], "resp_test")
        self.assertEqual(metadata["usage"], document["usage"])
        self.assertIsNone(metadata["cost_usd"])
        self.assertEqual(json.loads((self.run / "model-output.json").read_text()), self.fixture)
        payload = json.loads(request.data)
        self.assertEqual(request.full_url, "https://api.openai.com/v1/responses")
        self.assertFalse(payload["store"])
        self.assertEqual(payload["model"], "gpt-6-astra")
        self.assertNotIn("tools", payload)
        self.assertNotIn("offline-test-secret", (self.run / "model-response.json").read_text())

    def test_incomplete_and_refusal_responses_do_not_create_model_output(self):
        documents = (
            {"status": "incomplete", "output": [{"type": "message", "content": [{"type": "output_text", "text": "{}"}]}]},
            {"status": "failed", "output": []},
            {"status": "completed", "output": [{"type": "message", "content": [{"type": "refusal", "refusal": "Cannot comply"}]}]},
        )
        for document in documents:
            with self.subTest(status=document["status"]), self.assertRaises(runner.GenerationError):
                self.invoke_api(document)
            self.assertFalse((self.run / "model-output.json").exists())
            self.assertTrue((self.run / "model-response.json").exists())


class OrchestrationTests(RunnerTestCase):
    def test_imported_recipe_has_unknown_manual_provenance_and_no_model_call(self):
        imported = self.root / "imported.json"
        runner.write_json(imported, self.fixture)
        runs = self.root / "build-runs"
        with mock.patch.object(runner, "codex_generate") as codex, \
                mock.patch.object(runner, "api_generate") as api, \
                mock.patch.object(runner, "build_run", side_effect=self.fake_build):
            result = self.invoke_main(["build", "--recipe", str(imported), "--run-root", str(runs)])
        self.assertEqual(result, 0)
        codex.assert_not_called()
        api.assert_not_called()
        manifest = json.loads(next(runs.glob("*/manifest.json")).read_text())
        self.assertEqual(manifest["source"], "imported_recipe")
        self.assertIsNone(manifest["manual_recipe_edits"])
        self.assertEqual(manifest["model_calls_attempted"], 0)
        self.assertNotIn("requested_model", manifest)

    def test_generated_run_records_actual_input_and_model_attempt(self):
        image = self.root / "source.png"
        image.write_bytes(PNG)
        runs = self.root / "generated-runs"
        with mock.patch.object(runner, "codex_generate", side_effect=self.fake_generation) as request, \
                mock.patch.object(runner, "build_run", side_effect=self.fake_build):
            result = self.invoke_main(["generate", "--image", str(image), "--run-root", str(runs)])
        self.assertEqual(result, 0)
        self.assertEqual(request.call_count, 1)
        manifest = json.loads(next(runs.glob("*/manifest.json")).read_text())
        self.assertEqual(manifest["source"], "model_generated")
        self.assertFalse(manifest["manual_recipe_edits"])
        self.assertEqual(manifest["model_calls_attempted"], 1)
        self.assertEqual(manifest["requested_model"], "gpt-6-astra")
        self.assertEqual(manifest["dimensions_source"], "assumed")
        self.assertEqual(manifest["inputs"][0]["sha256"], runner.hashlib.sha256(PNG).hexdigest())
        self.assertIn("No independent", manifest["evaluation"])

    def test_invalid_model_recipe_is_retained_without_build_or_retry(self):
        image = self.root / "source.png"
        image.write_bytes(PNG)
        runs = self.root / "invalid-runs"

        def invalid_generation(run, *unused):
            invalid = deepcopy(self.fixture)
            invalid["tank"]["width_m"] = 0.7
            runner.write_json(run / "model-output.json", invalid)
            return {"usage": {"output_tokens": 20}}

        with mock.patch.object(runner, "codex_generate", side_effect=invalid_generation) as request, \
                mock.patch.object(runner, "build_run") as build:
            result = self.invoke_main(["generate", "--image", str(image), "--run-root", str(runs)])
        self.assertEqual(result, 1)
        self.assertEqual(request.call_count, 1)
        build.assert_not_called()
        run = next(runs.iterdir())
        manifest = json.loads((run / "manifest.json").read_text())
        self.assertEqual(manifest["status"], "failed")
        self.assertTrue((run / "model-output.json").exists())
        self.assertFalse((run / "recipe.json").exists())

    def make_prior(self, name):
        prior = self.root / name
        (prior / "inputs").mkdir(parents=True)
        (prior / "renders").mkdir()
        for path in (prior / "inputs/reference-1.png", prior / "renders/front.png", prior / "renders/overview.png"):
            path.write_bytes(PNG)
        runner.write_json(prior / "recipe.json", self.fixture)
        manifest = {"status": "complete", "dimensions_source": "assumed",
                    "inputs": [{"role": "reference", "path": "inputs/reference-1.png",
                                "original_name": "source.png", "mime": "image/png",
                                "bytes": len(PNG), "sha256": runner.hashlib.sha256(PNG).hexdigest()}]}
        runner.write_json(prior / "manifest.json", manifest)
        return prior, manifest

    def test_revision_references_and_renders_are_confined_to_prior_run(self):
        outside = self.root / "outside.png"
        outside.write_bytes(PNG)
        cases = ("traversal", "absolute", "reference_symlink", "front_symlink", "overview_symlink")
        for case in cases:
            with self.subTest(case=case):
                prior, manifest = self.make_prior("prior-" + case)
                if case == "traversal":
                    manifest["inputs"][0]["path"] = "../outside.png"
                elif case == "absolute":
                    manifest["inputs"][0]["path"] = str(outside)
                else:
                    relative = {"reference_symlink": "inputs/reference-1.png", "front_symlink": "renders/front.png", "overview_symlink": "renders/overview.png"}[case]
                    linked = prior / relative
                    linked.unlink()
                    linked.symlink_to(outside)
                runner.write_json(prior / "manifest.json", manifest)
                with mock.patch.object(runner, "codex_generate", side_effect=self.fake_generation) as request, \
                        mock.patch.object(runner, "build_run", side_effect=self.fake_build) as build:
                    result = self.invoke_main(["generate", "--revise-run", str(prior), "--run-root", str(self.root / ("runs-" + case))])
                self.assertEqual(result, 1)
                request.assert_not_called()
                build.assert_not_called()

    def test_revision_manifest_and_recipe_symlinks_cannot_escape_prior_run(self):
        for filename in ("manifest.json", "recipe.json"):
            with self.subTest(filename=filename):
                prior, _ = self.make_prior("prior-" + filename)
                target = self.root / ("outside-" + filename)
                source = prior / filename
                target.write_bytes(source.read_bytes())
                source.unlink()
                source.symlink_to(target)
                with mock.patch.object(runner, "codex_generate", side_effect=self.fake_generation) as request, \
                        mock.patch.object(runner, "build_run", side_effect=self.fake_build) as build:
                    result = self.invoke_main(["generate", "--revise-run", str(prior), "--run-root", str(self.root / ("runs-" + filename))])
                self.assertEqual(result, 1)
                request.assert_not_called()
                build.assert_not_called()

    def test_valid_revision_retains_tank_and_supplies_prior_recipe_and_renders(self):
        prior, _ = self.make_prior("valid-prior")
        runs = self.root / "revision-runs"
        with mock.patch.object(runner, "codex_generate", side_effect=self.fake_generation) as request, \
                mock.patch.object(runner, "build_run", side_effect=self.fake_build):
            result = self.invoke_main(["generate", "--revise-run", str(prior), "--run-root", str(runs)])
        self.assertEqual(result, 0)
        self.assertEqual(request.call_count, 1)
        call_run, prompt, records, _ = request.call_args.args
        self.assertEqual([r["role"] for r in records], ["reference", "previous_render", "previous_render"])
        self.assertIn("This is a revision", prompt)
        self.assertEqual(json.loads((call_run / "previous-recipe.json").read_text()), self.fixture)
        manifest = json.loads((call_run / "manifest.json").read_text())
        self.assertEqual(manifest["revision_of"], prior.name)
        self.assertEqual(manifest["tank"], self.fixture["tank"])


if __name__ == "__main__":
    unittest.main()
