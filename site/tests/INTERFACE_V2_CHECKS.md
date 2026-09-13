# Interface v2 release checks — 13 September 2026

Scope: single pearl configuration tray around the existing dark aquarium; Tank / Materials / Arrange / Ideas; direct named shape choices and transaction-safe size/turn controls; integrated source-reference Gallery.

## Automated

- `npx tsc --noEmit` passes.
- `node --experimental-strip-types --test tests/scene.test.mjs tests/scene-edge-cases.test.mjs`: all existing 19 tests pass.
- `npm run build` succeeds. Existing large-chunk warning remains; no dependency changes in this release. React/React DOM/RSC remain 19.2.8.
- Gallery importer independently checks 10 cases plus dataset freshness; 2,422 source records retain all 615 prior reference IDs. The three original render cards are separate, not IAPLC photos.

## Observed browser checks

- Desktop 1440×900 and independent 1280×720 review: one tray, unobstructed tank, named shape choices, readable controls, no floating object inspector.
- Size pointer drag: revision 13 → 14, size 0.8 → 1.181. One Undo restored exactly 0.8 at revision 15.
- Focused exact size 90 + Cmd+S committed once and saved revision 16, size 0.9. Invalid 900 + Cmd+S retained the draft/focus and showed an inline error without a scene revision. Escape restored 90, retained object selection, and cleared draft-only dirty status.
- Cube 45 changed all dimensions in one revision 17 and fitted unlocked objects. One Undo restored all axes to 60×40×36 at revision 18.
- Protected Height 10 edit + Cmd+S was rejected atomically; no save/revision, focused draft retained. Escape restored 36.
- Mobile 390×844: Editor/Gallery/Originals fit the top bar; four bottom task triggers remain reachable. Materials search, source-only Juniper action, scrollable choices and sticky Add detail work. Juniper has Save reference only.
- Mobile Ideas focused brief + Cmd+S saved revision 19; reload restored exact brief. Photos remain session-only.
- Mobile rotation ArrowRight committed 0.1 degrees once. Closing object controls returns focus to Arrange after selection within the sheet.
- Browser console returned no errors during these checks.
- Independent root design review and control-source review passed. Source review covers gesture cancellation, stale revision rejection, keyboard grouping and teardown. Mid-pointer Escape and held-key repeat cancellation were not separately synthesized by this browser API.

Local QA uses browser-local fixtures only, not production saves. Earlier renderer, photo-decode, WebMCP and recovery checks remain recorded in RELEASE_CHECKS.md. No new image-to-geometry, voice or biological simulation capability is claimed.

## Independent Gallery integration review

Gallery owner verified 2,425 displayed references; Josh Sim search = 6; year 2024 + Grand prize = Great Wave; original/live-scene side-by-side; local photo decode and uncropped contain sizing; own-photo attribution; remove/back focus restoration; SVG rejection; Save idea / Saved / Undo; empty-state clearing; page 2 of 102; 390px stacked comparison with document width 390 and no gallery overflow; zero console errors. Local test reference edit was undone; production save was not touched. On 13 September 2026, the project owner confirmed permission to display IAPLC entry photographs. The gallery now maps all 2,419 IAPLC reference IDs to validated source photographs and shows them in cards and comparisons; the source-only assertion above no longer applies.
