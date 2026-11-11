import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAX_NODES, buildNetwork, ownMatchCount, visibleEdges, type NetEdge, type NetNode, type Network } from "./networkModel";
import { buildIndex } from "./parse";
import { matchGroups } from "./query";
import type { Database, MatchType, ReleaseGraph } from "./types";

// Two oracles. (1) tests/oracle/expand.py (networkx, no shared code) computes the one-step and two-step
// neighbourhood of fixed entries at 0.9 and 0.5 and of every entry at 0.9 with all step-1 nodes expanded; its
// output is committed and the last test regenerates it when ORACLE_PYTHON is set. (2) Hand-worked cases on the
// 10-entry fixture and on small made-up graphs, expected values worked out in the comments.
type NodeRow = [string, string, string, boolean, boolean]; // id, role, via or "", best, weak
type EdgeRow = [string, string, number, number, string, number]; // source, target, identity in thousandths, coverage in millionths, type, step
interface Canonical { nodes: NodeRow[]; edges: EdgeRow[]; dropped: number }
interface Expected {
  graph_sha256: string;
  cases: ({ entry: string; minIdentity: number; expanded: "all" | "none" | string[] } & Canonical)[];
  sweep: { count: number; sha256: string };
}
const expected = JSON.parse(readFileSync("tests/oracle/expand_expected.json", "utf8")) as Expected;
const provenance = JSON.parse(readFileSync("data/provenance.json", "utf8"));
const graph = JSON.parse(readFileSync("data/graph.json", "utf8")) as ReleaseGraph;
const index = buildIndex(graph);

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0); // UTF-16 code-unit order, as Python sorts these ASCII ids
// The oracle's canonical form: nodes by id, edges by (step, source, target).
const canonical = (n: Network): Canonical => ({
  nodes: n.nodes
    .map((x): NodeRow => [x.id, x.role, x.via ?? "", x.best, x.weak])
    .sort((a, b) => cmp(a[0], b[0])),
  edges: n.edges
    .map((e): EdgeRow => [e.source, e.target, Math.round(e.identity * 1000), Math.floor(e.coverage * 1e6 + 0.5), e.type, e.step])
    .sort((a, b) => a[5] - b[5] || cmp(a[0], b[0]) || cmp(a[1], b[1])),
  dropped: n.truncated?.dropped ?? 0,
});
const ids = (n: Network, role: string) => n.nodes.filter((x) => x.role === role).map((x) => x.id);
const step1Ids = (id: string, t: number) => matchGroups(index, id, t).flatMap((g) => g.matches.map((m) => m.entry.id));

describe("network model on the pinned release agrees with the networkx oracle", () => {
  it("was generated from the pinned graph (after a release update, regenerate it)", () => {
    expect(expected.graph_sha256).toBe(provenance.sha256);
  });
  it("covers a tie, a weak group, the cap, a hub and an edge back to the query", () => {
    const find = (e: string, t: number, x: string) => expected.cases.find((c) => c.entry === e && c.minIdentity === t && (c.expanded === x || x === "any"))!;
    expect(find("ncbi:WP_003152694.1", 0.9, "all").nodes.filter((n) => n[1] === "match" && n[3])).toHaveLength(2);
    expect(find("card:ARO:3000005", 0.5, "all").nodes.some((n) => n[1] === "match" && n[4])).toBe(true);
    expect(find("card:ARO:3001052", 0.9, "all").dropped).toBe(1);
    expect(find("ncbi:WP_187484050.1", 0.5, "all").dropped).toBe(4);
    expect(find("card:ARO:3000010", 0.9, "all").edges.some((e) => e[5] === 2 && e[1] === "card:ARO:3000010")).toBe(true);
    expect(find("card:ARO:3002546", 0.9, "all").nodes.filter((n) => n[1] === "match")).toHaveLength(6);
  });
  for (const c of expected.cases) {
    const label = Array.isArray(c.expanded) ? `expanding ${c.expanded.join(", ")}` : `expanding ${c.expanded}`;
    it(`${c.entry} at ${c.minIdentity}, ${label}`, () => {
      const ids = c.expanded === "all" ? step1Ids(c.entry, c.minIdentity) : c.expanded === "none" ? [] : c.expanded;
      const { dropped, ...rest } = canonical(buildNetwork(index, c.entry, c.minIdentity, ids));
      expect({ ...rest, dropped }).toEqual({ nodes: c.nodes, edges: c.edges, dropped: c.dropped });
    });
  }
  it("agrees on every entry at 0.9 with all step-1 nodes expanded", () => {
    const lines = Object.keys(index.entries)
      .sort()
      .map((id) => JSON.stringify([id, canonical(buildNetwork(index, id, 0.9, step1Ids(id, 0.9)))]));
    expect(lines).toHaveLength(expected.sweep.count);
    expect(createHash("sha256").update(lines.join("\n")).digest("hex")).toBe(expected.sweep.sha256);
  });
  it.skipIf(!process.env.ORACLE_PYTHON)("committed oracle output equals a fresh run of expand.py", () => {
    const fresh = execFileSync(process.env.ORACLE_PYTHON!, ["tests/oracle/expand.py", "data/graph.json"], { encoding: "utf8", maxBuffer: 1 << 26 });
    expect(JSON.parse(fresh)).toEqual(expected);
  });
});

