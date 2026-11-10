import { describe, expect, it } from "vitest";
import graph from "../tests/fixtures/graph.json";
import { buildIndex } from "./parse";
import { findEntries, matchGroups } from "./query";
import type { ReleaseGraph } from "./types";

// Expected values are worked by hand in tests/fixtures/README.md.
const index = buildIndex(graph as ReleaseGraph);

const summary = (query: string, threshold: number) =>
  matchGroups(index, query, threshold).map((g) => ({
    db: g.database,
    matches: g.matches.map((m) => [m.entry.id, m.identity, m.type, m.best]),
  }));

describe("buildIndex", () => {
  it("keeps every entry and edge of the fixture", () => {
    expect(Object.keys(index.entries)).toHaveLength(10);
    expect(Object.values(index.edges).flat()).toHaveLength(10);
    const perDb = (db: string) => Object.values(index.entries).filter((e) => e.database === db).length;
    expect([perDb("card"), perDb("ncbi"), perDb("resfinder")]).toEqual([2, 3, 5]);
  });
  it("flattens alternative and duplicate allele ids", () => {
    const e = index.entries["ncbi:WP_1.1"];
    expect(e.alternativeIds).toEqual(["NG_1.1"]);
    expect(e.duplicateAlleleIds).toEqual(["NG_2.1", "WP_2.1"]);
  });
});

describe("findEntries", () => {
  it("finds one entry by composite or native id", () => {
    expect(findEntries(index, "card:ARO:1000").map((c) => c.id)).toEqual(["card:ARO:1000"]);
    expect(findEntries(index, "ARO:2000").map((c) => c.id)).toEqual(["card:ARO:2000"]);
  });
  it("returns both candidates when a native id is shared by two databases", () => {
    expect(findEntries(index, "ARO:1000").map((c) => c.id)).toEqual(["card:ARO:1000", "resfinder:ARO:1000"]);
  });
  it("is case-sensitive", () => {
    expect(findEntries(index, "aro:1000")).toEqual([]);
  });
  it("returns nothing for an unknown id", () => {
    expect(findEntries(index, "ARO:9999")).toEqual([]);
  });
});

describe("matchGroups", () => {
  it("flags both tied best matches and hides matches under the threshold", () => {
    expect(summary("card:ARO:1000", 0.9)).toEqual([
      {
        db: "ncbi",
        matches: [
          ["ncbi:WP_1.1", 0.97, "RBH", true],
          ["ncbi:WP_3.1", 0.97, "OWH", true],
          ["ncbi:WP_4.1", 0.9, "OWH", false], // exactly at the threshold: shown, not best
        ],
      },
      { db: "resfinder", matches: [["resfinder:blaX", 1, "RBH", true]] },
    ]);
  });
  it("threshold 0 keeps every edge of every entry (invariant 1)", () => {
    for (const [id, edges] of Object.entries(index.edges)) {
      const shown = matchGroups(index, id, 0).reduce((n, g) => n + g.matches.length, 0);
      expect(shown).toBe(edges.length);
    }
  });
  it("threshold 0 keeps the low-identity resfinder match", () => {
    expect(summary("card:ARO:1000", 0).find((g) => g.db === "resfinder")?.matches).toEqual([
      ["resfinder:blaX", 1, "RBH", true],
      ["resfinder:blaXlow", 0.85, "OWH", false],
    ]);
  });
  it("omits a database with no match at or above the threshold", () => {
    expect(summary("card:ARO:2000", 0.9).map((g) => g.db)).toEqual(["ncbi"]);
    expect(summary("card:ARO:2000", 0.8).map((g) => g.db)).toEqual(["ncbi", "resfinder"]);
  });
  it("returns no groups for an entry without matches", () => {
    expect(summary("resfinder:orphan", 0)).toEqual([]);
  });
});

describe("identity precision", () => {
  const e = (id: string, database: "card" | "ncbi") => ({ id, database, name: id, pmids: [], alternativeIds: [], duplicateAlleleIds: [] });
  const tiny = (identities: number[]) => ({
    entries: { "card:q": e("card:q", "card"), ...Object.fromEntries(identities.map((_, i) => [`ncbi:t${i}`, e(`ncbi:t${i}`, "ncbi")])) },
    edges: { "card:q": identities.map((identity, i) => ({ target: `ncbi:t${i}`, identity, coverage: 1, type: "OWH" as const })) },
  });
  it("flags values that agree at 3 decimals as a tie", () => {
    const m = matchGroups(tiny([0.9701, 0.9704]), "card:q", 0.9)[0].matches;
    expect(m.map((x) => x.best)).toEqual([true, true]);
  });
  it("keeps 0.8996 and a slider value of 0.9000000000000001 at the 0.9 boundary", () => {
    expect(matchGroups(tiny([0.8996]), "card:q", 0.9)).toHaveLength(1);
    expect(matchGroups(tiny([0.9]), "card:q", 0.9000000000000001)).toHaveLength(1);
    expect(matchGroups(tiny([0.8994]), "card:q", 0.9)).toHaveLength(0);
  });
});

describe("buildIndex integrity", () => {
  const node = (id: string) => ({ id, database: "card" as const, name: id });
  const link = (source: string, target: string) => ({ source, target, identity: 1, coverage: 1, type: "RBH" as const });
  it("throws on a duplicate entry id", () => {
    expect(() => buildIndex({ nodes: [node("card:a"), node("card:a")], links: [] })).toThrow("Duplicate entry id: card:a");
  });
  it("throws on an edge to an unknown entry", () => {
    expect(() => buildIndex({ nodes: [node("card:a")], links: [link("card:a", "card:zz")] })).toThrow("unknown entry card:zz");
  });
  it("throws on a duplicate edge", () => {
    const g = { nodes: [node("card:a"), node("card:b")], links: [link("card:a", "card:b"), link("card:a", "card:b")] };
    expect(() => buildIndex(g)).toThrow("Duplicate edge");
  });
});
