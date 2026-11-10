"""Independent oracle for src/query.ts findEntries: shares no code with the app.

Builds the release graph with networkx and answers a fixed set of lookups by scanning node attributes.
Two outputs in one JSON file: `cases` (a fixed set of lookups with full results) and `sweep` (every searchable
string in the graph: its count and a sha256 over the canonical result lines, so one hash covers all of them).
Usage: python lookup.py data/graph.json > tests/oracle/lookup_expected.json   (networkx 3.7, see README.md)
"""
import hashlib
import json
import sys

import networkx as nx

# (query text, database filter or None). Chosen to cover: composite id, native id, name shared by several
# databases, renamed name (new and old spelling), alternative id, duplicate allele id (also one whose
# composite id is not an entry), and absent ids.
QUERIES = [
    ("card:ARO:3000230", None),
    ("ARO:3000230", None),
    ("ncbi:WP_012695489.1", None),
    ("resfinder:blaNDM-1", None),
    ("blaNDM-1", None),
    ("tet(M)", None),
    ("tetM", None),
    ("vanD", None),
    ("vanD", "ncbi"),
    ("NG_048363.1", None),
    ("WP_063856690.1", None),
    ("NG_050598.1", None),
    ("ncbi:NG_050598.1", None),
    ("card:ARO:3000186", None),
    ("ARO:3000186", None),
    ("3000230", None),
    ("TETM", None),
    ("Tet(M)", None),
    ("WP_012695489", None),
    (" card:ARO:3000230 ", None),
    ("card:ARO:9999999", None),
    ("not an id", None),
]
PRIORITY = ["id", "name", "alternative id", "duplicate allele id"]


def matched_on(attrs, node_id, text):
    """Best way `text` identifies the node, or None."""
    native = node_id.split(":", 1)[1]
    ways = []
    if text == node_id or text == native:
        ways.append("id")
    if attrs["name"] == text:
        ways.append("name")
    if text in attrs.get("alternative_id", {}).values():
        ways.append("alternative id")
    if any(text in accessions for accessions in attrs.get("duplicate_allele_ids", {}).values()):
        ways.append("duplicate allele id")
    return min(ways, key=PRIORITY.index) if ways else None


def sweep(graph):
    """Every searchable string in the graph with the entries it identifies and how (best way), in one pass."""
    table = {}
    for node_id, attrs in graph.nodes(data=True):
        ways = [(node_id, "id"), (node_id.split(":", 1)[1], "id"), (attrs["name"], "name")]
        ways += [(v, "alternative id") for v in attrs.get("alternative_id", {}).values()]
        for accessions in attrs.get("duplicate_allele_ids", {}).values():
            ways += [(a, "duplicate allele id") for a in accessions]
        for text, how in ways:
            best = table.setdefault(text, {})
            if node_id not in best or PRIORITY.index(how) < PRIORITY.index(best[node_id]):
                best[node_id] = how
    lines = [
        json.dumps([text, sorted([n, how] for n, how in table[text].items())], ensure_ascii=False, separators=(",", ":"))
        for text in sorted(table)
    ]
    digest = hashlib.sha256("\n".join(lines).encode("utf-8")).hexdigest()
    return {"count": len(lines), "sha256": digest}


def main(path):
    raw = json.load(open(path))
    graph = nx.DiGraph()
    for node in raw["nodes"]:
        graph.add_node(node["id"], **{k: v for k, v in node.items() if k != "id"})
    cases = []
    for text, database in QUERIES:
        hits = []
        for node_id, attrs in graph.nodes(data=True):
            if database and attrs["database"] != database:
                continue
            way = matched_on(attrs, node_id, text.strip())
            if way:
                hits.append({"id": node_id, "matchedOn": way})
        cases.append({"query": text, "database": database, "results": sorted(hits, key=lambda h: h["id"])})
    graph_sha = hashlib.sha256(open(path, "rb").read()).hexdigest()
    json.dump({"graph_sha256": graph_sha, "cases": cases, "sweep": sweep(graph)}, sys.stdout, indent=1)
    print()


if __name__ == "__main__":
    main(sys.argv[1])
