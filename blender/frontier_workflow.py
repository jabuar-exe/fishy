"""One-request local frontier runner, reusing existing model/Blender transports."""
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil
import sys
import time
import uuid

from frontier_contract import (FrontierError, accept_proposal, answer_request, canonical_hash,
                               exact, load_json, load_generator_gate, proposal_schema,
                               register_observation, review_artifact, validate_observations)
from scene_recipe import load_recipe
from native_snapshot import validate_snapshot


def rebuild_recorded_run(options, runner):
    """New immutable renderer run for legacy recipes; never claims a model call."""
    run, manifest = None, {}
    try:
        prior = options.from_run.expanduser().resolve()
        upstream = load_json(runner.prior_file(prior, "manifest.json"))
        if upstream.get("status") != "complete":
            raise FrontierError("Rebuild needs a completed source run")
        if upstream.get("native_snapshot"):
            raise FrontierError("Rebuild of a preserved native snapshot needs its exact adapter; use the existing result")
        recipe = load_recipe(runner.prior_file(prior, "recipe.json"))
        run = runner.new_run(options.run_root)
        print(f"RUN_DIR={run}", flush=True)
        records = []
        for index, original in enumerate(upstream.get("inputs", [])):
            if original.get("role") != "reference":
                continue
            source = runner.prior_file(prior, original["path"])
            data, _, _ = runner.check_image(source)
            if hashlib.sha256(data).hexdigest() != original["sha256"]:
                raise FrontierError("Source reference differs from its recorded hash")
            record = runner.copy_images([source], run, f"reference-{index}")[0]
            record.update(role="reference", original_name=original["original_name"])
            if original.get("observation_id"):
                record["observation_id"] = original["observation_id"]
            records.append(record)
        manifest = {"run_id": run.name, "created_at_utc": datetime.now(timezone.utc).isoformat(), "status": "validated",
                    "source": "imported_recipe", "model_calls_attempted": 0, "manual_recipe_edits": False,
                    "rebuilt_from": prior.name, "inputs": records, "tank": recipe["tank"], "objects": len(recipe["objects"]),
                    "dimensions_source": upstream.get("dimensions_source", "assumed"), "cost_usd": None,
                    "evaluation": "Renderer rebuild only; no new model generation or evaluation occurred."}
        if upstream.get("frontier"):
            manifest["frontier"] = deepcopy(upstream["frontier"])
        for name in ("transport-policy.json",):
            source = runner.prior_file(prior, name)
            if source.is_file():
                runner.write_json(run / name, load_json(source))
        runner.write_json(run / "upstream-manifest.json", upstream)
        runner.write_json(run / "recipe.json", recipe)
        runner.write_json(run / "manifest.json", manifest)
        runner.build_run(run, manifest, options.blender)
        if manifest.get("frontier"):
            manifest["outputs"]["frontier_review"] = "frontier-review.json"
            runner.write_json(run / "frontier-review.json", review_artifact(manifest))
        runner.write_json(run / "manifest.json", manifest)
        print(f"COMPLETE={run / 'aquarium.blend'}", flush=True)
        return 0
    except (ValueError, OSError, KeyError, TypeError) as exc:
        if run:
            manifest.update(status="failed", error=str(exc))
            runner.write_json(run / "manifest.json", manifest)
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


def validate_answer_response(value, *, prior_manifest, base_revision, requests, photo_record):
    exact(value, ("schemaVersion", "runId", "sceneId", "baseRevision", "requestId", "observation", "photoName"), path="photo response")
    state = prior_manifest.get("frontier", {})
    if value["schemaVersion"] != "fishy.evidence.response.v1" or value["runId"] != prior_manifest["run_id"] or value["sceneId"] != state.get("sceneId") or type(value["baseRevision"]) is not int or value["baseRevision"] != base_revision:
        raise FrontierError("Photo response belongs to a different or stale native run/revision")
    if type(value["photoName"]) is not str or not 1 <= len(value["photoName"]) <= 160 or Path(value["photoName"]).name != value["photoName"] or any(ord(c) < 32 for c in value["photoName"]):
        raise FrontierError("Photo response name must be a bounded display basename")
    # Browser display labels may be normalized/truncated; exact selected bytes
    # are bound by SHA256 below, rather than trusting a filename as identity.
    observation = value["observation"]
    validate_observations([observation])
    request = next((r for r in requests if r["id"] == value["requestId"]), None)
    if request is None or request["status"] not in ("requested", "request_unresolved"):
        raise FrontierError("Photo response does not answer a pending request")
    if observation["sha256"] != photo_record["sha256"] or observation["view"] != request["requestedView"] or observation["objectIds"] != [request["objectId"]]:
        raise FrontierError("Photo response bytes/view/object do not match the request")
    return value


