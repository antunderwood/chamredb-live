# Pinned ChamRedB release

Release `graph-2026.11.09`: https://github.com/antunderwood/chamredb/releases/tag/graph-2026.11.09 (built from CARD 4.0.2, NCBI AMRFinderPlus database 4.2 2026-10-29.1, ResFinder commit eecf0aa; see `data_manifest.json`).

- `graph.json`, `data_manifest.json`: unmodified release assets, retrieved 2026-11-10 (`retrieved` in the record; `date` is the release date 2026-11-09) with `gh release download graph-2026.11.09 -R antunderwood/chamredb`.
- `provenance.json`: tool, version, date and sha256 of both files. The sha256 values equal the digests GitHub lists for the release assets (`gh api repos/antunderwood/chamredb/releases/tags/graph-2026.11.09 --jq '.assets[] | [.name,.digest]'`). The release's own manifest lists the input databases, not `graph.json`, so these hashes were taken from the asset.
- `src/release.test.ts` fails if a file is edited without updating the record.

Independent counts (Python, no shared code with the app) are asserted in `src/release.test.ts`: entries per database, edges, entries with phenotype, additional phenotype and product, edges with coverage above 1. The release also has no duplicate entry ids, no duplicate edges and no edge endpoint missing from the entries (`buildIndex` throws otherwise). Derivation of the headline counts:

```
python3 - <<'PY'
import json, collections
g = json.load(open("data/graph.json"))
print(len(g["nodes"]), collections.Counter(n["database"] for n in g["nodes"]), len(g["links"]))
PY
```

To update to a new release: download the new assets over these files, update `provenance.json` and the counts in `src/release.test.ts`, and update `.bio-skills.yaml` `reference` (a test checks it agrees with `provenance.json`).
