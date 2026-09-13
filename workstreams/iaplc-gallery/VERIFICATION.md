# Gallery verification — 13 September 2026

Verdict: gallery passed review and was privately published by the owning task at https://fishy-3d-studio.banz-joshua.chatgpt.site/ (version 7, commit `c8d92ebbfc0c9a2bf6c1e3dfd154c16deb534836`). The owner reported terminal deployment success, project TypeScript, all 19 scene tests, and the production build passing. Gallery browser checks below were independently performed on the integrated local preview.

## Independently executed

- Importer: 10 regression checks, deterministic freshness check, full raw/per-year parity, all 615 existing IDs retained; zero current identity conflicts or exported image endpoints.
- Isolated component: strict TypeScript check passed after explicitly typing `useMemo<DisplayReference[]>`.
- Integrated local preview `http://localhost:5176/`: Gallery contains 2,425 references, comprising 2,422 source records plus three original Fishy renders.
- Creator search “Josh Sim” returns six entries. Combined 2024 and Grand Prize filters return Great Wave by Luis Carlos Galarraga.
- Desktop comparison renders the live current creation alongside the actual original Fishy image. Selected IAPLC record instead renders attributed source metadata and a correct official source-page link. The IAPLC comparison DOM contains zero image or iframe elements.
- Creation photo test with original cube render: decoded 1,200-pixel local blob URL, `object-fit: contain`. Reference photo test with original arch render: correct filename and “Your reference photo” attribution, replacing the competition metadata. Remove returns to the gallery and restores focus to the initiating Compare button.
- SVG input rejected with visible JPEG/PNG/WebP message.
- Save idea changes the reference to Saved; Saved filter includes it. Undo restores the previous reference set; filtered empty state works. Clear filters restores all records; next page displays 2 of 102.
- At 390 × 844, comparison panes stack, top navigation remains available, document width is 390, and no gallery descendants overflow horizontally. Viewport override reset afterward.
- Inspected browser error console: empty.

No persistent QA save was made. The test used supplied original render assets; it did not copy IAPLC photos, send photos to a service, or change any source files through the browser. Only an unsaved reference addition was exercised and undone in the isolated QA tab.

## Boundaries

IAPLC source photographs remain outside Fishy; visual comparison with those photographs requires an external source window until reuse permission exists. Full in-app photo comparison works with original Fishy renders and supplied photos. Local consistency validation does not independently authenticate every scraped entrant or establish complete contest coverage. Eight source records have missing entrant names, displayed as “Entrant not listed.”

The existing Site-owning task performed the project-wide tests, build, and private deployment. Its integration evidence is recorded in `site/tests/INTERFACE_V2_CHECKS.md`.
