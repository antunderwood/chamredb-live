"""Independent oracle for src/networkModel.ts buildNetwork: shares no code with the app.

Builds the release graph with networkx and computes the one-step and two-step neighbourhood of an entry:
  step 1: the out-edges of the query with identity >= threshold (3 decimals of the fraction), per other database
          the highest identity is best (ties all best); a group whose top identity is below 0.9 is weak;
  step 2: for each expanded step-1 node, ITS out-edges at the same threshold. A target that is the query or a step-1
          node adds an edge only. A new target is one node, reached via the hit that ranks first (identity, then
          the smaller via id), with the best and weak flags of that hit's group;
  cap:    at most 25 nodes including the query; step-1 nodes are never dropped; the strongest new step-2 nodes
          (identity of the first-ranking hit descending, then id) are kept and the rest counted as dropped.
It FAILS (non-zero exit) unless every fixed case shows the property it is there for (a tie, a weak group, a step-2
edge to the query and to another step-1 node, six matches, a cap hit, a hub), and unless, for every entry, a step-2
node is never a step-1 node or the query and every edge target is a node.
Output: `cases` (fixed entries, thresholds and expanded sets with canonical results) and `sweep` (every entry at
0.9 with all step-1 nodes expanded: count and sha256 over canonical lines).
Canonical form: nodes [id, role, via or "", best, weak] sorted by id; edges [source, target, identity in
thousandths, coverage in millionths, type, step] sorted by (step, source, target).
Usage: python expand.py data/graph.json > tests/oracle/expand_expected.json   (networkx 3.7, see README.md)
"""
import hashlib
import json
import sys

import networkx as nx

CAP = 25
WEAK = 900  # thousandths: a group whose top identity is below this is weak
# (entry, expand: "all" step-1 nodes, "none", or a list of ids, property the case must show, threshold it shows
# it at). Every entry is emitted at both THRESHOLDS; the property is asserted at the named one.
THRESHOLDS = [0.9, 0.5]
CASES = [
    ("card:ARO:3000230", "all", "plain", 0.9),  # one match per other database
    ("card:ARO:3000230", "none", "plain", 0.5),  # nothing expanded: step 1 only
    ("ncbi:WP_003152694.1", "all", "tie", 0.9),  # two resfinder matches tied at 1.0
    ("card:ARO:3000005", "all", "weak", 0.5),  # the resfinder group tops out at 0.79
    ("card:ARO:3000010", "all", "cross", 0.9),  # step 2 reaches the query and another step-1 node
    ("card:ARO:3002546", "all", "six", 0.9),  # the maximum out-degree
    ("card:ARO:3002546", ["resfinder:aac(3)-Ib-aac(6')-Ib"], "six", 0.9),  # only one expanded
    ("card:ARO:3001052", "all", "cap", 0.9),  # 26 nodes uncapped: one dropped
    ("ncbi:WP_187484050.1", "all", "hub", 0.5),  # largest neighbourhood in the release: 29 uncapped
    ("card:ARO:3000198", "all", "oneway", 0.5),  # one-way hits that do not point back
]


def q(fraction):
    """Identity compared at 3 decimals of the fraction (the displayed precision, data contract)."""
    return int(fraction * 1000 + 0.5)


def groups(graph, node, threshold):
    """[(database, [(target, edge, best)])] for the out-edges of node at or above the threshold."""
    by_db = {}
    for _, target, edge in graph.out_edges(node, data=True):
        if q(edge["identity"]) >= q(threshold):
            by_db.setdefault(graph.nodes[target]["database"], []).append((target, edge))
    result = []
    for database in sorted(by_db):
        top = max(q(e["identity"]) for _, e in by_db[database])
        result.append((database, [(t, e, q(e["identity"]) == top) for t, e in by_db[database]], top < WEAK))
    return result


