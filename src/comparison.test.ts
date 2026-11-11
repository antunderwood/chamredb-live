import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isWeakGroup, matchDetails } from "./cardModel";
import { comparisonRows, type ComparisonRow } from "./comparison";
import { buildIndex } from "./parse";
import { matchGroups } from "./query";
import { DATABASES, type Database, type Index, type ReleaseGraph } from "./types";

const WEAK = 0.9;
const rowsFor = (index: Index, id: string, min: number) =>
  comparisonRows(index.entries[id]!.database, matchGroups(index, id, min), matchGroups(index, id, 0), WEAK);

// Plain shape for comparing with hand-worked rows: database, label or "none", the best ids with identity, coverage
// and type, and the count (for a none row: the number of matches the minimum identity hides).
type Plain = [Database, "best" | "highest" | "none", [string, number, number, string][], number];
const plain = (rows: ComparisonRow[]): Plain[] =>
  rows.map((r) =>
    r.kind === "none"
      ? [r.database, "none", [], r.below]
      : [r.database, r.label, r.top.map((m) => [m.entry.id, m.identity, m.coverage, m.type]), r.count],
  );

describe("comparison rows on the fixture (tests/fixtures/README.md, Comparison strip, worked by hand)", () => {
  const index = buildIndex(JSON.parse(readFileSync("tests/fixtures/graph.json", "utf8")) as ReleaseGraph);
  const rows = (id: string, min: number) => plain(rowsFor(index, id, min));

  it("card:ARO:1000 at 90%: tied best in ncbi are both listed, count 3 (WP_4.1 at exactly 0.900 counted, not best)", () => {
    expect(rows("card:ARO:1000", 0.9)).toEqual([
      ["ncbi", "best", [["ncbi:WP_1.1", 0.97, 1.0, "RBH"], ["ncbi:WP_3.1", 0.97, 1.0, "OWH"]], 3],
      ["resfinder", "best", [["resfinder:blaX", 1.0, 1.0, "RBH"]], 1],
    ]);
  });
  it("card:ARO:1000 at 80%: resfinder is Best blaX with blaXlow (0.85) counted beside it", () => {
    expect(rows("card:ARO:1000", 0.8)[1]).toEqual(["resfinder", "best", [["resfinder:blaX", 1.0, 1.0, "RBH"]], 2]);
  });
  it("card:ARO:2000 at 90%: coverage above 1 in ncbi; resfinder is a no-match row hiding 1 match (tetM 0.88)", () => {
    expect(rows("card:ARO:2000", 0.9)).toEqual([
      ["ncbi", "best", [["ncbi:WP_4.1", 0.92, 1.05, "RBH"]], 1],
      ["resfinder", "none", [], 1],
    ]);
  });
  it("card:ARO:2000 at 80%: the resfinder group is weak, so its top match is Highest identity shown", () => {
    expect(rows("card:ARO:2000", 0.8)[1]).toEqual(["resfinder", "highest", [["resfinder:tetM", 0.88, 1.0, "OWH"]], 1]);
  });
  it("resfinder:orphan: one no-match row for each other database, hiding nothing (no match at any identity)", () => {
    expect(rows("resfinder:orphan", 0.9)).toEqual([
      ["card", "none", [], 0],
      ["ncbi", "none", [], 0],
    ]);
  });

  // Invariant 1: the strip equals the cards. The cards' view here is built from the card formatter (matchDetails: badge,
  // printed identity, coverage and type) and the group length, not from comparisonRows.
  for (const id of ["card:ARO:1000", "card:ARO:2000", "resfinder:orphan", "ncbi:WP_4.1"]) {
    for (const min of [0, 0.8, 0.9]) {
      it(`${id} at ${min}: rows equal the cards' badges, printed values and counts`, () => {
        const groups = matchGroups(index, id, min);
        const cards = DATABASES.filter((d) => d !== index.entries[id]!.database).map((d) => {
          const g = groups.find((x) => x.database === d);
          if (!g) return [d, "none"];
          const weak = isWeakGroup(g, WEAK);
          const flagged = g.matches.map((m) => matchDetails(m, weak)).filter((x) => x.badge !== null);
          return [d, flagged[0].badge, flagged.map((x) => [x.identity, x.coverage, x.typeLabel]), g.matches.length];
        });
        const strip = rowsFor(index, id, min).map((r) => {
          if (r.kind === "none") return [r.database, "none"];
          const weak = r.label === "highest";
          return [r.database, r.label, r.top.map((m) => matchDetails(m, weak)).map((x) => [x.identity, x.coverage, x.typeLabel]), r.count];
        });
        expect(strip).toEqual(cards);
      });
    }
  }
});

// Real release: expected rows are read off the networkx oracle output (tests/oracle/matches.py, no shared code),
// keeping only its best-flagged rows and counts; a database the oracle returns no group for must be a no-match row,
// whose hidden count is checked against a brute-force count over the raw links.
type OracleRow = [string, number, number, string, boolean];
const oracle = JSON.parse(readFileSync("tests/oracle/matches_expected.json", "utf8")) as {
  cases: { entry: string; minIdentity: number; groups: [string, OracleRow[]][] }[];
};
describe("comparison rows on the pinned release agree with the networkx oracle cases", () => {
  const graph = JSON.parse(readFileSync("data/graph.json", "utf8")) as ReleaseGraph;
  const index = buildIndex(graph);
  const dbOf = new Map(graph.nodes.map((n) => [n.id, n.database]));
  const weakT = Math.round(WEAK * 1000);
  for (const c of oracle.cases) {
    it(`${c.entry} at ${c.minIdentity}`, () => {
      const queryDb = c.entry.split(":")[0] as Database;
      const want = DATABASES.filter((d) => d !== queryDb).map((d) => {
        const g = c.groups.find(([db]) => db === d);
        if (!g) {
          const below = graph.links.filter((l) => l.source === c.entry && dbOf.get(l.target) === d).length;
          return [d, "none", [], below];
        }
        const top = g[1].filter((r) => r[4]);
        return [d, top[0][1] < weakT ? "highest" : "best", top.map((r) => [r[0], r[1], r[2], r[3]]), g[1].length];
      });
      const got = rowsFor(index, c.entry, c.minIdentity).map((r) =>
        r.kind === "none"
          ? [r.database, "none", [], r.below]
          : [r.database, r.label, r.top.map((m) => [m.entry.id, Math.floor(m.identity * 1000 + 0.5), Math.floor(m.coverage * 1e6 + 0.5), m.type]), r.count],
      );
      expect(got).toEqual(want);
    });
  }
  it("the cases cover a no-match row hiding a match, coverage above 1, Best beside matches below 90%, and a top at exactly 0.900", () => {
    const res = rowsFor(index, "card:ARO:3000005", 0.9).find((r) => r.database === "resfinder")!;
    expect(res.kind === "none" && res.below).toBe(1); // VanHDX at 0.79 hidden by the default minimum
    const cov = rowsFor(index, "card:ARO:3002650", 0.9).find((r) => r.database === "ncbi")!;
    expect(cov.kind === "match" && cov.top[0].coverage).toBeGreaterThan(1);
    const mixed = rowsFor(index, "card:ARO:3000172", 0.5).find((r) => r.database === "ncbi")!;
    expect(mixed.kind === "match" && [mixed.label, mixed.count]).toEqual(["best", 3]);
    const exact = rowsFor(index, "card:ARO:3002972", 0.9).find((r) => r.database === "ncbi")!;
    expect(exact.kind === "match" && [exact.label, exact.top[0].identity]).toEqual(["best", 0.9]);
  });
});
