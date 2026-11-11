# chAMReDB live

Static web app to look up an antimicrobial resistance gene in CARD, NCBI AMRFinderPlus or ResFinder and see its matches in the other databases. Everything runs in the browser; no backend.

Live site: https://antunderwood.github.io/chamredb-live/ (GitHub Pages, built by `.github/workflows/pages.yml`). The old Render site only redirects here.

## Screenshots

Taken on the release build (`graph-2026.11.09`) with the page as shipped; `docs/screenshots/`.

| | Light | Dark |
|---|---|---|
| A result, 1280 px (`card:ARO:3000230`) | ![A result in light mode](docs/screenshots/result-light.png) | ![A result in dark mode](docs/screenshots/result-dark.png) |
| Weak evidence, 1280 px (`card:ARO:3000179` at 80%): the ResFinder group is labelled Highest identity shown | ![Weak evidence in light mode](docs/screenshots/weak-light.png) | ![Weak evidence in dark mode](docs/screenshots/weak-dark.png) |
| Phone, 360 px | ![A result at 360 px in light mode](docs/screenshots/phone-light.png) | ![A result at 360 px in dark mode](docs/screenshots/phone-dark.png) |

An ambiguous name (`tet(M)` is in all three databases, so you choose which entry you mean), and the layout at 768 px:

![The ambiguity choice](docs/screenshots/ambiguity-light.png)
![A result at 768 px](docs/screenshots/tablet-light.png)

## Develop

Node version in `.nvmrc`.

```
npm ci
npm test            # Vitest, hand-worked fixture
npm run build       # tsc + vite build into dist/
npm run e2e         # Playwright egress test against the built app (npx playwright install chromium once)
```

The build ships the pinned ChamRedB release in `data/` (`data/README.md`; the build fails if its sha256 differs from `data/provenance.json`). The e2e tests build a hand-written fixture graph into `dist-e2e` (`GRAPH` and `OUT_DIR`); a non-release `GRAPH` must set `OUT_DIR` so it cannot land in `dist`.

Specs, scoping and decisions: `docs/`, `GLOSSARY.md`. How correctness is checked: `docs/oracles.md`.
