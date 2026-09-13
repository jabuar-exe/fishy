# Behind Glass visual and UX benchmark

Reviewed 13 September 2026 in response to the user's reference request. This is a quality target for Fishy, not a claim that the current procedural renderer matches or exceeds it.

## Sources actually reviewed

- Official Steam page: https://store.steampowered.com/app/1611580/Behind_Glass_Aquarium_Simulator/
- Current official aquarium screenshot: https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1611580/ss_45393e3bbea83770939ae853c74a5215831424a1.1920x1080.jpg
- Official editor screenshot (older indexed capture): https://cdn.akamai.steamstatic.com/steam/apps/1611580/ss_b3a4059376dd76ef4f79d1a0a1e0054827b8bfbe.1920x1080.jpg

Page text and public screenshot metadata were extracted, and both screenshots were visually inspected in the browser. This was not hands-on testing of the purchased desktop game. Screenshots establish visible layout and appearance, not measured responsiveness or interaction quality. Commercial images and models are reference-only; none are copied into Fishy's deployment.

## What the reference establishes

The aquarium screenshot uses irregular, textured hardscape, visible wood grain and rock surface variation, layered small-leaf planting, fine substrate detail, depth separation, and bright aquatic illumination. The editor screenshot gives most of the view to the composition, uses a narrow category rail, shows the selected material visually, and exposes contextual size, radius and density sliders. These are observations of the screenshots, not inferred implementation details.

The Steam storefront is a discovery/purchase page, not a model for Fishy's working editor. Its navigation density, sales panels and small text should not be replicated. The intended translation is aquarium-first composition and visual tool selection, with more readable labels and calmer controls.

## Fishy acceptance direction

1. The actual editable aquarium, not a promotional render or large heading, dominates the working screen.
2. A material preview depicts precisely the geometry Add creates. Clearly distinguish a generic procedural approximation from a scanned or species-specific model.
3. Place size, turn and safe position controls near the selection; retain exact values and one undo step per gesture. Avoid duplicated inspectors and obstructed Add buttons.
4. Keep the interface restrained. Depth, colour, texture and atmosphere belong primarily inside the tank. Do not substitute decorative panel effects for renderer quality.
5. Preserve readable labels, visible focus and practical touch targets. Do not reproduce tiny vertical labels or icon-only controls without accessible names.
6. Judge visual quality in the live editable viewport, including a close view and a whole-tank view. A beautiful disconnected screenshot does not satisfy this benchmark.

## Release boundary

The current frontier release implements genuine catalog previews, contextual controls, protection and evidence review within the existing layout. Those improve the reference-aligned UX without replacing or delaying the integrated work. More realistic wood/rock textures, organic plant assets, physically convincing glass/water and richer scene lighting require a dedicated asset/rendering pass and performance checks. Do not claim those larger upgrades are delivered by this release or by CSS changes alone. Fish simulation and the reference game's content catalogue are not automatically added to scope.