describe("network model invariants on the pinned release", () => {
  const sample = ["card:ARO:3000230", "ncbi:WP_003152694.1", "card:ARO:3000005", "card:ARO:3002546", "card:ARO:3001052", "ncbi:WP_187484050.1"];
  it("step 1 equals matchGroups exactly: same nodes, order, edges and best flags, with or without expansion", () => {
    for (const id of sample) {
      for (const t of [0.9, 0.5]) {
        const groups = matchGroups(index, id, t);
        for (const expanded of [[], step1Ids(id, t)]) {
          const n = buildNetwork(index, id, t, expanded);
          const matches = groups.flatMap((g) => g.matches);
          expect(n.nodes.filter((x) => x.role === "match").map((x) => [x.id, x.best])).toEqual(matches.map((m) => [m.entry.id, m.best]));
          expect(n.edges.filter((e) => e.step === 1).map((e) => [e.source, e.target, e.identity, e.coverage, e.type])).toEqual(
            matches.map((m) => [id, m.entry.id, m.identity, m.coverage, m.type]),
          );
          expect(n.nodes[0]).toMatchObject({ id, role: "query", best: false, weak: false });
        }
      }
    }
  });
  it("is deterministic and independent of the order and repeats in expandedIds", () => {
    const ids = step1Ids("card:ARO:3002546", 0.5);
    const a = buildNetwork(index, "card:ARO:3002546", 0.5, ids);
    expect(buildNetwork(index, "card:ARO:3002546", 0.5, ids)).toEqual(a);
    expect(buildNetwork(index, "card:ARO:3002546", 0.5, [...ids].reverse().concat(ids))).toEqual(a);
  });
  it("never has a step-2 node that is the query or a step-1 node, and never exceeds the cap", () => {
    for (const id of Object.keys(index.entries).filter((_, i) => i % 7 === 0)) {
      const n = buildNetwork(index, id, 0.5, step1Ids(id, 0.5));
      const ids = n.nodes.map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(n.nodes.length).toBeLessThanOrEqual(Math.max(MAX_NODES, 1 + step1Ids(id, 0.5).length));
      for (const x of n.nodes.filter((y) => y.role === "step2")) {
        expect(index.edges[x.via!]!.some((e) => e.target === x.id)).toBe(true); // a match of its via
        expect(n.nodes.find((y) => y.id === x.via)!.role).toBe("match");
      }
    }
  });
});

