# IAPLC gallery integration

The user requested a gallery dataset from `IAPLC_APPLICATION.md`, plus comparison of their creation with examples online. The existing task **Build Fishy with Terra and Astra** remains the only writer/publisher of `site/`. These artifacts are isolated for its integration.

## Files to integrate

1. Copy `gallery-workspace.tsx` to `site/components/gallery-workspace.tsx`.
2. Copy `gallery.css` to `site/app/gallery.css`, then import it from `app/globals.css` before the existing CSS rules (or import once from the root layout). All selectors are scoped to `gallery-*`.
3. Copy the validated `references.json` to `site/public/data/references.json` once DATASET.md and the importer verification are complete. Preserve the existing `referenceData.entries` import so the Ideas tray gets the same expanded collection.
4. Import `GalleryWorkspace` into the page, add a top navigation Gallery button (`tab === "gallery"`), and render the component inside `.main-surface` for that tab.

Component contract:

```tsx
<GalleryWorkspace
  entries={references}
  savedIds={scene.references}
  onSave={saveIdea}
  creation={
    <FishyViewport
      scene={scene}
      selected={null}
      mode={mode}
      water={water}
      cancel={0}
      frame={frame}
      onSelect={() => {}}
      onTransform={() => {}}
      onError={report}
    />
  }
/>
```

Keep the editor's original viewport mounted as currently implemented. The comparison viewport is view-only and receives the current scene; gallery actions never replace the scene. Scene reference saves use the established `saveIdea` path and its 50-ID limit. No scene schema or storage migration is required.

The component has three original Fishy image cards and the validated source records. Originals are clearly attributed as original Fishy renders, never thumbnails for an IAPLC entry. Search includes creator, country, title, year, source, rank, source location, and documented composition tags. Filters include source/year/rank/saved; paginated at 24 cards. Photo inputs decode JPEG/PNG/WebP, cap each at 10 MB and 24 MP, retain at most two session object URLs, clean them on removal/replacement/unmount, and never upload or persist image contents. A supplied reference photo receives its own attribution and never inherits a competition entry's name.

## Dataset and source behavior

`IAPLC_APPLICATION.md` serves as the study-guide specification; `iaplc/` provides actual entry records. Four derived composition/maintenance prompts and photo framing guidance appear under the comparison view. No competition scores, biological verdicts, species identifications, or dimensions are invented.

IAPLC photographs remain external. An IAPLC comparison presents selected source metadata beside the user's creation and a source link; its photograph must be opened in another browser window for visual comparison. Full in-site visual side-by-side works with original Fishy renders and user-supplied photos. Do not describe IAPLC comparisons as showing its photograph inside Fishy.

The official gallery still requires ADA consent for reproducing entry works. Current application rules distinguish entrants' copyright from 2024 onward, so avoid the old blanket statement that ADA owns every original image. These are separate from the explicit project rule not to host/embed/hotlink them. Source pages verified 13 September 2026:

- https://iaplc.com/gallery/en/
- https://iaplc.com/e/application/
- https://iaplc.com/e/judging_criteria/
- https://iaplc.com/e/grand_prize_works/

GET `db_year=2024&rankNo=1` was verified to select the year and range 1–60. There is no observed exact-entry permalink. Source-location labels must explain the range and actual rank.

## Acceptance checks

- Gallery visible in desktop and narrow top navigation, including 390 px width without overflow.
- Search for Josh Sim, filter year 2024/Grand prize, use Saved, clear empty results, paginate.
- Save IAPLC reference; verify scene revision, undo, save/reload ID, and Ideas label resolution.
- Compare an original: live current scene left, actual original render right. Orbit; return to Editor and verify scene/camera/state retention.
- Compare IAPLC: metadata and correct external source link right, no IAPLC request from an img/iframe, no fabricated thumbnail.
- Add creation and reference photos; full uncropped `object-fit: contain`; replace/remove; reject invalid/oversize files; no server request or persistent image storage.
- Mobile stacks both panes. Keyboard compare focuses the heading; returning to Gallery restores the initiating button.
- TypeScript, existing scene tests, build; inspect no console errors during navigation/compare.

The owning task controls final integration/build/browser verification/private publication. This task independently checks the implemented gallery after integration and reports its scope accurately.
