"""Independent oracle for src/query.ts matchGroups: shares no code with the app.

Builds the release graph with networkx and applies two rules to every entry:
  - the OLD rule of the 2021 site (per other database, the highest-identity match if it is >= 0.9; ties
    were broken arbitrarily, here expanded to all tied edges), and
  - the NEW rule of ADR 0004 (per other database, every match with identity >= threshold, best flagged).
It FAILS (non-zero exit) unless, for every entry at threshold 0.9, the best-flagged rows of the new rule equal
the old rule with ties expanded and every row has identity >= 0.9, and unless threshold 0 keeps every out-edge.
Output: `cases` (fixed entries and thresholds with full results) and `sweep` (every entry at thresholds
0.9, 0.5 and 0: count and sha256 over canonical lines).
Usage: python matches.py data/graph.json > tests/oracle/matches_expected.json   (networkx 3.7, see README.md)
"""
import hashlib
import json
import sys

import networkx as nx

THRESHOLDS = [0.9, 0.5, 0.0]
CASES = [
    ("card:ARO:3000230", 0.9),  # homepage example: one match per other database
    ("card:ARO:3000230", 0.5),
    ("card:ARO:3000230", 0.0),
    ("ncbi:WP_003152694.1", 0.9),  # two resfinder matches tied at identity 1.0
    ("card:ARO:3000005", 0.9),  # resfinder match at 0.79 hidden by default
    ("card:ARO:3000005", 0.5),  # ... and shown at 0.5
    ("card:ARO:3000579", 0.9),  # several resfinder matches at or above 0.9, not all best
    ("card:ARO:3003873", 0.5),  # has a match at identity exactly 0.5: included at 0.5 (inclusive threshold)
]


def q(fraction):
    """Identity compared at 3 decimals of the fraction (the displayed precision, data contract)."""
    return int(fraction * 1000 + 0.5)


def new_rule(graph, node, threshold):
    by_db = {}
    for _, target, edge in graph.out_edges(node, data=True):
        if q(edge["identity"]) >= q(threshold):
            by_db.setdefault(graph.nodes[target]["database"], []).append((target, edge))
    groups = []
    for database in sorted(by_db):
        rows = sorted(by_db[database], key=lambda row: -row[1]["identity"])  # stable: ties keep edge order, which equals links-file order because edges are added in that order below
        best = max(q(edge["identity"]) for _, edge in rows)
        groups.append(
            [database, [[t, q(e["identity"]), int(e["coverage"] * 1e6 + 0.5), e["type"], q(e["identity"]) == best] for t, e in rows]]
        )
    return groups


def old_rule(graph, node):
    """{target} per database the 2021 site would show, with ties expanded."""
    by_db = {}
    for _, target, edge in graph.out_edges(node, data=True):
        by_db.setdefault(graph.nodes[target]["database"], []).append((target, edge["identity"]))
    shown = {}
    for database, rows in by_db.items():
        top = max(identity for _, identity in rows)
        if top >= 0.9:
            shown[database] = {t for t, identity in rows if identity == top}
    return shown


def check(graph, node, out_edges):
    """Checks that do not reuse the app's rounding: exact floats, and the edge count from the raw JSON links."""
    default = new_rule(graph, node, 0.9)
    best = {database: {r[0] for r in rows if r[4]} for database, rows in default}
    assert best == old_rule(graph, node), f"{node}: best-flagged rows differ from the old rule"
    assert all(r[1] >= 900 for _, rows in default for r in rows), f"{node}: a row below 0.9"
    assert sum(len(rows) for _, rows in new_rule(graph, node, 0.0)) == len(out_edges), f"{node}: edges lost at 0"
    for t in THRESHOLDS:
        exact = sum(1 for e in out_edges if e["identity"] >= t)  # exact floats; identities have 3 decimals here
        assert sum(len(rows) for _, rows in new_rule(graph, node, t)) == exact, f"{node}: row count at {t}"
    # Measured on this release: a one-way best match never outranks a reciprocal best hit in the same group.
    for database, rows in new_rule(graph, node, 0.0):
        if any(r[3] == "RBH" for r in rows):
            assert any(r[3] == "RBH" and r[4] for r in rows), f"{node}/{database}: best is OWH while an RBH exists"


def main(path):
    raw = json.load(open(path))
    graph = nx.DiGraph()
    for n in raw["nodes"]:
        graph.add_node(n["id"], database=n["database"])
    for l in raw["links"]:
        graph.add_edge(l["source"], l["target"], identity=l["identity"], coverage=l["coverage"], type=l["type"])
    out_edges = {}
    for l in raw["links"]:
        out_edges.setdefault(l["source"], []).append(l)
    for node in graph.nodes:
        check(graph, node, out_edges.get(node, []))
    lines = [
        json.dumps([node, int(t * 100 + 0.5), new_rule(graph, node, t)], ensure_ascii=False, separators=(",", ":"))
        for node in sorted(graph.nodes)
        for t in THRESHOLDS
    ]
    sweep = {"count": len(lines), "sha256": hashlib.sha256("\n".join(lines).encode("utf-8")).hexdigest()}
    cases = [{"entry": n, "minIdentity": t, "groups": new_rule(graph, n, t)} for n, t in CASES]
    graph_sha = hashlib.sha256(open(path, "rb").read()).hexdigest()
    json.dump({"graph_sha256": graph_sha, "cases": cases, "sweep": sweep}, sys.stdout, indent=1)
    print()


if __name__ == "__main__":
    main(sys.argv[1])