// Hand-worked on tests/fixtures/graph.json (README beside it lists the edges). Out-edges used here:
//   card:ARO:1000 -> ncbi:WP_1.1 .97 RBH, ncbi:WP_3.1 .97 OWH, resfinder:blaX 1.0 RBH, resfinder:blaXlow .85 OWH,
//                    ncbi:WP_4.1 .9 OWH
//   ncbi:WP_1.1 -> card:ARO:1000 .97 RBH      resfinder:blaX -> card:ARO:1000 1.0 RBH
//   card:ARO:2000 -> ncbi:WP_4.1 .92 RBH (coverage 1.05), resfinder:tetM .88 OWH
//   ncbi:WP_4.1 -> card:ARO:2000 .92 RBH (coverage 1.05)
describe("network model on the hand-worked fixture", () => {
  const fx = buildIndex(JSON.parse(readFileSync("tests/fixtures/graph.json", "utf8")) as ReleaseGraph);

  // Query card:ARO:1000 at 0.9, groups by database (ncbi, resfinder). ncbi shows WP_1.1 .97, WP_3.1 .97 (a tie, both
  // best, in edge order) and WP_4.1 .9 (exactly at the threshold, shown, not best); resfinder shows blaX 1.0 (best),
  // blaXlow .85 is hidden. No group is below 90%, so nothing is weak. Nodes: query, WP_1.1, WP_3.1, WP_4.1, blaX.
  it("step 1 only: the ties are both best, the threshold is inclusive, nothing is weak", () => {
    const n = buildNetwork(fx, "card:ARO:1000", 0.9);
    expect(n.nodes.map((x) => [x.id, x.role, x.best, x.weak])).toEqual([
      ["card:ARO:1000", "query", false, false],
      ["ncbi:WP_1.1", "match", true, false],
      ["ncbi:WP_3.1", "match", true, false],
      ["ncbi:WP_4.1", "match", false, false],
      ["resfinder:blaX", "match", true, false],
    ]);
    expect(n.edges.map((e) => [e.source, e.target, e.identity, e.type, e.step])).toEqual([
      ["card:ARO:1000", "ncbi:WP_1.1", 0.97, "RBH", 1],
      ["card:ARO:1000", "ncbi:WP_3.1", 0.97, "OWH", 1],
      ["card:ARO:1000", "ncbi:WP_4.1", 0.9, "OWH", 1],
      ["card:ARO:1000", "resfinder:blaX", 1.0, "RBH", 1],
    ]);
    expect(n.truncated).toBeUndefined();
  });

  // Expanding WP_1.1 (its only out-edge goes back to the query, .97) and blaX (back to the query, 1.0): no new
  // node, two extra edges drawn between existing nodes and marked step 2. The query is not duplicated.
  it("a step-2 hit on the query adds an edge, not a node", () => {
    const n = buildNetwork(fx, "card:ARO:1000", 0.9, ["ncbi:WP_1.1", "resfinder:blaX"]);
    expect(n.nodes).toHaveLength(5);
    expect(n.edges.filter((e) => e.step === 2).map((e) => [e.source, e.target, e.identity, e.type])).toEqual([
      ["ncbi:WP_1.1", "card:ARO:1000", 0.97, "RBH"],
      ["resfinder:blaX", "card:ARO:1000", 1.0, "RBH"],
    ]);
  });

  // WP_4.1 (a match of the query) has one match, card:ARO:2000 (.92, RBH, coverage 1.05). card:ARO:2000 is NOT a
  // match of the query (it is not in the step-1 list above), so it is a step-2 node "match of ncbi:WP_4.1". Its group
  // (card) has one member, so it is best, and .92 is not below 90%, so not weak.
  it("a match of a match is a step-2 node reached via its match, never a match of the query", () => {
    const n = buildNetwork(fx, "card:ARO:1000", 0.9, ["ncbi:WP_4.1"]);
    const node = n.nodes.find((x) => x.id === "card:ARO:2000")!;
    expect(node).toMatchObject({ role: "step2", via: "ncbi:WP_4.1", best: true, weak: false, hit: { identity: 0.92, coverage: 1.05, type: "RBH" } });
    expect(ids(n, "match")).not.toContain("card:ARO:2000");
    expect(n.edges.at(-1)).toEqual({ source: "ncbi:WP_4.1", target: "card:ARO:2000", identity: 0.92, coverage: 1.05, type: "RBH", step: 2 });
    expect(n.edges.filter((e) => e.step === 1)).toHaveLength(4); // step 1 unchanged by the expansion
  });

  // Query ncbi:WP_4.1 at 0.8: matches card:ARO:2000 (.92). Expanding it at the same 0.8: ncbi:WP_4.1 (.92, the query,
  // edge only) and resfinder:tetM (.88). tetM is a new step-2 node; its group (resfinder) has one member with
  // identity .88 < .9, so it is best but weak ("highest identity shown").
  it("a step-2 node in a group below 90% is weak, with the same rule as the list", () => {
    const n = buildNetwork(fx, "ncbi:WP_4.1", 0.8, ["card:ARO:2000"]);
    expect(n.nodes.map((x) => [x.id, x.role, x.via ?? "", x.best, x.weak])).toEqual([
      ["ncbi:WP_4.1", "query", "", false, false],
      ["card:ARO:2000", "match", "", true, false],
      ["resfinder:tetM", "step2", "card:ARO:2000", true, true],
    ]);
    expect(n.edges.map((e) => [e.source, e.target, e.step])).toEqual([
      ["ncbi:WP_4.1", "card:ARO:2000", 1],
      ["card:ARO:2000", "ncbi:WP_4.1", 2],
      ["card:ARO:2000", "resfinder:tetM", 2],
    ]);
    // At 0.9 the expansion uses the same minimum identity: tetM (.88) is not added.
    expect(ids(buildNetwork(fx, "ncbi:WP_4.1", 0.9, ["card:ARO:2000"]), "step2")).toEqual([]);
  });

  it("an entry with no matches has the query node only, and expanding ids that are not step-1 nodes does nothing", () => {
    expect(buildNetwork(fx, "resfinder:orphan", 0.9, ["resfinder:orphan"])).toEqual({
      nodes: [{ id: "resfinder:orphan", database: "resfinder", name: "orphan", role: "query", best: false, weak: false }],
      edges: [],
    });
    const base = buildNetwork(fx, "card:ARO:1000", 0.9);
    // the query itself, a hidden match (blaXlow is .85), an entry that is nowhere near, a step-2 id
    expect(buildNetwork(fx, "card:ARO:1000", 0.9, ["card:ARO:1000", "resfinder:blaXlow", "resfinder:tetM", "card:ARO:2000"])).toEqual(base);
  });
  it("rejects an unknown query", () => {
    expect(() => buildNetwork(fx, "card:ARO:9999", 0.9)).toThrow(/Unknown entry/);
  });
});

