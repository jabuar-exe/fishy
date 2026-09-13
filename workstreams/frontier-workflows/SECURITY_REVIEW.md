# Frontier contract/security review — implementation checkpoint

**Historical review checkpoint.** Later optional per-revision `renderHash` validation was added and exercised through actual wrong-file rejection/correct-file acceptance. Statements below about unverified render association refer to artifacts without that optional hash. Final release/native test checkpoints and browser evidence are recorded separately in [DELIVERY.md](DELIVERY.md); do not add checkpoint test counts together.

2026-09-13. **Final bounded verdict: no unresolved contract/security release blocker found in the reviewed local workflow. Native protocol/transport checks pass, and the browser proposal-review omission is resolved.** This is bounded local source/test evidence, not proof of live hosted inference, photographic accuracy, or deployed behavior. No model requests, network transfers, Site lifecycle operations or source edits were performed by this reviewer. QA output is isolated under `workstreams/frontier-workflows/security-qa/`.

## Resolved P1 — substrate proposal review omission

The browser proposal scope now explicitly rejects any substrate difference before staging. Independently reran the exact .03→.02 reproduction both alone and paired with a visible brief edit: **2/2 passed**, both reject with a substrate-specific error and preserve original scene state. The owner added matching regression coverage. No broader suite rerun was needed for this single guard change.

Root separately reports actual native artifact import through the browser file chooser passed: fixture label, runtime/revision, citations/protection, native view-only/no Apply, and unchanged browser revision. This is attributed browser evidence; this reviewer did not operate the browser. The owner's material-preview placement fix is outside this security review's verification scope.

## Independent executed checks

- `node --test site/tests/*.test.mjs`: **31/31 passed** at review checkpoint. This is the on-disk glob count, not the owner's separate QA totals.
- `python3 -m unittest discover -s blender/tests -p 'test_frontier_contract.py' -v`: **12/12 passed**.
- `python3 -m unittest discover -s blender/tests -p 'test_heldout_evaluation.py'`: **36/36 passed**.
- `python3 workstreams/frontier-workflows/security-qa/transport_checks.py`: **8/8 passed**. This calls only the local final image loader, never a model/network entry point.
- Cross-imported actual native fixtures through actual Site `parseReview`: `resolved_changed`, `resolved_confirmed`, `request_unresolved` from `blender/frontier-fixtures/20260913-protocol-v1/` all accepted and retained explicit `protocol_fixture` provenance.

## Resolved contract/integration findings

- **Historical request lifecycle:** completed resolution claims now stay in their original immutable run; only active requests carry into another revision. The regression test for later revisions passes. Earlier P1 no longer applies.
- **Scene-wide observation mapping:** empty object IDs now represent general reconstruction evidence consistently across native/Site; targeted request answers still require exact requested object/view. Native exports cross-parse successfully. Earlier parser mismatch is resolved.
- **Changed/confirmed semantics:** changed outcomes require an actual same-object difference and exact answer citation; confirmed outcomes cannot claim a same-object difference. Unresolved remains explicit. Immutable observation validation rejects remapping an existing ID.
- **Evaluation parity:** fixture policy, nonempty complete scores, strictly increasing unique/nonfuture revision identities and native builder/runtime correspondence now align for tested artifacts. Native strict-score export validates the local series seal, not just a caller-provided finalized flag.

## Browser boundaries inspected

`parseReview` imposes 1MiB size, strict nested structural schemas, bounded arrays/strings/safe revisions/finite numbers, cross-record citation checks and runtime identity checks. Unknown path/URL/command fields cannot become fetches. Imported JSON is rendered as escaped text. Imported model provenance is visibly **declared**, never authenticated merely by parsing.

`stageBrowserProposal` and Apply both validate current scene/revision/runtime/builder. Proposed counters do not choose committed revisions. The current scene's protected object records are restored before effective containment validation; imported protection metadata cannot unlock them. Apply refuses while another gesture or draft is pending. Raw blocked attempts remain visible. Native artifacts remain view-only.

The manual edit journal restores through a strict bounded parser (100 entries), verifies matching before/after object identity, and is used for display/export only. It does not confer current protection authority. Current scene state remains authoritative. Journals describe edits including later-undone edits rather than pretending to be cryptographically authenticated provenance.

W1 review-photo matching computes SHA-256 before decode. The website caps image bytes/count/aggregate/pixels, revokes object URLs on removal/clear/unmount, and guards asynchronous results across changed imports. Response manifest baseRevision is imported `run.revision`, with explicit request/object/view and separate local photo. It never resolves a JSON path or URL. Matching photos do not automatically produce a resolved reconstruction outcome; the UI says native revision is pending. The native owner is normalizing display-only photoName handling; actual-byte SHA is the authority.

Evaluation UI keeps missing metrics as missing, permits worsening scores, labels fixture/validation/declared strict-test honestly, identifies native renderer/builders, and does not score the different current browser geometry. Attached comparison renders explicitly lack independently verified revision association.

## Native transport/evaluation boundaries inspected

Final `generate_scene.transport_images` is used immediately before both Codex/API input assembly, with an additional pre-spend call in the frontier workflow. It confines resolved paths to run inputs, rechecks image bytes/MIME/size against registration, restricts roles, and checks forbidden hashes. The API data URL is constructed from these verified local bytes with a fixed recognized MIME type, not supplied by an artifact. Codex uses the same gate and an isolated working directory with execution/browser/apps tools disabled.

Independent deny checks covered a held-out byte-identical copy under a renamed input path, the same forbidden bytes disguised as `previous_render`, an unregistered reconstruction hash, changed registration, symlink escape, a data URL supplied as a file path, and heldout role. All reject; a registered allowed reference passes. The deny tests do not decode or transmit a genuine photo, and make no model calls.

The frontier model envelope cannot set trusted run identity/protection/evaluation/revision. Acceptance merges authoritative protected recipe objects before geometry validation and retains raw model proposals. Snapshot adapter explicitly rejects unsupported topology/tilt/shear/parent/modifier cases rather than silently treating bounding boxes as fidelity. Native Blender runtime preservation must be supported by the native owner's separate runtime checks; this reviewer did not execute Blender.

Evaluation binds camera, build source hashes, native renderer/version, metric and photo/mask hashes. Strict tests require a finalized sequence seal before rendering/scoring and actual seal validation before nonempty export; a local seal is a workflow control, not tamper-proof authentication. Synthetic camera/mask provenance is restricted to fixture policy. Real photograph/calibration/evidence quality and proof of no human score-informed feedback remain separate from these local gates.

## Limits

No deployment or browser acceptance was performed here; root owns actual UI checks. No hosted API credential/model access claim is made. No real-photo accuracy result is inferred from protocol fixtures or passing schema tests. Native snapshot/runtime correctness is covered only by read-only source inspection here. All explicitly reported integration blockers, including substrate proposal review, are resolved in the tested checkpoints. This bounded verdict retains the scope and evidence limits above.
