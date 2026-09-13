# Fishy release/security audit — final bounded verification

Date: 2026-09-13. **Verdict: no unresolved release blocker found in this workstream's rechecked device-local editor scope.** All exact boundary regressions now pass. This supersedes the earlier open findings; do not present their historical statuses as current defects.

Scope remains a device-local procedural editor with browser scene/history persistence and packaged GLB showcases. Hosted AI, voice, generated images, cloud scene storage, and hosted photo storage are not implemented/configured. This verdict is not approval of those absent capabilities, a deployment verification, or a claim of live model access.

## Independent test evidence

Executed against current application source, without modifying `site/`:

- `node workstreams/release-security/recheck.mjs`: **11/11 passed**. Results retained in `recheck-results.json`.
- `node --test site/tests/scene.test.mjs`: **7/7 passed**.

The independent reproductions cover unsafe integer revisions, revision exhaustion, oversized finite/NaN/Infinity position and rotation rejection, duplicate-name resize by stable ID, legacy object-field/raw-source preservation, nested tank mapping, canonical protected equality, exact saved scene/past/future/raw restoration, cross-scene commit denial, empty scene ID denial, and nested legacy scene metadata preservation.

## Final finding disposition

| Previously identified issue | Final disposition |
|---|---|
| Focused brief/numeric shortcut save omitted draft | **Resolved.** `requestSave` synchronously flushes the focused draft before saving; dirty tracking includes drafts. Owner reports actual browser confirmation that Cmd+S brief and depth edits persist. This workstream did not rerun browser tools. |
| Rejected geometry draft followed by save success | **Resolved.** Save/export compare `draftFailure` before and after synchronous draft flush and return on rejection. Resize/change/apply catches increment the failure counter. Owner reports protected Height=10 rejection remains unsaved with visible error, Height=36 and revision 7 unchanged. |
| Resize used names instead of IDs | **Resolved, independently executed.** Two identically named rocks no longer make the safe protected rock block fitting the outside unlocked rock. |
| Unsafe revision stopped advancing | **Resolved, independently executed.** Unsafe and exhausted counters reject; undo/redo route through guarded commits. |
| Extreme finite transforms | **Resolved, independently executed.** Bounded position/rotation schemas reject 1e308; NaN/Infinity remain rejected. |
| Empty/cross-scene identity | **Resolved, independently executed.** Scene IDs require content and `commitScene` rejects another ID. Restore starter explicitly retains current project identity. |
| Known legacy shape/metadata loss | **Resolved for exact tested inputs.** Size/color/form/stretch, nested tank, identity/brief/references/substrate survive. Source records remain intact; recovery copy now asks users to review supported recovery. Actual historical producer coverage beyond these tested variants is not asserted. |
| Protected comparison depended on key order | **Resolved, independently executed.** Canonical parsing allows unchanged reordered keys; existing tests still reject removal. |
| Scene/history save envelope | **Verified independently at read boundary.** Scene, past, future and exact raw value restore. Current UI writes and restores bounded history arrays. |
| Unlimited retained photo blobs | **Resolved in current source.** MIME allowlist, 6-photo/25MB aggregate limits, 10MB per-file limit, 24MP decoded-size check, post-decode recheck, remove/revoke, and unmount URL cleanup are present. This is source verification, not a browser memory benchmark. |
| False/inconsistent saved-state labels | **Resolved in source.** Header/menu/footer share persistence derived from blocked/dirty/raw states. |

## Scope and security boundaries

The existing source keeps corrupt saves intact, blocks their overwrite, checks raw storage for another tab's save, and catches quota/storage errors. Exact-string comparison is not an atomic cross-tab transaction, so this is not a cloud-concurrency guarantee. Validated history records with another project identity cannot be committed because of the new commit identity check.

AI protection guards object record mutations/removals. A future mutating AI implementation must also enforce tank/substrate containment and server-side authorization; none is exposed now. The read-only browser scene tool returns the scene and brief, and the current UI explicitly explains that browser assistants can read these fields.

Initial public-data inspection found HTTPS source links with unique dataset IDs and no inspected private filesystem path indicators in public JSON/GLB JSON. Public reference material used attribution/source links, not the original user-photo collection. The three fixed packaged GLBs had embedded resources only, not external buffer/image URIs. These initial asset observations were not broadened into new asset research in this final pass.

Hosting D1/R2 bindings were null; no active production model/cloud API was found. Current UI labels model/voice/image capabilities unavailable and states that no request or microphone capture has begun. Missing credentials remain an integration dependency, not evidence of operational readiness.

## Limits

This was a bounded source and regression-test recheck. No `site/` writes, Sites tools, browser automation, deployment, secret reads, or external model calls occurred in this workstream. Browser save/rejection outcomes above are explicitly attributed to the implementation owner. No dependency advisory sweep, deployed auth penetration test, GLB fuzzing, or independent transformed-mesh boundary certification was performed. All changes made by this workstream are confined to `workstreams/release-security/`.
