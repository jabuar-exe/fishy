# Native evidence and protected revisions

Fishy now has a local Astra → validated recipe → editable Blender workflow with named photo requests. The browser imports recorded review artifacts; it does not secretly start a hosted model or Blender service.

## Generate and answer a photo request

Use the **Astra Design** panel to select a reference image, declare its view, and generate. Each click makes at most one model request. Tank scale is explicitly assumed unless the CLI is given measured dimensions. The result opens separately; the current aquarium stays open.

The model can request up to two views of named objects. An answer must explicitly name the request and match its requested view and object. A photo of a different stone is not a valid answer merely because it is from the same aquarium.

```sh
python3 blender/generate_scene.py generate --frontier \
  --image /absolute/path/front.jpg --image-view front \
  --tank-cm 60 30 36 --dimensions-source assumed

python3 blender/generate_scene.py generate --frontier \
  --revise-run /absolute/path/completed-run \
  --answer-request request-r1-1 \
  --answer-photo /absolute/path/close-up.jpg --answer-view close_up
```

The browser can export `fishy.evidence.response.v1` after the user attaches a local photo. Pass that JSON and the exact selected photo to the native runner:

```sh
python3 blender/generate_scene.py generate --frontier \
  --revise-run /absolute/path/completed-run \
  --answer-response /absolute/path/photo-response.json \
  --answer-photo /absolute/path/selected-photo.jpg
```

Run, scene, revision, request, photo SHA256, view and object mapping must match. The JSON contains no remotely fetched image. Filenames are display labels; the SHA256 binds the actual bytes. The source review and prior run remain immutable.

If the native scene changes after a browser response was exported, that response is stale. A current unsaved snapshot commits those edits as a new native revision. To answer an existing request alongside that new snapshot, explicitly select the request ID, photo and view in the native panel or CLI; do not rewrite an older browser response's revision number.

An answer can produce `resolved_changed`, `resolved_confirmed`, or `request_unresolved`. Confirming evidence may correctly produce no movement. A changed outcome requires an actual same-object change and a citation to the registered answer. Resolved requests remain in their original run; they are not reinterpreted against later diffs.

## Revise the current unsaved scene

**Revise Current Scene with Astra** captures a copy of the currently open scene before dispatch. It does not use an older disk recipe as a substitute for current edits. Manual object transforms automatically protect their objects. The panel shows protection, and **Release Human Protection** explicitly permits later model changes.

The supported native adapter handles translation, yaw and positive scale on the verified procedural meshes. It rejects unsupported topology/vertex changes, tilt, shear, modifiers, parenting, constraints, animation, additions/deletions, and edits to fixed tank meshes before making a model call. Older scenes without a verified baseline must be rebuilt first:

```sh
python3 blender/generate_scene.py rebuild --from-run /absolute/path/completed-run
```

A rebuild makes no model request, produces a fresh directory, preserves the upstream manifest, and labels the review as an imported run. It does not overwrite the original aquarium.

Native protection comes from the captured scene. The raw attempted model changes are retained in `model-output.json` and `raw-proposal.json`. Protected objects are restored before effective geometry validation. The builder copies their exact native mesh and transform properties from the saved snapshot. It separately verifies the resulting world matrix and mesh digest. Invalid unprotected geometry fails; it is never silently clamped.

After dispatch, additional edits make a result stale. The native **Open Result** action checks the current snapshot identity and refuses a stale result. Opening a result is a separate Blender process, not an Apply operation over the user's open aquarium. Native results never bypass the browser's own scene adapter, history or protection checks.

## Evaluation isolation

`--evaluation-split /path/generator-gate.json` requires a finalized reconstruction/heldout split. The generator gate contains reconstruction paths and immutable hashes, plus forbidden heldout hashes only. Evaluation photos, masks, camera settings and scores are kept outside generation.

Both Codex and API transports recheck allowed roles, confined paths, MIME signatures, actual byte lengths and SHA256 hashes immediately before assembling model input. Renaming a heldout image or mask does not bypass its forbidden hash. Codex receives private copies of the checked bytes; the API receives those bytes directly. The prompt contains no evaluation manifest or score feedback.

For a gated Codex call, the runner also uses macOS `sandbox-exec` to deny reads of the entire project directory while the model process runs in its private input directory. This prevents a filesystem tool from reaching evaluation files elsewhere in the project. The gated Codex path fails closed if that sandbox is unavailable. The API transport sends checked image bytes and exposes no filesystem tools.

Native evaluation is a separate fixed-camera series. Its render, builder, camera, recipe and mask identities do not become a score for the browser's different geometry. Source dimensions and camera limitations remain explicit. An unchanged or worse score is retained honestly.

## Review artifacts and evidence

Every completed frontier run writes `frontier-review.json` using `fishy.frontier.review.v1`. It distinguishes recorded model runs, imported runs and protocol fixtures. Photo IDs are immutable. An empty observation `objectIds` list denotes a scene-wide reference; an answer must explicitly name its requested object. An uncited inferred change has `inferred: true`; it never fabricates a photo citation.

The review parser rejects unknown fields, invalid citations, impossible request outcomes and cross-runtime proposals. Native exports are view-only in the browser. An imported declaration is not authenticated proof merely because it validates.

Tests:

```sh
python3 -m unittest discover -s blender/tests -v
```

`verify_frontier_native.py` exercises actual Blender snapshots and protected mesh/matrix preservation in separate processes. `make_frontier_fixtures.py` creates explicitly labelled protocol examples without a model call. These fixtures test behavior, not model performance or biological accuracy.

`capture_simulated_native_edit.py` creates an explicitly scripted transform fixture. Its snapshot and downstream run manifest record `scripted_transform_fixture`; its provenance file states that no cursor-authored native edit is claimed. `verify_model_native_revision.py` can then compare an actual model-built result with that snapshot, including exact protected meshes/matrices and the real named-photo outcome. A scripted fixture and a real model call are reported separately.