def frontier_prompt(base_prompt, *, base_revision, observations, requests, protected_ids, previous):
    return base_prompt + "\n\n" + "\n\n".join([
        "Return the frontier proposal envelope matching the supplied schema. Put the aquarium recipe in recipe. baseRevision must echo " + str(base_revision) + "; you cannot assign the accepted revision.",
        "Registered reconstruction observations (immutable, available in the image order above): " + json.dumps(observations, ensure_ascii=False),
        "Every effective object needs one objectEvidence entry: cite only registered observation IDs; without a photo citation, inferred must be true. A citation records your explanation, not measured geometric correctness.",
        "Citation scope is strict: an observation with nonempty objectIds may be cited ONLY for those exact object IDs. An observation with objectIds=[] is scene-wide. A close-up registered for one stone must not be cited for neighboring plants or rocks even if they are visible; use their scene-wide references or explicit uncited inference instead.",
        "Current photo requests: " + json.dumps(requests, ensure_ascii=False),
        "For an answered request, return a resolution citing its answer observation. resolved_changed requires a real change to that same object AND its objectEvidence must cite the answer. resolved_confirmed means unchanged geometry plus an explicit confirming explanation. request_unresolved honestly records insufficient/contradictory evidence. Do not invent a movement just because a photo was supplied.",
        "The resolutions array may target ONLY requests whose current status is answered. Do not emit any resolution for requested or request_unresolved requests without a new answer; those remain pending automatically, even if you wish to explain that no answer was supplied.",
        "Return at most " + str(max(0, 2 - len(requests))) + " new uncertainties, each naming one existing effective object and a useful requested view (front/left/right/top/close_up). Ask only where another real photo would clarify depth/occlusion/shape. Empty uncertainties is valid if no useful request remains.",
        "Authoritative human-protected object IDs: " + json.dumps(list(protected_ids)) + ". Preserve all of their fields and IDs. Native acceptance enforces these protections even if you attempt to change or delete them. The current recipe is the unsaved native snapshot when one is supplied.",
        "Only reference images and prior reconstruction renders are provided. No heldout photo, mask, score or evaluation feedback is available. Do not claim evaluation results.",
    ])


