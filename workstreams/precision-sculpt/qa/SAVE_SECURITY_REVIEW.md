# Precision sculpt save/security review — final targeted recheck

**Verdict: no unresolved blocker in this bounded save/migration review.** Reran the four existing exact tests against the frozen source: **4/4 passed**. No Site edits, servers, lifecycle tools, model calls, or additional geometry checks.

Command: `node --test workstreams/precision-sculpt/qa/save-boundaries.test.mjs`.

Verified:

- Large 8019-node scene save trimming preserves the exact current scene, newest retained history and caller arrays. This test completed in approximately 107ms; this is observed test timing, not a browser performance guarantee.
- v4 migration preserves scene/history/journal and original stored bytes.
- Unknown sculpt keys, duplicate nodes, nonfinite offsets and basis mismatch reject.
- The original spaced-ID regression now passes: valid scene ID `user rock` remains loadable through generated manual journal save/reload. Journal objectId now shares the scene ID length/nonempty domain, retaining identity correspondence checks.

Read-only integration inspection confirms page load uses `saved.manualEdits` before falling back to the current raw envelope journal. Page save now calls `prepareSave`, reports omitted older history records when trimming occurs, and retains quota/setItem exception handling. Dirty state clears only after successful storage write. Original corrupt saves and cross-tab raw comparison behavior remain intact.

The journal is display/export metadata, not authoritative protection. Sculpt remains included in manual protection/diff keys. Existing geometry, rotated/nonuniform brushes, repeated deformed-coordinate behavior, duplication independence, protected sculpt attempts and five-angle rendering were outside this targeted recheck and were not repeated.
