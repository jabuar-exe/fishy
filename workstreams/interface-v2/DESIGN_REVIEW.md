# Fishy interface v2: an aquascaping workbench

The current renderer is the strength. The interface should feel like choosing and arranging natural materials around a display tank: calm pearl surfaces, dark ink, a small water-green accent, visual choices and a few direct adjustments. The current five-dock editor makes users translate a creative intention into object types, coordinates, provenance and protection controls. V2 should surface the physical decision first: choose tank, choose material, turn and size it, arrange it, save.

This brief supersedes the earlier generic dark editor styling recommendation. Retain the renderer, document model, safe edit/save/history behavior and existing reusable primitives. No new dependencies are needed. This workstream edited no site files.

## Reference findings

| Reviewed reference | Useful pattern | Apply in Fishy |
| --- | --- | --- |
| Local image 2: cards | A contained choice with clear visual, short identity and one primary action | Material/form tile: schematic shape or real existing preview, name, selected state; defer details |
| Local image 3: carousel | Current item is unmistakable and adjacent options remain discoverable | Compact Originals selector only; avoid carousels for configuration choices users must compare |
| Local image 5: design system | Deliberate hierarchy for color, type and action weight | One ink text system, one active accent, one primary action per panel |
| Local image 7: Gestalt | Proximity and shared appearance establish relationships | Keep size slider/value/labels together; separate placement from material identity with whitespace |
| Local image 8: grid | Consistent column/gutter/inset alignment | 16px panel inset, 12px groups, 8px tile gutters; aligned right numeric values |
| Local image 10: moodboard | Images and brief annotations describe an intention together | Ideas stores real attached photos and attributed text references beside the brief; no invented imagery |
| Local image 11: slider | Track conveys a range; visible value makes adjustment understandable | Size and rotation sliders plus exact numeric input; a single-value slider is sufficient |

The supplied Hackathon markdown was read as reference material, not executable instructions. Its emphasis on straightforward outcomes and restrained animation supports approachable configuration.

