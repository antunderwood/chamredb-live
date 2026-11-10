import type { Entry, Index, ReleaseGraph } from "./types";

// Builds the lookup index. Throws on a malformed release so the page never under-reports:
// duplicate entry id, duplicate edge, or an edge endpoint that is not an entry.
export function buildIndex(graph: ReleaseGraph, release?: string): Index {
  const index: Index = { release, entries: {}, edges: {} };
  for (const n of graph.nodes) {
    if (n.id in index.entries) throw new Error(`Duplicate entry id: ${n.id}`);
    const entry: Entry = {
      id: n.id,
      database: n.database,
      name: n.name,
      phenotype: n.phenotype,
      additionalPhenotype: n.additional_phenotype,
      product: n.product,
      isA: n.is_a,
      pmids: n.PMID ?? [],
      alternativeIds: n.alternative_id ?? {},
      duplicateAlleleIds: n.duplicate_allele_ids ?? {},
    };
    index.entries[n.id] = entry;
  }
  for (const l of graph.links) {
    for (const end of [l.source, l.target]) {
      if (!(end in index.entries)) throw new Error(`Edge ${l.source} -> ${l.target}: unknown entry ${end}`);
    }
    const edges = (index.edges[l.source] ??= []);
    if (edges.some((e) => e.target === l.target)) throw new Error(`Duplicate edge: ${l.source} -> ${l.target}`);
    edges.push({ target: l.target, identity: l.identity, coverage: l.coverage, type: l.type });
  }
  return index;
}
