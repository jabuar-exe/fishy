# Fishy design lab

The user's gallery, configurable aquarium and water-research request is represented by these deliverables. They are original procedural concepts and sourced design references, not a validated aquarium reconstruction or ecology simulator.

## Start here

- [Three-tank comparison](blender/runs/20260913-110819/comparison.png)
- [Native Blender / GLB asset index](blender/delivery-index.json)
- [Build instructions and parameter controls](blender/README.md)
- [20 wood and plant references](catalog/CATALOG.md)
- [Water rendering and fluid-simulation repositories](WATER_RESEARCH.md)
- [Product workflow and customization rules](PRODUCT_DIRECTION.md)
- [Gallery provenance and ingestion findings](gallery/README.md)

## Verified artifact scope

Three rectangular tanks were built independently: 60 × 30 × 36 cm branching arch, 90 × 30 × 30 cm angular panorama, and 45 × 45 × 45 cm dense stump. Every scene has 73 exported object IDs and approximately 160–161k triangles. Each full GLB is about 3.6 MB. Native containment and independent exported-coordinate checks passed. Root visually reviewed the final hero and labeled comparison. These checks establish executable, contained geometry and export consistency; they do not establish physical tank construction safety, collision-free planting, or biological suitability.

All 20 catalog IDs are distinct: 10 wood trade types/styles and 10 plant species/cultivars. Each has an opened source URL. Proposed shape intervals use explicit local normalized conventions; they are not automatic executable physical slider ranges. The catalog is not a claim that 20 botanically accurate meshes are implemented.

The frozen gallery snapshot contains 615 source cards, including 3 Tropica layouts. It excludes 529 supplied IAPLC rows whose requested year disagrees with image identifiers and whose application IDs duplicate the following year's input. No reference images are included in the exported index. More raw files may be produced by other work; this snapshot does not automatically include them.

## Website integration boundary

The existing private Site is managed by the separate task **Build Fishy with Terra and Astra**. It owns `site/`, its registration and deployment. The local artifacts above are complete independently of that task. Root's browser review identified regressions in the procedural editor and sent a concrete repair request to its owner; do not infer successful browser controls from these assets or from a build passing. Refer to the Site task's final verification and the current browser state for deployment status.

Blender remains the authoring environment. The browser consumes GLB geometry and its own scene generators; it cannot execute Blender material nodes or the Python builder directly. `hardscape.glb` is provided when the browser renders its own tank and water.