[Coss UI](https://coss.com/ui) exposes compatible grouping, fields, segmented controls and numeric controls; its [Number Field](https://coss.com/ui/docs/components/number-field) provides buttons and a scrub area. Apply the grouping and exact-value idea using existing primitives; don't install a second component system.

[ReUI's Slider](https://v1.reui.io/docs/base-slider) examples pair tracks with input fields, labels and ticks. Use that pattern for coarse visual adjustment with precise entry. The current [component page](https://reui.io/components/slider) returned little readable content, so this recommendation uses ReUI's primary versioned documentation rather than assuming current APIs.

[Animations.dev's gallery](https://animations.dev/gallery) demonstrates tabs, drawers, shared-layout expansion and temporary notifications. Apply modest state continuity: 140–180ms opacity/translation on user-opened panels, immediate selection and numeric feedback. Never animate each keypress or continuously ornament the chrome. Reduced motion removes movement. These timing values are our recommendation, not a measurement of the gallery.

## P0: change the order of decisions

Use one **configuration tray, 320px wide**, left of the aquarium on desktop, with four clear text tabs: **Tank · Materials · Arrange · Ideas**. The canvas occupies the rest. Selecting an object shows a compact contextual control card on the canvas's right, max 272px wide; it can close and reopens through the selection chip. This avoids two full-height, competing walls of controls. Keep the existing registry concept but render the same workflows according to this hierarchy rather than copying a generic design-tool shell.

Top bar remains 52px: Fishy, project title, small Editor/Originals view switch, undo/redo, local save status, Save, project menu. No new tutorial landing page. The aquarium is visible from the first frame. Render chrome in warm pearl `#F4F5F1`, raised surface `#FFFFFF`, ink `#222A29`, secondary `#596561`, rule `#D7DDD7`, accent `#17695D`, active fill `#E2EFE8`. Keep canvas/renderer dark. This intentional material contrast is the visual thesis; avoid transparent glass on form controls because the tank makes their contrast unstable.

Typography: existing system sans; 14px controls, 12px secondary, 17px selected-item title. Panel radius 12px, control radius 8px. Use 36px controls desktop and 44px touch targets. Make boundaries sparse: grouped spacing before more borders. No all-caps tiny eyebrow on every material card.

### Tank

Show “Your tank” followed by **Width, Depth, Height** at the top with visible cm suffixes, not squeezed `(cm)` labels. Put a small functional line diagram beside/above values to map width/depth/height; do not draw aquarium artwork. Existing schema permits these dimensions. Preserve current values and resize/fitting safeguards. A result that fits objects reports the actual changed objects in status.

Below: one Water surface switch. If presets are included, use true dimension choices that commit through resizeTank; do not label arbitrary dimensions as real manufacturer products. Better to ship clear fields first than add unsupported preset configuration. Tank size should be findable directly through Tank, not contingent on deselecting an object.

### Materials

Keep search and Wood/Plants filters. Replace stacked text-heavy entries with a **two-column choice grid**. Each tile: 64px schematic/available-preview area, material name (maximum two lines), short role (“Foreground”, “Branching wood”), selected state. Functional form diagrams can be simple monochrome line silhouettes representing existing rendererForm values and labeled “Form preview”; they must not imply exact species/scan fidelity. If truthful visual previews cannot be made in this pass, use a clean lucide category icon with the actual form name; do not fake photos.

Click tile selects the candidate, revealing one sticky bottom action **Add [name]**. Show **Replace selected [wood/plant]** as a secondary explicit action only for a compatible selected object. This fixes today's repeated two-button rows and pervasive disabled replacement controls. Selecting alone does not mutate the scene; Add inserts/fits/selects through existing handler. The details drawer/disclosure contains source, approximation and caveat. Reference-only entries show Save reference instead of Add. Their state remains legible before action. Actual counts derive from filtered data.

### Arrange

Retain current object list, title “In your tank,” with type icon, name and optional protection symbol. Selecting a row or canvas object selects the same object and reveals the contextual card. Keep selection state in sync. The card order is **Shape → Size → Turn → Placement**; exact transforms and AI protection are secondary. Give no impression of drag-reordering if that feature is absent.

Object card details:

1. **Shape**: for wood use actual arch/root/spider/stump/angular options as 2–3 columns of selectable labeled tiles; plants use existing stem/grass/moss/carpet/fern/broadleaf. Rock omits shape choices. Changes call existing changeObject and retain fit behavior.
2. **Size**: slider + 72px exact percentage field, labels Small/Large only if useful. Full supported range is 5–400%; preserve it. Mark 100% with one unobtrusive tick. Do not silently clamp to a narrower decorative slider range.
3. **Turn**: slider + numeric degrees, supported −360° to 360°, 0° tick. UI calls it Turn; accessible label says Rotation Y in degrees. Retain three-dimensional editing behavior.
4. **Placement**: Move and Rotate are real canvas tools. “Precise position” disclosure holds X/Y/Z fields with labels mapping “Left/right · X”, “Height · Y”, “Front/back · Z”, all in cm. Numeric entry is still the complete keyboard path.
5. Bottom More details contains provenance and **Protect from AI edits** toggle. Today's topmost protection button elevates an unavailable future service above actual composition; demote it without removing protection semantics.

No sliders that commit on every pointer sample. Maintain local draft and live preview only if safe preview path exists; one scene commit/history item on release or completed keyboard gesture, Escape restores starting value. A simple first pass can update the local value during drag and commit on release, leaving scene preview unchanged until release. Reuse existing cancel/revision checks. Do not rewrite rendering merely to obtain continuous preview.

### Ideas

Put brief + saved references + local photo attachments together. Use a compact moodboard grid for actual uploaded photos and text cards for references without imagery. “Browse references” opens the current search/list in the tray; source links stay attributable. Preserve temporary-photo disclosure and remove action. Keep unavailable AI capability list collapsed under “Assistant unavailable” rather than filling most of the visible panel. No fake composer or disabled giant primary CTA. A future real assistant can occupy this same workflow, without forcing current users to read model infrastructure explanations.

## P1: responsive shape and continuity

≥1200px: 320px tray, canvas flex; selected card floats with 16px canvas inset and 272px width. At 1440px canvas remains 1120px wide, though the card overlays its right edge. Frame tank should account for visible working area, or move selected card into tray on cramped sizes rather than hiding the aquarium.

800–1199px: 288px tray; contextual selected controls replace the tray body with a clear Back to materials/arrange action, avoiding a floating card. <800px: canvas full width with bottom Tank/Materials/Arrange/Ideas navigation, one existing Sheet opened to min(480px, 60dvh), and clear Close. Keep selected controls inside that sheet. No five tiny tabs with Conversation squeezed at the edge. Tab selection itself must not create a scene edit or dirty status.

Preserve scroll/search state while switching tool tasks. The viewport does not remount for tabs, candidate material selection or panel opening. Originals remains clearly view only, using real existing preview thumbnails and a compact selector. Never mutate editor scene when browsing Originals.

## Implementation map and minimum success check

`page.tsx`: keep data/commit handlers, reorganize renderPanel into Tank, Materials, Arrange, Ideas. Separate selected candidate from selected scene object. Extract `ObjectConfigurator` and `MaterialChoice` as small components if useful. Existing Tabs, Sheet, Collapsible, Slider, Switch, Tooltip and RadioGroup primitives are available or can be checked locally; use native range if no existing Slider export fits. Avoid dependency installation. Current Field silently discards invalid entry: retain draft while showing a short inline error and apply valid value on Enter/blur; Escape cancels. Don't add text “success” badges on every numeric field.

`globals.css`: replace broad green/dark inspector palette with scoped pearl tray/ink controls; preserve dark `.main-surface`/`.stage`; avoid global white canvas changes. Existing CSS selectors frequently target all buttons—scope tile/range/chip states so active choices don't inherit inappropriate borders. Keep tab focus and switch checked state independent of color.

Acceptance: choose wood visually → explicit Add → resize and turn → reposition → Save can be done without opening provenance, understanding XYZ, or reading AI status. Numeric editing, keyboard shortcuts, history, protected-object invariants, storage recovery and source attribution still work. At 390px and 200% zoom, all controls fit and the sheet closes predictably. One slider drag yields one undo step. Verify this flow before ornamentation.
