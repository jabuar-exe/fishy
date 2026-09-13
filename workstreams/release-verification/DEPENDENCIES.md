# Dependency advisory assessment

Assessed 2026-09-13 against `site/package-lock.json` with npm 11.13.0. No packages were installed, updated, or written.

Commands:

```sh
cd site
npm audit --package-lock-only --omit=dev --json
npm audit --package-lock-only --json
```

## Production-declared subset

`--omit=dev` reports **0 critical, 0 high, 1 moderate** advisory. The moderate finding is transitive `baseline-browser-mapping@2.10.30`, pulled by production dependency `next@16.3.4` (GHSA-w5vr-8v7q-w6rv; invalid input can terminate its process). The application does not directly import it. A non-breaking fix is available.

This is a package-declaration subset, **not** a deployed-bundle analysis. It establishes only that no high advisory appears after omitting declared dev dependencies; it does not establish that a deployed Worker/server bundle excludes them.

## Full install view (development/build tooling)

The complete lockfile reports **0 critical, 9 high, 9 moderate, 1 low** findings. Every high finding is in the dev/build graph, omitted by the runtime-only audit:

| Package | Locked dependency path | Advisory class | Audit fix route |
| --- | --- | --- | --- |
| `brace-expansion` | `eslint` / `eslint-config-next` → `minimatch` | expansion DoS | available |
| `browserslist` | `eslint-config-next` and `react-server-dom-webpack` → webpack | memory/prototype-write DoS | available |
| `js-yaml` | `eslint` → `@eslint/eslintrc` | YAML merge CPU DoS | available |
| `image-size` | `vinext@1.0.0-beta.5` | malformed image parser DoS | `vinext@1.0.0-beta.9` |
| `react-server-dom-webpack@19.2.6` | direct dev dependency; `vinext` / `@vitejs/plugin-rsc` | Server Function DoS | `19.3.0` |
| `undici`, `ws` | `@cloudflare/vite-plugin` → `miniflare` | proxy/WebSocket DoS and related HTTP issues | `@cloudflare/vite-plugin@1.54.8` |
| `vinext@1.0.0-beta.5` | direct dev dependency | inherits `image-size` | `1.0.0-beta.9` |
| `vite@8.0.13` | direct dev dependency and build plugins | Windows server.fs disclosure | `8.3.0` |

These packages are used by the declared `dev`, `build`, lint, RSC/Vite, or local Wrangler development paths. Although they are absent from an `--omit=dev` install, Vinext and `react-server-dom-webpack` can influence the emitted RSC/server bundle. Their deployed reachability is currently **unverified**. The Site owner must inspect the actual build output/deployment dependency graph and remediate any reachable RSC or `image-size` path before a runtime security conclusion can be made. Do not expose the Vite/Wrangler development servers to untrusted networks, and schedule compatible lockfile upgrades before treating the build environment as hardened.

## Scope

`npm audit` reports known advisory-to-version matches; it does not prove application reachability or analyze the deployed bundle. The current material gap is proof that the published Worker/server bundle excludes, or safely remediates, the high-severity Vinext/RSC/image parsing dependency paths. This assessment did not inspect secrets, run a server, modify dependencies, or perform an upgrade.
