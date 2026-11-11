import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { comparisonRows, type ComparisonRow } from "./comparison";
import { buildIndex } from "./parse";
import { matchGroups } from "./query";
import { DATABASES, type Database, type ReleaseGraph } from "./types";

const WEAK = 0.9;

// Plain shape for comparing with hand-worked rows: database, label or "none", the best ids with identity, coverage
// and type, and the count.
type Plain = [Database, "best" | "highest" | "none", [string, number, number, string][], number];
const plain = (rows: ComparisonRow[]): Plain[] =>
  rows.map((r) =>
    r.kind === "none"
      ? [r.database, "none", [], 0]
      : [r.database, r.label, r.top.map((m) => [m.entry.id, m.identity, m.coverage, m.type]), r.count],
  );

describe("comparison rows on the fixture (tests/fixtures/README.md, Comparison strip, worked by hand)", () => {
  const index = buildIndex(JSON.parse(readFileSync("tests/fixtures/graph.json", "utf8")) as ReleaseGraph);
  const rows = (id: string, min: number) => plain(comparisonRows(index.entries[id]!.database, matchGroups(index, id, min), WEAK));

  it("card:ARO:1000 at 90%: tied best in ncbi are both listed, count 3; resfinder best blaX", () => {
    expect(rows("card:ARO:1000", 0.9)).toEqual([
      ["ncbi", "best", [["ncbi:WP_1.1", 0.97, 1.0, "RBH"], ["ncbi:WP_3.1", 0.97, 1.0, "OWH"]], 3],
      ["resfinder", "best", [["resfinder:blaX", 1.0, 1.0, "RBH"]], 1],
    ]);
  });
  it("card:ARO:2000 at 90%: coverage above 1 in ncbi; resfinder has a no-match row", () => {
    expect(rows("card:ARO:2000", 0.9)).toEqual([
      ["ncbi", "best", [["ncbi:WP_4.1", 0.92, 1.05, "RBH"]], 1],
      ["resfinder", "none", [], 0],
    ]);
  });
  it("card:ARO:2000 at 80%: the resfinder group is weak, so its top match is Highest identity shown", () => {
    expect(rows("card:ARO:2000", 0.8)[1]).toEqual(["resfinder", "highest", [["resfinder:tetM", 0.88, 1.0, "OWH"]], 1]);
  });
  it("resfinder:orphan: one no-match row for each other database", () => {
    expect(rows("resfinder:orphan", 0.9)).toEqual([
      ["card", "none", [], 0],
      ["ncbi", "none", [], 0],
    ]);
  });
});

// Real release: expected rows are read off the networkx oracle output (tests/oracle/matches.py, no shared code),
// keeping only its best-flagged rows and counts; a database the oracle returns no group for must be a no-match row.
type OracleRow = [string, number, number, string, boolean];
const oracle = JSON.parse(readFileSync("tests/oracle/matches_expected.json", "utf8")) as {
  cases: { entry: string; minIdentity: number; groups: [string, OracleRow[]][] }[];
};
describe("comparison rows on the pinned release agree with the networkx oracle cases", () => {
  const index = buildIndex(JSON.parse(readFileSync("data/graph.json", "utf8")) as ReleaseGraph);
  for (const c of oracle.cases) {
    it(`${c.entry} at ${c.minIdentity}`, () => {
      const queryDb = c.entry.split(":")[0] as Database;
      const got = comparisonRows(queryDb, matchGroups(index, c.entry, c.minIdentity), WEAK);
      const want = DATABASES.filter((d) => d !== queryDb).map((d) => {
        const g = c.groups.find(([db]) => db === d);
        if (!g) return [d, "none", [], 0];
        const top = g[1].filter((r) => r[4]);
        return [d, top[0][1] < 900 ? "highest" : "best", top.map((r) => [r[0], r[1], r[2], r[3]]), g[1].length];
      });
      const gotPlain = got.map((r) =>
        r.kind === "none"
          ? [r.database, "none", [], 0]
          : [r.database, r.label, r.top.map((m) => [m.entry.id, Math.floor(m.identity * 1000 + 0.5), Math.floor(m.coverage * 1e6 + 0.5), m.type]), r.count],
      );
      expect(gotPlain).toEqual(want);
    });
  }
  it("the cases include a no-match row (card:ARO:3000005 has no resfinder match at 90%)", () => {
    const rows = comparisonRows("card", matchGroups(index, "card:ARO:3000005", 0.9), WEAK);
    expect(rows.find((r) => r.database === "resfinder")?.kind).toBe("none");
  });
});
