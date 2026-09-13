# Final UX review · source inspection only

**Review checkpoint, subsequently resolved.** The owner implemented the fixes below, and root/owner performed the separately attributed browser checks in [BROWSER_ACCEPTANCE.md](BROWSER_ACCEPTANCE.md). Add is reachable at 390×360; picker errors are local; applied reviews remain correctly historical; long identifiers wrap; samples have Reset/Retry. This document retains the original findings, not a list of outstanding release blockers. See [DELIVERY.md](DELIVERY.md) for current scope and results.

Reviewed current `site/components/frontier-review.tsx`, `material-preview.tsx`, `app/page.tsx`, `globals.css`, `frontier.css` against UX_INTEGRATION.md and root's BROWSER_ACCEPTANCE.md. No browser operation or site/source edits. These are code-based findings; root/owner retain responsibility for actual browser evidence. No broad redesign is proposed.

## P1 · Keep Add reachable in a short Materials sheet

**Source:** globals.css line 24 (`.material-browser`, `.materials-panel`, `.material-detail`, `.mobile-sheet .sheet-scroll:has(.materials-panel)`), line 26 mobile sizing; frontier.css line 4 preview body.

The sheet body hides overflow while the material browser refuses to shrink below 150px. The nonshrinking detail footer can occupy another 50% of that body. On a short landscape viewport or high zoom, body height is below their combined minimum, so the footer is pushed outside the hidden parent rather than becoming reachable. The live sample adds more scrollable content but does not fix the outer flex constraint.

**Minimal fix:** use `min-height:0` on `.material-browser`; give footer a valid bounded height with internal scrolling, or allow one outer scroll container below a short-height threshold. Preserve Add ahead of provenance. Target browser check: Materials at 390×360, open Inspect 3D sample and Source details, reach Add and Replace by both touch-scroll and Tab. Existing 390×844 checks alone do not establish this edge case.

## P2 · Surface attachment failure beside its picker

**Source:** frontier-review.tsx `useFrontierSession.photo`, `PhotoPicker`, `EvidenceReview`, `EvaluationReview`, `ReviewImport`.

Hash mismatch/size/format failures set session.error, but only ReviewImport renders the error. In Evidence that import lives after all requests, changes and observations; in Evaluation it lives in the distant header. A failed picker near the bottom can appear to do nothing because the live error is out of view. Screen-reader announcement helps, but sighted users need a visible local outcome.

**Minimal fix:** associate error with the attachment key and render inline beside that picker, or focus/scroll a shared visible alert intentionally. Keep hash mismatch rejection intact. Don't clear previously valid attachments on failure. Show busy status locally for hashing/decoding, rather than labeling an unrelated import “Opening…”.

## P2 · Show an accepted proposal as accepted

**Source:** page.tsx `applyProposal`; frontier-review.tsx `ProposalReview` staging branch.

Apply increments scene revision and leaves the imported proposal active. The next render immediately runs stageBrowserProposal against the new revision; that produces a stale/base-revision error. The successful action therefore turns its review into an error, with only the transient bottom status explaining that it worked.

**Minimal fix:** remember accepted run/proposal/base identity locally and show “Applied as revision N · one undo step” with the original reviewed differences read-only. Genuine manual edits before acceptance must continue to show stale and block Apply. Do not solve this by relaxing revision checks. Undo should still restore the scene and make any subsequent proposal state explicit.

## P2 · Make unbroken imported IDs wrap consistently

**Source:** frontier.css `.blocked-attempt`, `.review-change`, `.review-observations article`; frontier-review.tsx headings/object IDs.

Run identity and hash paragraphs explicitly wrap; blocked object IDs in `strong`, observation headings and change headings do not. A long valid identifier can set a flex child's min-content width and overflow a 320px tray. The blocked-attempt content div lacks `min-width:0`.

**Minimal fix:** `min-width:0` on relevant flex children and `overflow-wrap:anywhere` on identifier headings/labels. Keep exact IDs selectable; don't truncate the only identity text. Root can test with a long object ID independently of full SHA labels, which already wrap.

## P2 · Give actual sample previews a reset/retry path

**Source:** material-preview.tsx `MaterialPreview` and `useMaterialThumbnails`.

Actual geometry reuse is correct and the sequential thumbnail renderer avoids a WebGL context per tile. However, the live preview only exposes pointer orbit; there is no Reset view, and a thumbnail failure has no immediate Retry. Users must discover close/reopen or switch tabs to retry. These are contained affordance gaps, not grounds for new geometry or new infrastructure.

**Minimal fix:** Reset view reuses the initial camera/target; Retry restarts the existing bounded thumbnail job or live preview. No automatic repeated retries. Keep Add usable without orbit and no model requests.

## Remaining scope is honestly constrained

The delivered evidence interface is an imported-record/native-run handoff, not the fully live W1 generation loop. It explicitly says photos are local and exports a manifest; native proposals are view only; evaluation explains its renderer/series and missing scores. This is preferable to implying backend execution. Full citations are currently text observation IDs plus matching-photo attachment, not clickable object-linked region overlays. The accepted importer scope can ship with that limitation; do not label it completed live reconstruction or a measured score of the browser's different geometry.

Materials now meets the core preview architecture requirement: catalogDescriptor feeds both samples and actual geometry. Root has observed all 19 addable thumbnails; this review does not claim that observation as its own. Mobile task count remains four. Evaluation tables have their own horizontal scrolling, image slots collapse to one column, and long frozen hashes explicitly wrap. Preserve these working choices.
