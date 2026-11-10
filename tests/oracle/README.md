# Lookup oracle

`lookup.py` answers a fixed set of lookups on the pinned release (`data/graph.json`) with networkx, sharing no code with `src/query.ts`. `lookup_expected.json` is its output: 22 fixed cases with full results, plus a count and sha256 over every searchable string in the release (51913), compared with `findEntries` by `src/lookup.test.ts`. The oracle implements the same lookup rule as the app (written separately), so it checks the implementation, not the rule: the rule is recorded in `docs/data-contract.md` and ADR 0004. The file records the sha256 of `data/graph.json`, so a release update fails loudly until it is regenerated.

Pinned: Python 3.14, networkx 3.7 (`requirements.txt`).

Regenerate, and let the test prove the committed file is the script's output:

```
python3 -m venv /tmp/oracle-venv && /tmp/oracle-venv/bin/pip install -r tests/oracle/requirements.txt
/tmp/oracle-venv/bin/python tests/oracle/lookup.py data/graph.json > tests/oracle/lookup_expected.json
ORACLE_PYTHON=/tmp/oracle-venv/bin/python npm test
```

Run the regeneration step with `ORACLE_PYTHON` before merging a change here. Without it (CI) the regeneration test is skipped; the committed file is still compared with the app. After a release update, regenerate and review the diff.
