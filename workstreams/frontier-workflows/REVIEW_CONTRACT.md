# Frontier review interchange v1

This is a **review artifact**, separate from both the strict browser scene v4 and native recipe v2. The site owner may tighten bounded limits; coordinate any field change with the native exporter owner before integrating. The artifact is untrusted input, never executable code or an instruction to fetch a path.

Top-level JSON:

```json
{
  "schemaVersion": "fishy.frontier.review.v1",
  "provenance": "protocol_fixture",
  "run": {
    "id": "example-run",
    "runtime": "blender",
    "builder": "fishy-native-recipe-v2",
    "sceneId": "example-scene",
    "baseRevision": 0,
    "revision": 1,
    "createdAt": "2026-09-13T04:10:00Z"
  },
  "observations": [],
  "requests": [],
  "changes": [],
  "protection": {"protectedIds": [], "blockedAttempts": []},
  "evaluation": null,
  "browserProposal": null
}
```

- `provenance`: `protocol_fixture` or `recorded_model_run` or `imported_run`. The UI shows this distinction; a declaration is not authenticated proof.
- `observations` (max 20): `{id, view, role: "reconstruction", sha256, note, objectIds, region?}`. View: front/left/right/top/overview/close_up. Region: ordered finite normalized `[x0,y0,x1,y1]`. No absolute source paths, held-out observations or arbitrary URLs. Observation IDs and object IDs have conservative length limits. Images are separately user-selected local attachments; JSON paths are not fetched.
- `requests` (max 2): `{id, objectId, question, requestedView, why, status, answerObservationId?}`. Requested view: front/left/right/top/close_up. Status: requested/answered/resolved_changed/resolved_confirmed/request_unresolved. Answer must cite a known reconstruction observation with the matching view. `resolved_changed` requires a matching change and answer citation. `resolved_confirmed` requires an explanation in `why`; it does not invent a movement.
- `changes` (max 32): `{objectId, summary, observationIds}`. Citations must exist. Native change records are descriptions of native geometry, not browser mutations.
- `protection`: `protectedIds` max32 unique IDs; `blockedAttempts` max64 `{objectId, fields: string[], reason}`. Imported records describe a run. Actual browser enforcement derives from the **current browser scene**, never this list.
- `evaluation`: null or `{seriesId, runtime, builder, builderHash, cameraHash, photoHash, maskHash, policy: "strict_test" | "validation" | "fixture", status: "complete" | "pending", note, scores}`. Hashes are 64 lowercase hex. `scores` max40 `{revision, recipeHash, iou, ssim, centroidErrorPx}` with IoU 0..1; SSIM -1..1 or null; centroid >=0 or null. Non-finite values rejected. `pending` may have no scores. All fields identify the native series; do not attach them to browser revisions. A fixture remains visibly a fixture.
- `browserProposal`: null or a **strict browser scene v4**. Allowed only when `run.runtime == "browser"`, builder equals browser builder, and sceneId/baseRevision match the current browser scene at Apply. Native proposals are view-only. Stage a diff and merge authoritative protected objects before full effective-scene containment validation. Raw attempted changes stay available for the blocked-attempt log. A proposed revision cannot assign the committed revision.

Maximum JSON import 1 MiB. Bound strings (IDs 100, user-facing prose 2000) and arrays. Reject duplicate IDs, unknown schema versions, invalid citations, mismatched revisions and unsupported cross-runtime application. Reject unknown structural keys or strip explicitly according to a documented parser policy, never spread imported metadata into scene state. No network fetch, HTML injection, arbitrary links or commands from the artifact. Preserve the raw local file only as user data if needed; the UI renders validated text.

Additional cross-field invariants: an answer observation must include the requested object in `objectIds`; a `resolved_changed` request must have a same-object change that cites its exact `answerObservationId`; a `resolved_confirmed` request has no same-object change. Browser proposals echo `run.baseRevision` as their scene revision, and `run.sceneId` equals the proposed scene ID. The application assigns the next accepted revision. Check correspondence when staging and again when applying. For native recorded results `run.revision` may describe the accepted native revision; it is never used to overwrite the browser revision.

Every evidence-grounded change requires at least one known observation citation. An explicitly uncited design inference may instead have `observationIds: []` and optional `inferred: true`; the interface labels it “Inferred · no photographic citation.” Empty citations without that explicit flag remain invalid. Do not invent a citation merely to pass validation. Such an inference cannot resolve a W1 photo request: `resolved_changed` still requires the exact answer citation.

An initial reference observation may have `objectIds: []` to mean a scene-wide reference registered before generated object IDs exist; such a reference may be cited by changes. A nonempty objectIds list limits that observation's citations to its named objects. A W1 answer is narrower and must explicitly name its requested object. Do not mutate an initial immutable observation retroactively to fill in generated IDs.

Resolved request status is relative to the revision that resolved it. A later revision must not reinterpret a historical confirmed/changed request against a different revision's diff. Export only applicable current requests, or retain the richer historical resolution journal separately with its revision identity.

The native evaluation producer must retain a trusted series freeze record before exporting `strict_test`; the import UI still treats that policy as declared metadata. Valid JSON and matching strings do not independently prove that a source run avoided leakage.

Optional score field `renderHash` is a 64-character lowercase SHA-256 for the exact beauty render used by that revision's evaluator. Native exports include it when available in `score.json`. A user-attached render must match this hash before display. Earlier records without the field remain readable, but their attachment is explicitly unverified. Matching the hash verifies file correspondence with the imported record, not that record's authenticity. This avoids accepting a different revision's image beside a score when the original evaluator already recorded the hash.

Native `manifest.json` remains the run authority; this file is an export, not a second state journal. Eval functions may use a richer local manifest internally. Keep evaluation inputs isolated from the generator before producing the review export.

## Evidence answer handoff

The website keeps the imported review immutable. Attaching a local photo to its pending request produces a separate downloadable response:

```json
{
  "schemaVersion": "fishy.evidence.response.v1",
  "runId": "example-run",
  "sceneId": "example-scene",
  "baseRevision": 1,
  "requestId": "request-left-rock",
  "observation": {
    "id": "generated-uuid",
    "view": "close_up",
    "role": "reconstruction",
    "sha256": "64-lowercase-hex-content-hash",
    "note": "Close-up of the requested left rock",
    "objectIds": ["left-rock"]
  },
  "photoName": "left-rock.jpg"
}
```

`baseRevision` is the imported **run.revision**, the accepted state being answered, not that run's previous input revision. Native ingestion uses explicit `--answer-response response.json --answer-photo photo.jpg`; it checks run/scene/current revision/pending request/view/object membership/role/content hash. The name is a bounded basename for display and is never resolved or fetched automatically. The photo remains a separate local file. This operation only reaches “Photo attached; awaiting native revision”; a subsequent returned review must establish the resolved outcome.
