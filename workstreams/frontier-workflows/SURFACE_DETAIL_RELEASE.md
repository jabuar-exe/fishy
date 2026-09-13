# Editable aquarium surface-detail release

The user requested richer colour hues, texture and fine detail. Hosting inventory found one Fishy Site and an unrelated CFO Site; the user withdrew the duplicate-site concern. No site was deleted or created.

Shared `surfaceMaterial` shading now adds UV-aligned wood grain, weathering and pores; layered mineral variation and roughness on rocks; leaf veins/mottling; and two-scale granular sand. Derivative-based micro-normal detail reacts to lighting. Fine rock/sand noise fades with pixel footprint. No texture downloads, external requests, purchased assets or generated photographic claims.

Leaf meshes changed from low-resolution flattened spheres to subdivided curved blades, individually fitted to each former parent-space bounding envelope. Per-leaf vertex tint preserves the selected base colour and creates natural variation. Stem/grass/moss colour attributes are explicitly white to avoid inherited missing-colour state. Wood and rock mesh vertices are unchanged. Descriptor transforms, colours, scene schema and stored records are unchanged. The renderer does not write scene storage. Actual current mesh bounds continue to drive fit/containment; the claim is not identical vertex geometry for foliage.

Exposure and ambient environment contribution were reduced to retain richer hues. The material catalog thumbnails, live previews and editor Add continue using the same `makeObject` factory. Original showcase GLBs and frozen native evaluation artifacts/builders were not edited.

Verification: 37 scene/frontier/camera regression tests passed; TypeScript and full production build passed. Additional diagnostic passed 90 foliage cases (10 supported plants × three rotations × three sizes, all stretched), with six positional-boundary checks per case, fit containment, finite bounds, unchanged input descriptors and complete colour attributes. Owner actual browser screenshots confirmed grain, mineral/sand detail and curved coloured leaves; no shader error/warning logs. Independent coordinator checked all 19 thumbnails loaded at 240 pixels, wood and red foliage live previews, orbit interaction and unchanged saved scene revision.

Limit: this is a visibly richer procedural renderer, not photogrammetry, botanical fidelity, calibrated lighting, or parity with the Behind Glass reference. Sparse or stylized user compositions remain sparse/stylized. No accuracy scores are inferred from visual polish.

Final independent clean-reload check passed: 19/19 thumbnails loaded, curved Alternanthera blades and green/red colouring correct, wood/mineral variation visible and sand detail restrained. No console shader errors/warnings; saved local revision 23 unchanged, no Save.

Exact pushed source: `4d217ddf1041a06fef4f64f5c6ddb84b7ed4f1f3`.

Version 11: `appgprj_6aa60f318aec8191903686f10de4e48e~appgver_f0036c89a00481918d876c4a3a3fc1f0`.

Archive SHA-256: `9047976597ecc9601fa56e3cd55cedf62c2c94b1c529b9ef443449aa6b256ee3`.

Private deployment: `appgdep_6aa62e17a4088191bfb7e770270f357e`; audience unchanged. Terminal `succeeded` at 2026-09-13 05:01:27 UTC, no failure. URL: https://fishy-3d-studio.banz-joshua.chatgpt.site.
