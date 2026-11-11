import { matchGroups } from "./query";
import type { Database, Index, MatchType } from "./types";

// Pure data model of the interactive network (tickets #9 and #10): which nodes and edges to draw, with no
// geometry (networkLayout.ts) and no rendering. Step 1 is exactly matchGroups(query). Expanding a step-1 entry
// adds that entry's OWN matches (matchGroups again, at the same minimum identity) as step-2 nodes: a match of a
// match, never a match of the query. Every step-2 node carries `via`, so the UI can always say "match of <via>".

export const MAX_NODES = 25; // drawn nodes in total, the query included
export const WEAK_BELOW = 0.9; // a group whose top identity is under this has no "best" (ADR 0004), as in the list

// Identity is compared at 3 decimals of the fraction (data contract), the same rounding as matchGroups.
const q = (fraction: number) => Math.round(fraction * 1000);
const byCodeUnit = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export type Role = "query" | "match" | "step2";
// The hit that put a match or step-2 node on the picture: for a match, the query's edge to it; for a step-2 node,
// the edge from `via` that ranks first (highest identity at 3 decimals, then the smaller via id).
export interface Hit {
  identity: number;
  coverage: number;
  type: MatchType;
}
export interface NetNode {
  id: string;
  database: Database;
  name: string;
  role: Role;
  via?: string; // step-2 only: the expanded entry this node was reached from
  best: boolean; // highest identity of its database group among the shown matches (ties all best); false for the query
  weak: boolean; // its group's top identity is below WEAK_BELOW: "highest identity shown", never "best"
  hit?: Hit; // absent for the query
}
export interface NetEdge {
  source: string;
  target: string; // direction: from source to target, as stored in the release
  identity: number;
  coverage: number;
  type: MatchType;
  step: 1 | 2;
}
export interface Network {
  nodes: NetNode[]; // query, then step-1 nodes in list order, then step-2 nodes by via order
  edges: NetEdge[]; // step-1 edges in list order, then step-2 edges by via order
  truncated?: { dropped: number }; // present only when the cap removed step-2 nodes
}

// expandedIds: entries whose own matches to add. Only step-1 nodes can be expanded (there is no third step);
// other ids are ignored, and order and duplicates do not matter. Step-1 nodes are never dropped: the list shows
// them all, so only step-2 nodes count against MAX_NODES. A step-2 hit on the query or on a step-1 node adds an
// edge between the existing nodes (step 2) and no node. When a new step-2 node is reachable from several
// expanded entries it appears once, with the first-ranking hit as `via` and flags.
export function buildNetwork(index: Index, queryId: string, minIdentity: number, expandedIds: Iterable<string> = []): Network {
  const query = index.entries[queryId]!;
  if (!Object.hasOwn(index.entries, queryId)) throw new Error(`Unknown entry: ${queryId}`);
  const nodes: NetNode[] = [{ id: query.id, database: query.database, name: query.name, role: "query", best: false, weak: false }];
  const edges: NetEdge[] = [];
  for (const g of matchGroups(index, queryId, minIdentity)) {
    const weak = q(Math.max(...g.matches.map((m) => m.identity))) < q(WEAK_BELOW);
    for (const m of g.matches) {
      const { id, database, name } = m.entry;
      nodes.push({ id, database, name, role: "match", best: m.best, weak, hit: { identity: m.identity, coverage: m.coverage, type: m.type } });
      edges.push({ source: queryId, target: id, identity: m.identity, coverage: m.coverage, type: m.type, step: 1 });
    }
  }
  const known = new Set(nodes.map((n) => n.id));
  const wanted = new Set(expandedIds);
  const expanded = nodes.filter((n) => n.role === "match" && wanted.has(n.id));

  // Candidate new nodes by id, each holding the hit that ranks first (identity, then via id) and the sequence
  // number of its first appearance (the order of the step-2 column within one via).
  interface Candidate { node: NetNode; seq: number }
  const candidates = new Map<string, Candidate>();
  const step2: NetEdge[] = [];
  let seq = 0;
  for (const via of expanded) {
    for (const g of matchGroups(index, via.id, minIdentity)) {
      const weak = q(Math.max(...g.matches.map((m) => m.identity))) < q(WEAK_BELOW);
      for (const m of g.matches) {
        const { id, database, name } = m.entry;
        step2.push({ source: via.id, target: id, identity: m.identity, coverage: m.coverage, type: m.type, step: 2 });
        if (known.has(id)) continue; // the query or a step-1 node: an extra edge only
        const hit = { identity: m.identity, coverage: m.coverage, type: m.type };
        const node: NetNode = { id, database, name, role: "step2", via: via.id, best: m.best, weak, hit };
        const seen = candidates.get(id);
        const ranksFirst = !seen || q(hit.identity) > q(seen.node.hit!.identity) || (q(hit.identity) === q(seen.node.hit!.identity) && byCodeUnit(via.id, seen.node.via!) < 0);
        if (ranksFirst) candidates.set(id, { node, seq });
        seq++;
      }
    }
  }
  // Cap: keep the strongest new nodes (highest identity of their first-ranking hit, then id) until the cap.
  const budget = Math.max(0, MAX_NODES - nodes.length);
  const ranked = [...candidates.values()].sort((a, b) => q(b.node.hit!.identity) - q(a.node.hit!.identity) || byCodeUnit(a.node.id, b.node.id));
  const kept = ranked.slice(0, budget);
  const keptIds = new Set(kept.map((c) => c.node.id));
  const order = new Map(expanded.map((n, i) => [n.id, i]));
  kept.sort((a, b) => order.get(a.node.via!)! - order.get(b.node.via!)! || a.seq - b.seq);
  nodes.push(...kept.map((c) => c.node));
  edges.push(...step2.filter((e) => known.has(e.target) || keptIds.has(e.target)));
  const dropped = ranked.length - kept.length;
  return dropped > 0 ? { nodes, edges, truncated: { dropped } } : { nodes, edges };
}