def network(graph, query, threshold, expand):
    nodes = {query: ["query", "", False, False]}
    edges = []
    step1 = []
    for _, rows, weak in groups(graph, query, threshold):
        for target, edge, best in rows:
            nodes[target] = ["match", "", best, weak]
            edges.append((query, target, edge, 1))
            step1.append(target)
    expanded = sorted(step1 if expand == "all" else ([] if expand == "none" else [i for i in expand if i in step1]))
    first = {}  # new node: (identity, via, best, weak) of the hit that ranks first
    extra = []
    for via in expanded:
        for _, rows, weak in groups(graph, via, threshold):
            for target, edge, best in rows:
                extra.append((via, target, edge, 2))
                if target in nodes:
                    continue
                key = (-q(edge["identity"]), via)
                if target not in first or key < first[target][0]:
                    first[target] = (key, best, weak)
    budget = max(0, CAP - len(nodes))
    keep = sorted(first, key=lambda t: (first[t][0][0], t))[:budget]
    for target in keep:
        (_, via), best, weak = first[target]
        nodes[target] = ["step2", via, best, weak]
    edges += [e for e in extra if e[1] in nodes]
    dropped = len(first) - len(keep)
    return nodes, edges, dropped


def canonical(nodes, edges, dropped):
    return {
        "nodes": [[i, *nodes[i]] for i in sorted(nodes)],
        "edges": sorted(
            ([s, t, q(e["identity"]), int(e["coverage"] * 1e6 + 0.5), e["type"], step] for s, t, e, step in edges),
            key=lambda r: (r[5], r[0], r[1]),
        ),
        "dropped": dropped,
    }


def check_case(graph, query, shows, result):
    nodes, edges = result["nodes"], result["edges"]
    roles = {n[0]: n[1] for n in nodes}
    step2 = [e for e in edges if e[5] == 2]
    if shows == "tie":
        best_per_db = {}
        for n in nodes:
            if n[1] == "match" and n[3]:
                database = graph.nodes[n[0]]["database"]
                best_per_db[database] = best_per_db.get(database, 0) + 1
        assert any(c > 1 for c in best_per_db.values()), f"{query}: no tie among best"
    if shows == "weak":
        assert any(n[1] == "match" and n[4] for n in nodes), f"{query}: no weak group"
    if shows == "cross":
        assert any(e[1] == query for e in step2), f"{query}: no step-2 edge to the query"
        assert any(roles[e[1]] == "match" and e[1] != query for e in step2), f"{query}: no step-2 edge to a step-1 node"
    if shows == "six":
        assert sum(1 for n in nodes if n[1] == "match") == 6, f"{query}: not six matches"
    if shows == "cap":
        assert len(nodes) == CAP and result["dropped"] > 0, f"{query}: cap not hit"
    if shows == "hub":
        assert len(nodes) == CAP and result["dropped"] >= 4, f"{query}: not a hub"
    if shows == "oneway":
        assert any(e[4] == "OWH" and e[5] == 1 for e in edges), f"{query}: no one-way match"


def main(path):
    with open(path) as f:
        raw = json.load(f)
    graph = nx.DiGraph()
    for n in raw["nodes"]:
        graph.add_node(n["id"], database=n["database"])
    for link in raw["links"]:
        graph.add_edge(link["source"], link["target"], identity=link["identity"], coverage=link["coverage"], type=link["type"])
    cases = []
    for query, expand, shows, shows_at in CASES:
        if expand not in ("all", "none"):
            assert all(i in graph.nodes for i in expand), f"{query}: unknown expanded id"
        for threshold in THRESHOLDS:
            cn = canonical(*network(graph, query, threshold, expand))
            if threshold == shows_at:
                check_case(graph, query, shows, cn)
            cases.append({"entry": query, "minIdentity": threshold, "expanded": expand, **cn})
    lines = []
    for query in sorted(graph.nodes):
        nodes, edges, dropped = network(graph, query, 0.9, "all")
        roles = {i: v[0] for i, v in nodes.items()}
        n_step1 = sum(1 for r in roles.values() if r == "match")
        assert len(nodes) <= max(CAP, 1 + n_step1), f"{query}: over the cap"
        assert all(s in nodes and t in nodes for s, t, _, _ in edges), f"{query}: edge without a node"
        assert all(v[1] in nodes and roles[v[1]] == "match" for v in nodes.values() if v[0] == "step2"), f"{query}: bad via"
        lines.append(json.dumps([query, canonical(nodes, edges, dropped)], ensure_ascii=False, separators=(",", ":")))
    sweep = {"count": len(lines), "sha256": hashlib.sha256("\n".join(lines).encode("utf-8")).hexdigest()}
    with open(path, "rb") as f:
        graph_sha = hashlib.sha256(f.read()).hexdigest()
    json.dump({"graph_sha256": graph_sha, "cases": cases, "sweep": sweep}, sys.stdout, indent=1)
    print()


if __name__ == "__main__":
    main(sys.argv[1])