// Made-up graphs for the cap, a step-2 node reached from two entries, and a step-2 hit on another step-1 node.
const mk = (nodes: [string, Database][], links: [string, string, number, MatchType?][]) =>
  buildIndex({
    nodes: nodes.map(([id, database]) => ({ id, database, name: id })),
    links: links.map(([source, target, identity, type = "RBH"]) => ({ source, target, identity, coverage: 1, type })),
  });
const pad = (k: number) => String(k).padStart(2, "0");

describe("network model: cap, duplicates and extra edges (hand-worked on made-up graphs)", () => {
  // Hub card:hub with six matches ncbi:m1..m6 (identity 1.0). Match m_i has four own matches resfinder:s<k>, k = 4(i-1)+j-1
  // for j = 1..4, identity (100 - k)/100: 1.00, 0.99, ... 0.77 (24 distinct). All six expanded at 0.5: 24 candidates.
  // Budget: 25 - (1 query + 6 matches) = 18. The strongest 18 are k = 0..17 (identity 1.00 down to 0.83): m1..m4
  // keep all four, m5 keeps s16 and s17, m6 none. Dropped: 24 - 18 = 6 (k = 18..23, identity .82 to .77).
  const hub = mk(
    [["card:hub", "card"], ...[1, 2, 3, 4, 5, 6].map((i): [string, Database] => [`ncbi:m${i}`, "ncbi"]), ...Array.from({ length: 24 }, (_, k): [string, Database] => [`resfinder:s${pad(k)}`, "resfinder"])],
    [
      ...[1, 2, 3, 4, 5, 6].map((i): [string, string, number] => ["card:hub", `ncbi:m${i}`, 1.0]),
      ...Array.from({ length: 24 }, (_, k): [string, string, number] => [`ncbi:m${Math.floor(k / 4) + 1}`, `resfinder:s${pad(k)}`, (100 - k) / 100]),
    ],
  );
  const six = [1, 2, 3, 4, 5, 6].map((i) => `ncbi:m${i}`);
  it("cap: keeps the strongest 18 step-2 nodes in via order, reports 6 dropped, draws no edge to a dropped node", () => {
    const n = buildNetwork(hub, "card:hub", 0.5, six);
    expect(n.nodes).toHaveLength(MAX_NODES);
    expect(MAX_NODES).toBe(25);
    expect(n.truncated).toEqual({ dropped: 6 });
    expect(ids(n, "step2")).toEqual(Array.from({ length: 18 }, (_, k) => `resfinder:s${pad(k)}`));
    expect(n.nodes.find((x) => x.id === "resfinder:s17")).toMatchObject({ via: "ncbi:m5", best: false, weak: true }); // m5's four are .84 to .81: s17 (.83) is not best, the group is weak
    expect(n.edges).toHaveLength(6 + 18);
    expect(n.edges.some((e) => e.target === "resfinder:s18")).toBe(false);
  });
  it("cap: below the cap nothing is reported dropped, and expanding fewer entries stays under it", () => {
    const n = buildNetwork(hub, "card:hub", 0.5, six.slice(0, 2)); // 1 + 6 + 8 = 15
    expect(n.nodes).toHaveLength(15);
    expect(n.truncated).toBeUndefined();
  });
  function ties() {
    // Six matches m1..m6 (budget 25 - 7 = 18); m1 has 20 own matches t01..t20, all at identity .9, listed in the file in
    // reverse id order: the cap keeps by id (t01..t18), not by edge order.
    return mk(
      [["card:q", "card"], ...[1, 2, 3, 4, 5, 6].map((i): [string, Database] => [`ncbi:m${i}`, "ncbi"]), ...Array.from({ length: 20 }, (_, k): [string, Database] => [`resfinder:t${pad(k + 1)}`, "resfinder"])],
      [
        ...[1, 2, 3, 4, 5, 6].map((i): [string, string, number] => ["card:q", `ncbi:m${i}`, 1.0]),
        ...Array.from({ length: 20 }, (_, k): [string, string, number] => ["ncbi:m1", `resfinder:t${pad(20 - k)}`, 0.9]),
      ],
    );
  }
  it("cap: equal identities are dropped in id code-unit order (t19 and t20), not edge order", () => {
    const n = buildNetwork(ties(), "card:q", 0.9, ["ncbi:m1"]);
    expect(ids(n, "step2").sort()).toEqual(Array.from({ length: 18 }, (_, k) => `resfinder:t${pad(k + 1)}`));
    expect(n.truncated).toEqual({ dropped: 2 });
  });

  // q (card) matches a (ncbi) and b (ncbi); a and b both match x (resfinder). Expanding both: x appears once. At .95
  // from a and .97 from b the higher identity ranks first, so via is b; at .96 from both, the smaller via id (a).
  const two = (ia: number, ib: number) =>
    mk(
      [["card:q", "card"], ["ncbi:a", "ncbi"], ["ncbi:b", "ncbi"], ["resfinder:x", "resfinder"]],
      [["card:q", "ncbi:a", 1], ["card:q", "ncbi:b", 1], ["ncbi:a", "resfinder:x", ia], ["ncbi:b", "resfinder:x", ib]],
    );
  it("a step-2 node reached from two expanded entries is drawn once, via the higher identity, with both edges", () => {
    const n = buildNetwork(two(0.95, 0.97), "card:q", 0.9, ["ncbi:b", "ncbi:a"]);
    expect(n.nodes.filter((x) => x.id === "resfinder:x")).toEqual([
      { id: "resfinder:x", database: "resfinder", name: "resfinder:x", role: "step2", via: "ncbi:b", best: true, weak: false, hit: { identity: 0.97, coverage: 1, type: "RBH" } },
    ]);
    expect(n.edges.filter((e) => e.target === "resfinder:x").map((e) => [e.source, e.step])).toEqual([["ncbi:a", 2], ["ncbi:b", 2]]);
  });
  it("a tie in identity between two vias goes to the smaller via id", () => {
    const n = buildNetwork(two(0.96, 0.96), "card:q", 0.9, ["ncbi:b", "ncbi:a"]);
    expect(n.nodes.find((x) => x.id === "resfinder:x")!.via).toBe("ncbi:a");
  });

  // q matches a (ncbi, 1.0) and b (resfinder, .8: alone in its group, below 90%, so b is best and weak). a matches b
  // (.99). Expanding a draws a -> b as a step-2 edge between existing nodes; b stays a match of the query with the
  // flags it has as a match of the query (weak), not the flags it would have as a match of a (not weak).
  it("a step-2 hit on another step-1 node adds an edge only and keeps that node's step-1 role and flags", () => {
    const g = mk(
      [["card:q", "card"], ["ncbi:a", "ncbi"], ["resfinder:b", "resfinder"]],
      [["card:q", "ncbi:a", 1], ["card:q", "resfinder:b", 0.8], ["ncbi:a", "resfinder:b", 0.99]],
    );
    const n = buildNetwork(g, "card:q", 0.5, ["ncbi:a"]);
    expect(n.nodes).toHaveLength(3);
    expect(n.nodes.find((x) => x.id === "resfinder:b")).toMatchObject({ role: "match", best: true, weak: true });
    expect(n.nodes.find((x) => x.id === "resfinder:b")!.via).toBeUndefined();
    expect(n.edges.at(-1)).toMatchObject({ source: "ncbi:a", target: "resfinder:b", identity: 0.99, step: 2 });
  });
});

