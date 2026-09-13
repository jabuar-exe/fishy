# Dependency reachability and patch record — 2026-09-13

The npm production/development classification does **not** establish Cloudflare Worker reachability. This review inspected the actual `dist/server/**/*.js` output, its entrypoint, Vinext's entry generator and server-action handlers.

## React Server Components

- Advisory: [GHSA-wx67-qw84-cm4g](https://github.com/advisories/GHSA-wx67-qw84-cm4g), patched on the 19.2 line in **19.2.8**.
- The prior build contained the complete React server module, including `decodeAction` and `decodeReply` exports, despite `react-server-dom-webpack` being declared as a devDependency. Thus the package was genuinely bundled, not merely build-only.
- The current application declares no `use server` functions. Vinext's `dist/entries/app-rsc-entry.js` generates decoder imports, action execution imports and handler callbacks only when `hasServerActions` is true.
- In the prior generated `dist/server/index.js`, `handleProgressiveActionRequest` occurred only twice, at its optional guard/call site. There was no handler implementation, `loadServerAction`, or `app-server-action-execution` import. The non-action page fallback returns action-not-found. The vulnerable decoder was therefore not shown reachable from the current route; no malicious payload or denial-of-service test was sent to production.
- Nevertheless, React, React DOM and react-server-dom-webpack were upgraded together from **19.2.6 to 19.2.8**, retaining the existing minor line and satisfying the RSC package's matching peer requirements. This removes the affected-version dependency and avoids relying on today's absence of actions as the long-term control.

## image-size / Vinext

- Advisories: [ICNS loop](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) and [JXL/HEIF loops](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq), affecting image-size 2.0.2.
- Vinext beta.5 imports image-size only in `dist/server/metadata-route-build-data.js`. That module reads repository metadata image files using `fs.readFileSync(route.filePath)` to derive build-time dimensions.
- The generated Worker output does not contain image-size, its ICNS type/magic identifiers, or its distinctive `Invalid ICNS, no sizes found` parser error. The generated externals manifest is empty, so there is no deferred external runtime require of that parser.
- Fishy uses ordinary image tags for its fixed, locally packaged PNG previews. Its file picker decodes permitted photos locally with `createImageBitmap`; it has no server photo-upload or arbitrary image-ingestion endpoint. It does not import `next/image`.
- Therefore image-size is **not bundled/reachable in this deployed Worker**. Its advisory remains a real build-environment concern when ingesting untrusted metadata image files. Do not treat repository image intake as trusted automatically. A compatible Vinext build-tool upgrade can be performed separately; no framework jump is required to repair a nonexistent current Worker path.

## Other advisories and limits

The full lockfile audit also reports development/build-tool findings involving brace-expansion, browserslist, js-yaml, undici/ws and Vite, plus baseline-browser-mapping. These are not claimed fixed by the React patch. Keep Vite/Wrangler development services off untrusted networks. Their independent audit is retained in the parent workstream; this document makes no blanket assertion that all devDependencies are absent from Worker output.

Verified after patch: installed React/DOM/RSC are all 19.2.8; all 19 scene tests, TypeScript and the production build pass. Scanning all 36 generated server JavaScript files found the 19.2.8 version in three framework/SSR files and zero image-size/parser signatures. Refreshed full npm audit no longer flags react-server-dom-webpack; it still reports 8 high, 9 moderate and 1 low advisories in the remaining dependency graph. These are not dismissed as harmless merely by dependency classification. Private publication and browser smoke follow this build. This is a bounded source/bundle review, not a penetration test or a general proof of security.
