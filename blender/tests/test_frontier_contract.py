"""Offline adversarial W1/W3 and final-transport evidence isolation checks."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import generate_scene as runner
from frontier_contract import (FrontierError, VERSION, accept_proposal, answer_request, load_generator_gate,
                               review_artifact, validate_observations, validate_review, canonical_hash, SNAPSHOT_VERSION)
from frontier_workflow import validate_answer_response
from native_snapshot import validate_snapshot
from scene_recipe import load_recipe


def protocol_fixture(outcome="resolved_changed"):
    previous = load_recipe(ROOT / "examples/recipe-example.json")
    wide = {"id": "obs-wide", "view": "front", "role": "reconstruction", "sha256": "a" * 64,
            "note": "Protocol fixture; not a real photograph", "objectIds": []}
    request = {"id": "request-r1-1", "objectId": "rock-01", "question": "Show a close-up of the main left stone.",
               "requestedView": "close_up", "why": "Its depth is uncertain in this protocol fixture.", "status": "requested"}
    requests, observations, answer = answer_request([request], [wide], request["id"], {"sha256": "b" * 64}, "close_up")
    recipe = deepcopy(previous)
    rock = next(o for o in recipe["objects"] if o["id"] == "rock-01")
    wood = next(o for o in recipe["objects"] if o["id"] == "wood-01")
    wood["position_m"][0] += 1  # Attempted protected override is deliberately out of bounds.
    if outcome == "resolved_changed":
        rock["position_m"][0] += 0.02
    proposal = {"schemaVersion": VERSION, "baseRevision": 1, "recipe": recipe,
                "objectEvidence": [{"objectId": o["id"], "observationIds": [answer["id"] if o["id"] == "rock-01" else wide["id"]], "inferred": False, "note": "Protocol fixture citation"} for o in previous["objects"]],
                "uncertainties": [], "resolutions": [{"requestId": request["id"], "status": outcome,
                                                       "explanation": "Close-up confirms the unchanged stone envelope." if outcome == "resolved_confirmed" else "The fixture exercises a cited changed or unresolved outcome.",
                                                       "observationIds": [answer["id"]]}]}
    return previous, observations, requests, proposal


def fixture_manifest(outcome="resolved_changed"):
    previous, observations, requests, proposal = protocol_fixture(outcome)
    accepted = accept_proposal(proposal, previous=previous, base_revision=1, observations=observations,
                               requests=requests, protected_ids=["wood-01"])
    accepted["sceneId"] = "fixture-native-tank"
    return {"run_id": "fixture-native-" + outcome, "created_at_utc": "2026-09-13T04:20:00Z", "status": "complete",
            "source": "imported_recipe", "model_calls_attempted": 0, "protocol_fixture": True,
            "frontier": {k: v for k, v in accepted.items() if k != "recipe"}}, accepted, proposal


class FrontierContractTests(unittest.TestCase):
    def test_native_snapshot_edit_provenance_is_explicit_and_backward_compatible(self):
        recipe = load_recipe(ROOT / "examples/recipe-example.json")
        objects = [{"id": obj["id"], "name": obj["label"], "meshHash": "a" * 64,
                    "matrix": [[int(row == column) for column in range(4)] for row in range(4)],
                    "protected": False} for obj in recipe["objects"]]
        snapshot = {"schemaVersion": SNAPSHOT_VERSION, "sceneId": "fixture-native", "baseRevision": 1,
                    "stateHash": canonical_hash({"recipe": recipe, "objects": objects}), "recipe": recipe,
                    "objects": objects, "protectedIds": [], "sourceRun": "/fixture/run", "blendPath": "current.blend",
                    "blendHash": "b" * 64, "capturedAt": "2026-09-13T04:00:00Z"}
        validate_snapshot(snapshot)  # Legacy captures remain readable without an invented source claim.
        for source in ("native_scene", "scripted_transform_fixture"):
            self.assertEqual(validate_snapshot({**snapshot, "editProvenance": source})["editProvenance"], source)
        for invalid in (None, True, "human_cursor_verified", ""):
            with self.subTest(invalid=invalid), self.assertRaisesRegex(FrontierError, "provenance"):
                validate_snapshot({**snapshot, "editProvenance": invalid})

    def test_changed_confirmed_and_unresolved_are_distinct_valid_outcomes(self):
        for outcome in ("resolved_changed", "resolved_confirmed", "request_unresolved"):
            with self.subTest(outcome=outcome):
                manifest, accepted, _ = fixture_manifest(outcome)
                review = review_artifact(manifest)
                self.assertEqual(review["provenance"], "protocol_fixture")
                self.assertEqual(review["requests"][0]["status"], outcome)
                self.assertEqual(len(review["changes"]), int(outcome == "resolved_changed"))
                self.assertEqual(review["protection"]["blockedAttempts"][0]["objectId"], "wood-01")
                self.assertEqual(accepted["revision"], 2)
                self.assertIsNone(review["browserProposal"])

    def test_protected_move_rotate_resize_asset_seed_and_delete_are_blocked(self):
        for field, value in (("position_m", [10, 10, 10]), ("yaw_deg", 120), ("size_m", [2, 2, 2]), ("asset", "rock"), ("seed", 999999), ("delete", None)):
            with self.subTest(field=field):
                previous, observations, requests, proposal = protocol_fixture()
                wood = next(o for o in proposal["recipe"]["objects"] if o["id"] == "wood-01")
                if field == "delete":
                    proposal["recipe"]["objects"].remove(wood)
                else:
                    wood[field] = value
                raw = deepcopy(proposal)
                accepted = accept_proposal(proposal, previous=previous, base_revision=1, observations=observations, requests=requests, protected_ids=["wood-01"])
                self.assertEqual(proposal, raw)
                expected = next(o for o in previous["objects"] if o["id"] == "wood-01")
                self.assertEqual(next(o for o in accepted["recipe"]["objects"] if o["id"] == "wood-01"), expected)
                self.assertTrue(accepted["protection"]["blockedAttempts"])

    def test_unprotected_invalid_geometry_duplicate_ids_and_stale_base_fail(self):
        previous, observations, requests, proposal = protocol_fixture()
        with self.assertRaises(ValueError):
            accept_proposal(proposal, previous=previous, base_revision=1, observations=observations, requests=requests)
        with self.assertRaisesRegex(FrontierError, "stale"):
            accept_proposal(proposal, previous=previous, base_revision=2, observations=observations, requests=requests, protected_ids=["wood-01"])
        proposal["recipe"]["objects"].append(deepcopy(proposal["recipe"]["objects"][0]))
        with self.assertRaises(ValueError):
            accept_proposal(proposal, previous=previous, base_revision=1, observations=observations, requests=requests, protected_ids=["wood-01"])

    def test_resolution_needs_matching_new_answer_and_real_change(self):
        previous, observations, requests, proposal = protocol_fixture("resolved_confirmed")
        proposal["resolutions"][0]["status"] = "resolved_changed"
        with self.assertRaisesRegex(FrontierError, "actual same-object"):
            accept_proposal(proposal, previous=previous, base_revision=1, observations=observations, requests=requests, protected_ids=["wood-01"])
        previous, observations, requests, proposal = protocol_fixture()
        proposal["resolutions"][0]["status"] = "resolved_confirmed"
        with self.assertRaisesRegex(FrontierError, "cannot conceal"):
            accept_proposal(proposal, previous=previous, base_revision=1, observations=observations, requests=requests, protected_ids=["wood-01"])
        proposal["resolutions"][0]["observationIds"] = ["obs-wide"]
        with self.assertRaisesRegex(FrontierError, "registered answer"):
            accept_proposal(proposal, previous=previous, base_revision=1, observations=observations, requests=requests, protected_ids=["wood-01"])

    def test_observation_identity_cannot_change_and_answers_need_requested_view(self):
        _, observations, requests, _ = protocol_fixture()
        changed = deepcopy(observations)
        changed[0]["sha256"] = "c" * 64
        with self.assertRaisesRegex(FrontierError, "immutable"):
            validate_observations(changed, observations)
        requests[0]["status"] = "requested"
        requests[0].pop("answerObservationId")
        with self.assertRaisesRegex(FrontierError, "view"):
            answer_request(requests, observations, requests[0]["id"], {"sha256": "c" * 64}, "left")

    def test_label_only_edit_cannot_claim_photo_resolved_geometry(self):
        previous, observations, requests, proposal = protocol_fixture("resolved_confirmed")
        proposal["resolutions"][0]["status"] = "resolved_changed"
        rock = next(obj for obj in proposal["recipe"]["objects"] if obj["id"] == "rock-01")
        rock["label"] = "More descriptive stone label"
        with self.assertRaisesRegex(FrontierError, "label edit is insufficient"):
            accept_proposal(proposal, previous=previous, base_revision=1, observations=observations,
                            requests=requests, protected_ids=["wood-01"])

    def test_targeted_answer_cannot_ground_neighbors_or_resolve_an_unanswered_request(self):
        previous, observations, requests, proposal = protocol_fixture()
        answer_id = requests[0]["answerObservationId"]
        next(item for item in proposal["objectEvidence"] if item["objectId"] == "wood-01")["observationIds"] = [answer_id]
        with self.assertRaisesRegex(FrontierError, "assigned to a different object"):
            accept_proposal(proposal, previous=previous, base_revision=1, observations=observations,
                            requests=requests, protected_ids=["wood-01"])
        previous, observations, requests, proposal = protocol_fixture()
        requests.append({"id": "unanswered-wood", "objectId": "wood-01", "question": "Show the wood from above.",
                         "requestedView": "top", "why": "Its branches obscure depth.", "status": "requested"})
        proposal["resolutions"].append({"requestId": "unanswered-wood", "status": "request_unresolved",
                                         "explanation": "No answer was supplied.", "observationIds": ["obs-wide"]})
        with self.assertRaisesRegex(FrontierError, "one answered request"):
            accept_proposal(proposal, previous=previous, base_revision=1, observations=observations,
                            requests=requests, protected_ids=["wood-01"])

    def test_historical_resolutions_do_not_block_later_revisions(self):
        manifest, accepted, _ = fixture_manifest()
        previous, observations, _, proposal = protocol_fixture("resolved_confirmed")
        proposal["baseRevision"] = 2
        proposal["recipe"] = deepcopy(accepted["recipe"])
        proposal["resolutions"] = []
        result = accept_proposal(proposal, previous=accepted["recipe"], base_revision=2, observations=observations,
                                 requests=manifest["frontier"]["requests"], protected_ids=["wood-01"])
        self.assertEqual(result["requests"], [])
        self.assertEqual(result["changes"], [])

    def test_release_allows_valid_later_transform(self):
        previous, observations, requests, proposal = protocol_fixture()
        wood = next(o for o in proposal["recipe"]["objects"] if o["id"] == "wood-01")
        wood["position_m"][0] = 0.33
        accepted = accept_proposal(proposal, previous=previous, base_revision=1, observations=observations, requests=requests, protected_ids=[])
        self.assertTrue(any(c["objectId"] == "wood-01" for c in accepted["changes"]))
        self.assertFalse(accepted["protection"]["blockedAttempts"])

    def test_uncited_inference_is_explicit_and_never_fabricates_a_photo_citation(self):
        previous, _, _, proposal = protocol_fixture()
        proposal["resolutions"] = []
        proposal["objectEvidence"] = [{"objectId": o["id"], "observationIds": [], "inferred": True, "note": "Explicit uncited protocol inference"} for o in previous["objects"]]
        accepted = accept_proposal(proposal, previous=previous, base_revision=1, observations=[], protected_ids=["wood-01"])
        self.assertEqual(accepted["changes"][0]["observationIds"], [])
        self.assertIs(accepted["changes"][0]["inferred"], True)
        manifest, _, _ = fixture_manifest()
        manifest["frontier"].update(changes=accepted["changes"], requests=[], observations=[])
        review = review_artifact(manifest)
        review["changes"][0].pop("inferred")
        with self.assertRaisesRegex(FrontierError, "marked as inference"):
            validate_review(review)

    def test_browser_response_binds_run_revision_photo_hash_name_and_object(self):
        _, observations, requests, _ = protocol_fixture()
        requests[0]["status"] = "requested"
        requests[0].pop("answerObservationId")
        manifest = {"run_id": "prior-run", "frontier": {"sceneId": "native-scene"}}
        record = {"original_name": "answer.png", "sha256": observations[1]["sha256"]}
        response = {"schemaVersion": "fishy.evidence.response.v1", "runId": "prior-run", "sceneId": "native-scene", "baseRevision": 1,
                    "requestId": requests[0]["id"], "observation": observations[1], "photoName": "answer.png"}
        validate_answer_response(response, prior_manifest=manifest, base_revision=1, requests=requests, photo_record=record)
        for mutate in (lambda r: r.update(baseRevision=0), lambda r: r.update(runId="other"),
                       lambda r: r["observation"].update(sha256="c" * 64), lambda r: r["observation"].update(objectIds=["wood-01"]),
                       lambda r: r.update(photoName="../answer.png")):
            candidate = deepcopy(response)
            mutate(candidate)
            with self.assertRaises(FrontierError):
                validate_answer_response(candidate, prior_manifest=manifest, base_revision=1, requests=requests, photo_record=record)


class TransportIsolationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="fishy-isolation-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.run = runner.new_run(self.root / "runs")
        image = self.root / "reconstruction.png"
        image.write_bytes(b"\x89PNG\r\n\x1a\nreconstruction")
        self.record = runner.copy_images([image], self.run)[0]

    def test_final_transport_rejects_renamed_heldout_bytes_and_changed_hash(self):
        policy = {"seriesId": "series", "policy": "fixture", "finalized": True,
                  "allowedReconstructionHashes": [self.record["sha256"]], "forbiddenHashes": [self.record["sha256"]]}
        runner.write_json(self.run / "transport-policy.json", policy)
        with self.assertRaisesRegex(runner.GenerationError, "Heldout"):
            runner.transport_images(self.run, [self.record])
        policy["forbiddenHashes"] = []
        runner.write_json(self.run / "transport-policy.json", policy)
        runner.transport_images(self.run, [self.record])
        (self.run / self.record["path"]).write_bytes(b"\x89PNG\r\n\x1a\nchanged")
        with self.assertRaisesRegex(runner.GenerationError, "registration"):
            runner.transport_images(self.run, [self.record])

    def test_final_transport_rejects_roles_outside_input_root_and_symlink_escape(self):
        for role in ("heldout", "mask", "evaluation_render", "score"):
            record = {**self.record, "role": role}
            with self.assertRaises(runner.GenerationError):
                runner.transport_images(self.run, [record])
        outside = self.root / "outside.png"
        outside.write_bytes((self.run / self.record["path"]).read_bytes())
        (self.run / self.record["path"]).unlink()
        (self.run / self.record["path"]).symlink_to(outside)
        with self.assertRaises(runner.GenerationError):
            runner.transport_images(self.run, [self.record])

    def test_both_transports_apply_final_loader_before_process_or_network(self):
        bad = {**self.record, "role": "heldout"}
        with mock.patch.object(runner.shutil, "which", return_value="codex"), mock.patch.object(runner.subprocess, "run") as process:
            with self.assertRaises(runner.GenerationError):
                runner.codex_generate(self.run, "prompt", [bad], 30)
            process.assert_not_called()
        with mock.patch.dict(runner.os.environ, {"OPENAI_API_KEY": "test-only"}), mock.patch.object(runner.urllib.request, "urlopen") as network:
            with self.assertRaises(runner.GenerationError):
                runner.api_generate(self.run, "prompt", [bad], 30)
            network.assert_not_called()

    def test_unfinalized_or_duplicate_split_bytes_fail_before_generation(self):
        gate = {"schemaVersion": "fishy.evaluation.split.v1", "seriesId": "fixture-series", "policy": "fixture", "finalized": True,
                "reconstruction": [{"id": "obs-a", "path": "reconstruction.png", "sha256": self.record["sha256"], "view": "front"}],
                "heldout": [{"sha256": "b" * 64}]}
        path = self.root / "generator-gate.json"
        runner.write_json(path, gate)
        load_generator_gate(path)
        gate["heldout"][0]["sha256"] = self.record["sha256"]
        runner.write_json(path, gate)
        with self.assertRaisesRegex(FrontierError, "both"):
            load_generator_gate(path)
        gate["finalized"] = False
        runner.write_json(path, gate)
        with self.assertRaisesRegex(FrontierError, "finalized"):
            load_generator_gate(path)

    def test_gated_codex_uses_private_checked_images_schema_and_os_boundary(self):
        runner.write_json(self.run / "transport-policy.json", {"seriesId": "test-series", "policy": "strict_test", "finalized": True,
                          "allowedReconstructionHashes": [self.record["sha256"]], "forbiddenHashes": ["b" * 64]})
        runner.write_json(self.run / "schema.json", {"type": "object"})
        expected_bytes = (self.run / self.record["path"]).read_bytes()

        def execute(command, **kwargs):
            self.assertEqual(command[0], "test-os-boundary")
            image = Path(command[command.index("--image") + 1])
            schema = Path(command[command.index("--output-schema") + 1])
            self.assertEqual(image.read_bytes(), expected_bytes)
            self.assertFalse(image.is_relative_to(self.run))
            self.assertFalse(schema.is_relative_to(self.run))
            self.assertEqual(Path(kwargs["cwd"]), image.parent)
            kwargs["stdout"].write('{"type":"turn.completed","usage":{}}\n')
            (self.run / "model-output.json").write_text('{}')
            return type("Result", (), {"returncode": 0})()

        with mock.patch.object(runner.shutil, "which", return_value="/test/codex"), \
             mock.patch.object(runner, "isolated_codex_command", side_effect=lambda command, workspace: ["test-os-boundary", *command]) as isolate, \
             mock.patch.object(runner.subprocess, "run", side_effect=execute):
            runner.codex_generate(self.run, "no evaluation data", [self.record], 30)
        isolate.assert_called_once()

    def test_gated_codex_fails_closed_when_os_isolation_is_unavailable(self):
        with mock.patch.object(runner.sys, "platform", "linux"):
            with self.assertRaisesRegex(runner.GenerationError, "workspace read isolation"):
                runner.isolated_codex_command(["codex"], self.root)


if __name__ == "__main__":
    unittest.main()