// visibleEdges and ownMatchCount, hand-worked.
describe("visibleEdges: the reverse of an RBH match is hidden by default, nothing else", () => {
  const fx = buildIndex(JSON.parse(readFileSync("tests/fixtures/graph.json", "utf8")) as ReleaseGraph);
  it("fixture: expanding WP_1.1, blaX (RBH with the query, which list it back) and WP_4.1", () => {
    // card:ARO:1000 at 0.9: WP_1.1 RBH and blaX RBH (both list the query back, so step-2 edges to the query), WP_4.1
    // OWH (its own match is card:ARO:2000, a new step-2 node). Two reverse edges are hidden.
    const n = buildNetwork(fx, "card:ARO:1000", 0.9, ["ncbi:WP_1.1", "resfinder:blaX", "ncbi:WP_4.1"]);
    const v = visibleEdges(n);
    expect(v.hidden).toBe(2);
    expect(v.edges.filter((e) => e.step === 2).map((e) => `${e.source}>${e.target}`)).toEqual(["ncbi:WP_4.1>card:ARO:2000"]);
    expect(v.edges.filter((e) => e.step === 1)).toHaveLength(4);
  });
  it("a reverse hit behind a one-way match stays visible (made-up: q to b is OWH and b lists q back)", () => {
    const node = (id: string, role: NetNode["role"]): NetNode => ({ id, database: "card", name: id, role, best: false, weak: false });
    const e = (source: string, target: string, type: "RBH" | "OWH", step: 1 | 2): NetEdge => ({ source, target, identity: 1, coverage: 1, type, step });
    const net = {
      nodes: [node("q", "query"), node("a", "match"), node("b", "match")],
      edges: [e("q", "a", "RBH", 1), e("q", "b", "OWH", 1), e("a", "q", "RBH", 2), e("b", "q", "OWH", 2), e("a", "b", "OWH", 2)],
    };
    const v = visibleEdges(net);
    expect(v.hidden).toBe(1); // only a to q
    expect(v.edges.map((x) => `${x.source}>${x.target}`)).toEqual(["q>a", "q>b", "b>q", "a>b"]);
  });
  it("nothing to hide when nothing is expanded", () => {
    expect(visibleEdges(buildNetwork(fx, "card:ARO:1000", 0.9)).hidden).toBe(0);
  });
});

