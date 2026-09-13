# Catalog and gallery integration notes

## What the current app supports

The Library is static data imported into `site/app/page.tsx`. It already searches the material name and visual form, filters Wood/Plants, adds a new object, fits it to the current tank, and keeps its stable `catalogId` on the scene object. The renderer in `site/lib/geometry.ts` supports generic wood forms `arch`, `root`, `spider`, `stump`, and `angular`; plant forms are `stem`, `grass`, `moss`, `carpet`, `fern`, and `broadleaf`.

The registry records the exact available generic form. It deliberately maps *Cryptocoryne wendtii* 'Green' to `broadleaf`: its browse role is rosette, but there is no rosette generator. Cholla, Dragon, and several named woods also use generic proxies rather than faithful material representations.

## Production-editor browse flow

Use one left-side **Library** panel with a search field and compact filters: `All`, `Wood`, `Plants`, `Supported`, `Reference only`, plus role tags such as foreground, epiphyte, focal, and carpet. Cards should show the display label, one role line, a small in-app procedural swatch, and a terse provenance label such as “Tropica · source”.

Opening a card shows a details sheet with the source link, placement role, identity caveat, and an explicit “procedural approximation” label. It must never imply that a swatch is supplier photography, a botanical scan, or a purchasable exact item. Keep Fishy Original Blender renders in the separate Originals/templates surface only.

For a supported entry, show two distinct actions:

1. **Add to scene** creates a new object, runs the existing fit-to-tank behavior, selects it, and returns the user to Design. It is disabled with a useful message when the 32-object scene limit is reached.
2. **Apply to selected wood/plant** changes the selected object’s catalog reference and generic renderer form only when its kind matches. It should preserve transform, size, protection, and scene position. Do not offer it when no compatible object is selected; use “Select a wood to apply” or “Select a plant to apply.”

`reference_only` cards provide **View source** and **Save reference**, never **Add to scene**. Ancient Juniper is in this state because the available evidence is a Tropica layout reference, not a product/material record.

## Inspiration gallery flow

Keep the gallery focused on credited composition study: search title, creator, country, provider, year, rank, source location, and known composition tags; filter by provider/year/rank only when that metadata exists. Existing entries have `image: null` and source-only rights notes, so cards should not reserve a broken-photo frame. A “View original” link stays external, while **Save idea** adds the reference ID to the design brief (current scene capacity: 50 saved references).

From a saved gallery reference, offer “Find in Library” only as a text search seeded from explicitly listed wood or plant names. It must not infer a material match from an image or title. The library and gallery should feel like one inspector workflow: browse, inspect source, save to brief, then add a clearly-labelled generic procedural proxy when an actual catalog entry is chosen.

## Empty, loading, and error behavior

The current payloads are build-time imports, so ordinary browsing has no network loading state. When the owner moves them behind a fetch or lazy import, use skeleton cards while validation runs; do not render partial or unvalidated records. If the catalog fails, retain the editable scene and show “Catalog unavailable. Your scene is unchanged.” with Retry. If a filter has no result, show the active filters and “Clear filters,” never a blank panel.

For the inspiration feed, distinguish “No results” from “References unavailable.” A failed gallery load must not erase locally saved scene reference IDs; show those IDs as saved, with an unavailable-source state and a retry affordance. For individual outbound source failures, keep the metadata card and show a non-blocking “Source could not be opened” state.

## Data-quality gaps to keep visible in implementation, not on every card

- The starter registry has 20 catalog entries. It does not provide product SKU, stock, price, tank compatibility, or a chosen real-world specimen.
- Wood labels are supplier/trade labels. Similar labels can overlap, and no wood is safe or authentic merely because a procedural form looks similar.
- Procedural values in the source catalog are non-executable art direction in normalized local asset space. They are neither physical dimensions nor a species/material generation contract.
- Plant care fields are source-scoped and inconsistent in completeness. Do not use them to size a scene object or make care recommendations beyond the cited source.
- The gallery has 615 source-link records but no hosted reference images. Several IAPLC records came from an imported scrape and state that individual records were not independently audited; image reuse permission is not supplied.
- The current renderer has no dedicated rosette, hollow-lattice, material scan, or species-accurate plant model.
