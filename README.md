# chAMReDB live

Static web app to look up an antimicrobial resistance gene in CARD, NCBI AMRFinderPlus or ResFinder and see its matches in the other databases. Everything runs in the browser; no backend.

Previously deployed on Render: https://chamredb.onrender.com

## Develop

Node version in `.nvmrc`.

```
npm ci
npm test            # Vitest, hand-worked fixture
npm run build       # tsc + vite build into dist/
npm run e2e         # Playwright egress test against the built app (npx playwright install chromium once)
```

The build ships the graph in `GRAPH` (default `tests/fixtures/graph.json`, a hand-written fixture until the release is pinned in ticket #5).

Specs, scoping and decisions: `docs/`, `GLOSSARY.md`.