// Weak cue per node: a step-1 match that is below the 90% line and is not the best of its group.
describe("below: the per-node weak cue (a plain mark, never the words Best or Highest identity shown)", () => {
  const fx = buildIndex(JSON.parse(readFileSync("tests/fixtures/graph.json", "utf8")) as ReleaseGraph);
  const below = (n: Network) => n.nodes.filter((x) => x.below).map((x) => x.id);
  it("fixture at 80%: blaXlow (0.85) sits under the best blaX (1.0) of a healthy group, so it has the cue and no ribbon flag", () => {
    const n = buildNetwork(fx, "card:ARO:1000", 0.8);
    expect(below(n)).toEqual(["resfinder:blaXlow"]);
    const low = n.nodes.find((x) => x.id === "resfinder:blaXlow")!;
    expect([low.best, low.weak]).toEqual([false, false]);
  });
  it("fixture: exactly 0.9 is not below (WP_4.1), and the top of a weak group is 'Highest identity shown', not below (tetM 0.88)", () => {
    expect(below(buildNetwork(fx, "card:ARO:1000", 0.9))).toEqual([]);
    const n = buildNetwork(fx, "card:ARO:2000", 0.8);
    expect(below(n)).toEqual([]);
    expect(n.nodes.find((x) => x.id === "resfinder:tetM")).toMatchObject({ best: true, weak: true });
  });
  it("made-up weak group: 0.88 is Highest identity shown, 0.85 and 0.80 are below; a tie at the top has no cue on either", () => {
    const g = mk(
      [["card:q", "card"], ["ncbi:a", "ncbi"], ["ncbi:b", "ncbi"], ["ncbi:c", "ncbi"], ["resfinder:t1", "resfinder"], ["resfinder:t2", "resfinder"]],
      [["card:q", "ncbi:a", 0.88], ["card:q", "ncbi:b", 0.85], ["card:q", "ncbi:c", 0.8], ["card:q", "resfinder:t1", 0.86], ["card:q", "resfinder:t2", 0.86]],
    );
    const n = buildNetwork(g, "card:q", 0.5);
    expect(below(n)).toEqual(["ncbi:b", "ncbi:c"]);
    expect(n.nodes.filter((x) => x.best).map((x) => x.id)).toEqual(["ncbi:a", "resfinder:t1", "resfinder:t2"]);
  });
  it("step-2 nodes never carry it (their identity is relative to the entry they are a match of)", () => {
    const g = mk([["card:q", "card"], ["ncbi:a", "ncbi"], ["resfinder:x", "resfinder"]], [["card:q", "ncbi:a", 0.95], ["ncbi:a", "resfinder:x", 0.6]]);
    expect(below(buildNetwork(g, "card:q", 0.5, ["ncbi:a"]))).toEqual([]);
  });
});