def execute_frontier(options, runner):
    run, manifest = None, {}
    started = time.monotonic()
    try:
        if not 30 <= options.timeout <= 600 or len(options.brief) > 4000:
            raise FrontierError("Timeout must be30–600seconds and brief at most4000characters")
        if bool(options.answer_photo) != bool(options.answer_request or options.answer_response):
            raise FrontierError("An answer needs an explicit request/response and photo")
        if options.answer_response and (options.answer_request or options.answer_view):
            raise FrontierError("Use the response JSON's request/view instead of duplicate answer flags")
        if options.answer_request and not options.answer_view:
            raise FrontierError("An explicit answer request also needs --answer-view")
        previous, prior, prior_manifest, snapshot = None, None, None, None
        base_revision, scene_id, protected = 0, "native-" + uuid.uuid4().hex, []
        observations, requests, previous_records = [], [], []
        snapshot_path = options.current_scene.expanduser().resolve() if options.current_scene else None
        if snapshot_path:
            snapshot = validate_snapshot(load_json(snapshot_path))
            if not options.expected_snapshot_hash or hashlib.sha256(snapshot_path.read_bytes()).hexdigest() != options.expected_snapshot_hash:
                raise FrontierError("Current native snapshot changed or lacks its dispatch hash")
            if options.revise_run and options.revise_run.expanduser().resolve() != Path(snapshot["sourceRun"]).resolve():
                raise FrontierError("Snapshot and explicit prior run differ")
            options.revise_run = Path(snapshot["sourceRun"])
        if options.revise_run:
            prior = options.revise_run.expanduser().resolve()
            prior_manifest = load_json(runner.prior_file(prior, "manifest.json"))
            if prior_manifest.get("status") != "complete":
                raise FrontierError("Revision needs a completed source run")
            previous = load_recipe(runner.prior_file(prior, "recipe.json"))
            state = prior_manifest.get("frontier")
            if state:
                observations = deepcopy(state["observations"])
                requests = deepcopy([r for r in state["requests"] if r["status"] not in ("resolved_changed", "resolved_confirmed")])
                base_revision, scene_id = state["revision"], state["sceneId"]
                protected = list(state["protection"]["protectedIds"])
                validate_observations(observations)
            if snapshot:
                if state and (snapshot["sceneId"] != scene_id or snapshot["baseRevision"] < base_revision):
                    raise FrontierError("Snapshot scene identity/revision is stale")
                previous = snapshot["recipe"]
                base_revision, scene_id, protected = snapshot["baseRevision"], snapshot["sceneId"], snapshot["protectedIds"]
            if options.image or options.image_view:
                raise FrontierError("Revision takes registered references from its prior run; use an explicit answer photo")
            previous_records = [r for r in prior_manifest.get("inputs", []) if r.get("role") == "reference"]
            if not previous_records:
                raise FrontierError("Prior run has no registered reconstruction images")
            for record in previous_records:
                data, _, _ = runner.check_image(runner.prior_file(prior, record["path"]))
                if hashlib.sha256(data).hexdigest() != record["sha256"]:
                    raise FrontierError("Prior reconstruction photo changed after registration")
            options.dimensions_source = prior_manifest.get("dimensions_source", "assumed")
        elif options.answer_photo:
            raise FrontierError("Photo answers require a recorded prior run")
        elif not 1 <= len(options.image) <= 4 or (options.image_view and len(options.image_view) != len(options.image)):
            raise FrontierError("Supply1–4images and, if specified, one --image-view per image")
        tank = deepcopy(previous["tank"]) if previous else dict(zip(("width_m", "depth_m", "height_m"), [v / 100 for v in options.tank_cm]))
        if not previous:
            tank["substrate_depth_m"] = options.substrate_cm / 100
            from scene_recipe import _tank
            _tank(tank, "tank")
        gate = load_generator_gate(options.evaluation_split) if options.evaluation_split else None
        if not gate and prior and (prior / "transport-policy.json").is_file():
            transport_policy = load_json(runner.prior_file(prior, "transport-policy.json"))
        elif gate:
            transport_policy = {"seriesId": gate["seriesId"], "policy": gate["policy"], "finalized": True,
                                "allowedReconstructionHashes": sorted({r["sha256"] for r in gate["reconstruction"]}),
                                "forbiddenHashes": sorted({r["sha256"] for r in gate["heldout"]})}
        else:
            transport_policy = None
        run = runner.new_run(options.run_root)
        print(f"RUN_DIR={run}", flush=True)
        manifest = {"run_id": run.name, "created_at_utc": datetime.now(timezone.utc).isoformat(), "status": "prepared",
                    "model_calls_attempted": 0, "source": "model_generated", "manual_recipe_edits": bool(snapshot),
                    "backend": options.backend, "requested_model": runner.MODEL, "cost_usd": None, "tank": tank,
                    "dimensions_source": options.dimensions_source, "evaluation": "Not evaluated. Generator receives no evaluation photos, masks or scores."}
        if transport_policy:
            runner.write_json(run / "transport-policy.json", transport_policy)
            manifest["evaluation_split"] = {key: transport_policy[key] for key in ("seriesId", "policy", "finalized")}
        records = []
        if previous:
            for index, old in enumerate(previous_records):
                copied = runner.copy_images([runner.prior_file(prior, old["path"])], run, f"reference-{index}")[0]
                copied["role"] = "reference"
                copied["original_name"] = old["original_name"]
                if old.get("observation_id"):
                    copied["observation_id"] = old["observation_id"]
                records.append(copied)
            manifest["revision_of"] = prior.name
            runner.write_json(run / "previous-recipe.json", previous)
        else:
            records = runner.copy_images(options.image, run)
        if not observations:
            for index, record in enumerate(records):
                view = options.image_view[index] if options.image_view else "overview"
                if gate:
                    match = next((r for r in gate["reconstruction"] if r["sha256"] == record["sha256"]), None)
                    if match is None or (options.image_view and view != match["view"]):
                        raise FrontierError("Reference bytes/view do not match finalized reconstruction split")
                    view = match["view"]
                    record["observation_id"] = match["id"]
                obs = register_observation(observations, record, view, note="Reconstruction reference; view declared by the user or source registry.")
                observations.append(obs)
                record["observation_id"] = obs["id"]
        if options.answer_photo:
            answer = runner.copy_images([options.answer_photo.expanduser().resolve()], run, "answer")[0]
            answer["role"] = "reference"
            if options.answer_response:
                response = validate_answer_response(load_json(options.answer_response), prior_manifest=prior_manifest,
                                                    base_revision=base_revision, requests=requests, photo_record=answer)
                options.answer_request, options.answer_view = response["requestId"], response["observation"]["view"]
                answer["observation_id"] = response["observation"]["id"]
            if gate:
                match = next((r for r in gate["reconstruction"] if r["sha256"] == answer["sha256"]), None)
                if match is None or match["view"] != options.answer_view:
                    raise FrontierError("Answer bytes/view do not match finalized reconstruction split")
            requests, observations, obs = answer_request(requests, observations, options.answer_request, answer, options.answer_view)
            if options.answer_response:
                # Preserve the exact immutable observation record selected in the browser.
                observations[-1] = deepcopy(response["observation"])
            answer["observation_id"] = obs["id"]
            records.append(answer)
        if previous:
            records += runner.copy_images([runner.prior_file(prior, "renders/front.png"), runner.prior_file(prior, "renders/overview.png")], run, "previous_render")
        if snapshot:
            blend = runner.prior_file(snapshot_path.parent, snapshot["blendPath"])
            if hashlib.sha256(blend.read_bytes()).hexdigest() != snapshot["blendHash"]:
                raise FrontierError("Saved current-scene copy changed after capture")
            folder = run / "current-scene"
            folder.mkdir()
            shutil.copyfile(blend, folder / "current.blend")
            runner.write_json(folder / "snapshot.json", snapshot)
            manifest["native_snapshot"] = "current-scene/snapshot.json"
            manifest["native_snapshot_state_hash"] = snapshot["stateHash"]
            manifest["native_edit_provenance"] = snapshot.get("editProvenance", "unspecified")
        manifest["inputs"] = records
        runner.transport_images(run, records)  # fail before spending a request
        base_prompt = runner.generation_prompt(tank, options.dimensions_source, options.brief, records, previous)
        prompt = frontier_prompt(base_prompt, base_revision=base_revision, observations=observations,
                                 requests=requests, protected_ids=protected, previous=previous)
        (run / "prompt.txt").write_text(prompt)
        runner.write_json(run / "schema.json", proposal_schema())
        manifest.update(status="generating", model_calls_attempted=1)
        runner.write_json(run / "manifest.json", manifest)
        generate = runner.codex_generate if options.backend == "codex" else runner.api_generate
        manifest.update(generate(run, prompt, records, options.timeout))
        raw = load_json(run / "model-output.json", 256 * 1024)
        runner.write_json(run / "raw-proposal.json", raw)
        accepted = accept_proposal(raw, previous=previous, base_revision=base_revision, observations=observations,
                                   requests=requests, protected_ids=protected)
        accepted["sceneId"] = scene_id
        manifest["frontier"] = {key: value for key, value in accepted.items() if key != "recipe"}
        recipe = accepted["recipe"]
        runner.write_json(run / "recipe.json", recipe)
        runner.write_json(run / "accepted-frontier.json", accepted)
        manifest.update(status="validated", objects=len(recipe["objects"]))
        manifest["design_review"] = runner.design_review_for(recipe, run)
        runner.write_json(run / "manifest.json", manifest)
        runner.build_run(run, manifest, options.blender)
        manifest["elapsed_seconds"] = round(time.monotonic() - started, 2)
        manifest["outputs"]["frontier_review"] = "frontier-review.json"
        runner.write_json(run / "manifest.json", manifest)
        runner.write_json(run / "frontier-review.json", review_artifact(manifest))
        print(f"COMPLETE={run / 'aquarium.blend'}", flush=True)
        return 0
    except (ValueError, OSError, KeyError, TypeError) as exc:
        if run:
            manifest.update(status="failed", error=str(exc), elapsed_seconds=round(time.monotonic() - started, 2))
            runner.write_json(run / "manifest.json", manifest)
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
