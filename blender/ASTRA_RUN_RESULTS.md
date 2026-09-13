# Astra → Blender: first live result

13 September 2026. The photo-to-recipe-to-Blender connection now works through the user's signed-in Codex CLI, requesting `gpt-6-astra`.

## What actually ran

The reference was the existing local image `facebook_fishtank_photos/final_candidates/07334576064f0460.jpg` (280 × 210 pixels). The user approved assumed dimensions of 60 × 30 × 36 cm. A 3 cm substrate was supplied as a prototype setting. No real-world dimension measurement was available.

| Run | Result | Objects | Elapsed time |
| --- | --- | --- | --- |
| `20260913T004120Z-99c26a3d` | Failed: Codex CLI 0.144.0 did not support Astra. No scene built. | — | See manifest |
| `20260913T004310Z-6e2dabec` | First valid Astra recipe, editable `.blend`, front and overview renders. | 12 | 57.64 s |
| `20260913T004455Z-72721c2e` | Astra received the same photo, prior recipe, and both prior renders; it generated a revised recipe and scene. | 18 | 78.37 s |
| `20260913T010130Z-2653bd9e` | Full desktop check: Generate was clicked in Blender, the viewport stayed responsive, and Open Result opened the new scene. | 12 | 60.76 s |

Codex CLI was updated through its official updater to 0.154.0 before the successful requests. The requested model was preserved. No fallback model or manually substituted recipe was used.

The first response described the diagonal rising wood, a second descending piece, shaded planting below, and a densely planted background. The revision changed placements and sizes and added plant groups. Both responses explicitly acknowledge uncertain depth and the limits of procedural assets.

Each run folder preserves inputs, prompt, JSON schema, raw model response, event log, validated recipe, run manifest, build log, `.blend`, two renders, and evaluated geometry report. The `.blend` also embeds its input recipe and a snapshot of the build-time manifest. That embedded snapshot can say `building`; the adjacent final manifest records completion.

## Evidence and limits

- 31 offline tests pass for recipe validation and generation orchestration, including invalid input, incomplete/refused responses, no automatic retry, path confinement, and provenance.
- All three live `.blend` files passed six Blender runtime checks against their independently supplied recipe files: dimensions, IDs, native editable geometry, object transforms, envelope fit, and bounds.
- The first recipe had 12 objects and the revision 18; model output was not manually edited before either build.
- First request usage: 12,340 input tokens, 1,563 output tokens, 279 reasoning-output tokens as separately reported by Codex.
- Revision usage: 16,416 input tokens, 2,158 output tokens, 363 reasoning-output tokens as separately reported by Codex.
- Desktop-button run usage: 12,333 input tokens, 1,479 output tokens, 188 reasoning-output tokens as separately reported by Codex.
- Actual monetary cost was not supplied by the Codex transport and is recorded as unavailable. These were Codex account runs, not API-key billing requests.
- The optional Responses API transport has offline response-handling tests but was not exercised with a live API key.

This establishes that image input can produce a validated, editable scene and that Astra can revise the scene after receiving its renders. It does **not** establish accurate 3D reconstruction, biological validity, or reliable performance across aquariums.

The reference is one low-resolution front image. There is no held-out view or independent geometry measurement. Renderer/asset implementation also evolved during development, so the two previews are an illustration of the running revision loop, not a controlled accuracy comparison.

## The next weakness to attack

The current four-asset vocabulary is visibly restrictive: one branchwood family, rounded rocks, grass clusters, and broad-leaf bushes. Astra chooses object identities, sizes, placement, yaw, and seeds; it does not yet author the exact natural mesh surface.

The next experiment should let Astra describe a bounded branch graph and rock silhouette, then construct that geometry with trusted Blender code. Use a sharper photo set with measured dimensions and reserve one oblique view. Compare initial and revised results with the **same frozen builder**, before any human correction. That tests spatial reasoning more directly than adding voice or shopping at this stage.

## Reproduce

From the workspace root:

```sh
python3 blender/generate_scene.py doctor
python3 blender/generate_scene.py generate --image facebook_fishtank_photos/final_candidates/07334576064f0460.jpg --tank-cm 60 30 36 --dimensions-source assumed --backend codex
python3 blender/generate_scene.py generate --revise-run blender/runs/20260913T004310Z-6e2dabec --backend codex
python3 -m unittest discover -s blender/tests -v
```

Each generation invocation makes at most one model request and writes to a new run directory. Re-running commands uses account capacity again. The existing completed runs can be opened without another model request using **Open Latest Design.command**. Three generation requests succeeded; one earlier request failed due to the outdated CLI.

To build an already saved recipe without a model request:

```sh
python3 blender/generate_scene.py build --recipe blender/runs/20260913T004455Z-72721c2e/recipe.json
```

This last command labels the new run as an imported recipe with unknown prior manual-edit provenance. Keep the original model run when presenting evidence of generation.

## Official implementation references

- [Astra model documentation](https://developers.openai.com/api/docs/models/gpt-6-astra): image input and structured output support.
- [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode): schema-constrained output and saved authentication.
- [Structured model outputs](https://developers.openai.com/api/docs/guides/structured-outputs): JSON schema request format for the optional Responses API transport.