// Two RBH matches of the query that are RBH with each other: both directions are step-2 edges between the same two
// nodes and would be drawn on top of each other, each with two arrowheads.
describe("visibleEdges: a reciprocal RBH pair between two matches is drawn once", () => {
  const node = (id: string, role: NetNode["role"]): NetNode => ({ id, database: "card", name: id, role, best: false, weak: false });
  const e = (source: string, target: string, type: "RBH" | "OWH", step: 1 | 2): NetEdge => ({ source, target, identity: 1, coverage: 1, type, step });
  const nodes = [node("q", "query"), node("a", "match"), node("b", "match"), node("c", "match")];
  const pair = (t1: "RBH" | "OWH", t2: "RBH" | "OWH") => ({ nodes, edges: [e("q", "a", "RBH", 1), e("q", "b", "RBH", 1), e("a", "b", t1, 2), e("b", "a", t2, 2)] });
  const drawn = (n: ReturnType<typeof pair>) => visibleEdges(n).edges.filter((x) => x.step === 2).map((x) => `${x.source}>${x.target}`);
  it("RBH both ways: the first (a to b) is kept, the second is merged and counted", () => {
    expect(drawn(pair("RBH", "RBH"))).toEqual(["a>b"]);
    expect(visibleEdges(pair("RBH", "RBH"))).toMatchObject({ hidden: 0, merged: 1 });
  });
  it("one-way hits in both directions are two separate hits and both stay", () => {
    expect(drawn(pair("OWH", "OWH"))).toEqual(["a>b", "b>a"]);
    expect(visibleEdges(pair("OWH", "OWH")).merged).toBe(0);
  });
  it("only one direction listed, or different types: nothing is merged", () => {
    expect(drawn({ nodes, edges: [e("q", "a", "RBH", 1), e("q", "b", "RBH", 1), e("a", "b", "RBH", 2)] })).toEqual(["a>b"]);
    expect(drawn(pair("RBH", "OWH"))).toEqual(["a>b", "b>a"]);
  });
  it("pairs are independent: a to c RBH both ways and a to b RBH both ways leave one edge each", () => {
    const n = { nodes, edges: [e("q", "a", "RBH", 1), e("a", "b", "RBH", 2), e("b", "a", "RBH", 2), e("a", "c", "RBH", 2), e("c", "a", "RBH", 2)] };
    expect(drawn(n)).toEqual(["a>b", "a>c"]);
    expect(visibleEdges(n).merged).toBe(2);
  });
  it("release: card:ARO:3000010 (vanA) with its two RBH matches both expanded draws their link once", () => {
    const n = buildNetwork(index, "card:ARO:3000010", 0.9, ["ncbi:WP_063856521.1", "resfinder:VanHAX"]);
    const links = n.edges.filter((x) => x.step === 2 && x.source !== "card:ARO:3000010" && ["ncbi:WP_063856521.1", "resfinder:VanHAX"].includes(x.target));
    expect(links.map((x) => `${x.source}>${x.target}`).sort()).toEqual(["ncbi:WP_063856521.1>resfinder:VanHAX", "resfinder:VanHAX>ncbi:WP_063856521.1"]);
    expect(visibleEdges(n).merged).toBe(1);
    expect(visibleEdges(buildNetwork(index, "card:ARO:3000010", 0.9, ["ncbi:WP_063856521.1"])).merged).toBe(0);
  });
});

describe("ownMatchCount: the number the expand control promises", () => {
  const fx = buildIndex(JSON.parse(readFileSync("tests/fixtures/graph.json", "utf8")) as ReleaseGraph);
  it("fixture: WP_4.1 lists card:ARO:2000 (0.92) and the query does not count; WP_1.1 lists only the query", () => {
    expect(ownMatchCount(fx, "ncbi:WP_4.1", 0.9, "card:ARO:1000")).toBe(1); // card:ARO:2000
    expect(ownMatchCount(fx, "ncbi:WP_1.1", 0.9, "card:ARO:1000")).toBe(0); // only the query (0.97)
    expect(ownMatchCount(fx, "ncbi:WP_4.1", 0.95, "card:ARO:1000")).toBe(0); // 0.92 is under 0.95
  });
  it("counts every own match when the query is not among them", () => {
    const all = matchGroups(index, "card:ARO:3002546", 0.9).reduce((n, g) => n + g.matches.length, 0);
    expect(all).toBe(6); // the six-match entry (raw read: out-degree 6)
    expect(ownMatchCount(index, "card:ARO:3002546", 0.9, "ncbi:not-a-match")).toBe(6);
  });
});
