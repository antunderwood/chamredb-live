# Oracles

An oracle is a source of expected answers that does not come from the code under test alone. Each test names the oracle it uses.

| Oracle | Independent source | What it checks |
| --- | --- | --- |
| Hand-worked fixture (`tests/fixtures/graph.json`, README beside it) | A made-up 10-entry graph; expected results worked by hand from its edge list; signed off by the repo owner on 2026-11-10 | Match rule (threshold, ties, best), lookup, phenotype text, what the page renders |
| `tests/oracle/lookup.py` | networkx 3.7, no code shared with the app | Search by id, name, alternative id and duplicate allele id on the real graph: 22 fixed cases and all 51913 searchable strings by hash |
| `tests/oracle/matches.py` | networkx 3.7; also re-implements the 2021 site's rule from the old code | Every entry at 90%, 50% and 0%; fails unless the best-flagged rows equal the old rule with ties expanded and threshold 0 keeps every edge |
| Release facts | Release notes, `diff_report.md`, GitHub asset digests, plain Python counts of `data/graph.json` | Entry and edge counts, per-database counts, phenotype counts, sha256 of the data files |
| Raw JSON read in tests | `data/graph.json` read directly, not through the app's index | Shown phenotype text equals the stored value for every entry |
| Hand-worked pixels (`src/layout.test.ts`, `docs/network-view.md`) | Arithmetic written out by hand | Coordinates of the network picture's first, last and mirrored neighbour |
| Same-page comparison (`tests/app.spec.ts`) | The interactive path | A hash URL renders the same page as the interactive search |

## Limits

- The two networkx scripts implement the same rules as the app, written separately: they catch implementation mistakes, not a wrong rule. The rules are recorded in `docs/data-contract.md` and ADR 0004 for a person to judge.
- Expected values on the real graph have no named scientific reviewer (`science_reviewer: none` in `.bio-skills.yaml`).
- CI regenerates both networkx files and fails on any difference (`.github/workflows/pages.yml`, job `oracle`). After a release update, regenerate them (`tests/oracle/README.md`).
