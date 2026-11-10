# Oracles (networkx 3.7)

`lookup.py` answers a fixed set of lookups on the pinned release (`data/graph.json`) with networkx, sharing no code with `src/query.ts`. `lookup_expected.json` is its output: 22 fixed cases with full results, plus a count and sha256 over every searchable string in the release (51913), compared with `findEntries` by `src/lookup.test.ts`. The oracle implements the same lookup rule as the app (written separately), so it checks the implementation, not the rule: the rule is recorded in `docs/data-contract.md` and ADR 0004. The file records the sha256 of `data/graph.json`, so a release update fails loudly until it is regenerated.

Pinned: Python 3.14, networkx 3.7 (`requirements.txt`).

Regenerate, and let the test prove the committed file is the script's output:

```
python3 -m venv /tmp/oracle-venv && /tmp/oracle-venv/bin/pip install -r tests/oracle/requirements.txt
/tmp/oracle-venv/bin/python tests/oracle/lookup.py data/graph.json > tests/oracle/lookup_expected.json
ORACLE_PYTHON=/tmp/oracle-venv/bin/python npm test
```

Run the regeneration step with `ORACLE_PYTHON` before merging a change here. CI (`.github/workflows/pages.yml`, job `oracle`) regenerates both files with networkx 3.7 and fails on any difference. Without `ORACLE_PYTHON` the regeneration unit test is skipped; the committed file is still compared with the app. After a release update, regenerate and review the diff.

## Match groups: `matches.py`

A second script was chosen deliberately: one oracle per module under test, with the graph building shared in shape but not in code. Like `lookup.py` it checks the implementation, not the rule: the old rule is re-implemented from the 2021 code (`git show 339b650:utils/graph_utils.js`), not run against the 2021 server, and `q()` is the same 3-decimal rounding as the app's.

`matches.py` applies the 2021 rule (best match per other database if identity >= 0.9, ties expanded) and the ADR 0004 rule to every entry of the release, and exits non-zero unless: at 0.9 the best-flagged rows equal the old rule with ties expanded, every row is at or above 0.9, and threshold 0 keeps every out-edge. The checks that do not reuse the app's rounding use exact floats and the edge count from the raw JSON links, at 0.9, 0.5 and 0; it also asserts the measured property that in a group with a reciprocal best hit, the best-by-identity row is an RBH (re-checks a release update). `matches_expected.json` holds 7 fixed cases with full results and a count and sha256 over every entry at 0.9, 0.5 and 0 (47577 lines), compared with `matchGroups` by `src/matches.test.ts`. Regenerate the same way as `lookup.py` (`> tests/oracle/matches_expected.json`). In this release identity has 3 decimals for every edge, so exact and 3-decimal comparison agree; coverage is compared at 6 decimals.
