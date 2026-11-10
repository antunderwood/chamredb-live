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
  it("keeps alternative and duplicate allele ids with their kind", () => {
    const e = index.entries["ncbi:WP_1.1"];
    expect(e.alternativeIds).toEqual({ nucleotide_accession: "NG_1.1" });
    expect(e.duplicateAlleleIds).toEqual({ nucleotide_accessions: ["NG_2.1"], protein_accessions: ["WP_2.1"] });
  });
});

describe("findEntries", () => {
  const found = (text: string, db?: "card" | "ncbi" | "resfinder") =>
    findEntries(index, text, db).map((c) => [c.id, c.matchedOn]);
  it("finds one entry by composite or native id", () => {
    expect(found("card:ARO:1000")).toEqual([["card:ARO:1000", "id"]]);
    expect(found("ARO:2000")).toEqual([["card:ARO:2000", "id"]]);
  });
  it("lists every entry when a native id is shared by two databases", () => {
    expect(found("ARO:1000")).toEqual([["card:ARO:1000", "id"], ["resfinder:ARO:1000", "id"]]);
  });
  it("finds by name, listing all databases that share it, id taking priority over name", () => {
    expect(found("blaX")).toEqual([["card:ARO:1000", "name"], ["resfinder:blaX", "id"]]);
    expect(found("tet(M)")).toEqual([["card:ARO:2000", "name"]]);
  });
  it("finds by alternative id and by duplicate allele id", () => {
    expect(found("NG_1.1")).toEqual([["ncbi:WP_1.1", "alternative id"]]);
    expect(found("WP_2.1")).toEqual([["ncbi:WP_1.1", "duplicate allele id"]]);
    expect(found("NG_2.1")).toEqual([["ncbi:WP_1.1", "duplicate allele id"]]);
  });
  it("restricts to a database when asked", () => {
    expect(found("blaX", "card")).toEqual([["card:ARO:1000", "name"]]);
    expect(found("blaX", "ncbi")).toEqual([]);
  });
  it("trims the text and is case-sensitive", () => {
    expect(found("  ARO:2000 ")).toEqual([["card:ARO:2000", "id"]]);
    expect(found("blax")).toEqual([]);
  });
  it("lists every entry when a duplicate allele id equals another entry's native id", () => {
    const e = (id: string, database: "card" | "ncbi", dup: Record<string, string[]> = {}) => ({
      id, database, name: id, pmids: [], alternativeIds: {}, duplicateAlleleIds: dup,
    });
    const clash = { entries: { "card:X1": e("card:X1", "card"), "ncbi:A": e("ncbi:A", "ncbi", { protein_accessions: ["X1"] }) }, edges: {} };
    expect(findEntries(clash, "X1").map((c) => [c.id, c.matchedOn])).toEqual([["card:X1", "id"], ["ncbi:A", "duplicate allele id"]]);
  });
  it("does not resolve a prefixed accession: only entry ids take a database prefix", () => {
    expect(found("ncbi:NG_1.1")).toEqual([]);
  });
  it("returns nothing for an unknown id", () => {
    expect(found("ARO:9999")).toEqual([]);
    expect(found("")).toEqual([]);
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
  const e = (id: string, database: "card" | "ncbi") => ({ id, database, name: id, pmids: [], alternativeIds: {}, duplicateAlleleIds: {} });
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
