import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildIndex } from "./parse";
import { matchGroups } from "./query";
import type { MatchGroup, ReleaseGraph } from "./types";

// Differential test: tests/oracle/matches.py (networkx, no shared code) applies the 2021 rule and the ADR 0004
// rule to every entry and itself FAILS unless best-flagged rows equal the old rule with ties expanded at 0.9 and
// threshold 0 keeps every edge. Its output: fixed `cases` with full results, and a `sweep` hash over every entry
// at 0.9, 0.5 and 0. The output is committed; the last test regenerates it when ORACLE_PYTHON is set.
type Row = [string, number, number, string, boolean]; // target, identity in thousandths, coverage in millionths, type, best
interface Expected {
  graph_sha256: string;
  cases: { entry: string; minIdentity: number; groups: [string, Row[]][] }[];
  sweep: { count: number; sha256: string };
}
const expected = JSON.parse(readFileSync("tests/oracle/matches_expected.json", "utf8")) as Expected;
const provenance = JSON.parse(readFileSync("data/provenance.json", "utf8"));
const graph = JSON.parse(readFileSync("data/graph.json", "utf8")) as ReleaseGraph;
const index = buildIndex(graph);

const rows = (groups: MatchGroup[]) =>
  groups.map((g) => [
    g.database,
    g.matches.map((m) => [m.entry.id, Math.floor(m.identity * 1000 + 0.5), Math.floor(m.coverage * 1e6 + 0.5), m.type, m.best]),
  ]);

describe("match groups on the pinned release agree with the networkx oracle", () => {
  it("was generated from the pinned graph (after a release update, regenerate it)", () => {
    expect(expected.graph_sha256).toBe(provenance.sha256);
  });
  it("covers ties, hidden-by-default matches and a threshold that reveals them", () => {
    const g = (e: string, t: number) => expected.cases.find((c) => c.entry === e && c.minIdentity === t)!.groups;
    expect(g("ncbi:WP_003152694.1", 0.9)[0][1].filter((r) => r[4])).toHaveLength(2); // tie
    expect(g("card:ARO:3000005", 0.9).map((x) => x[0])).toEqual(["ncbi"]);
    expect(g("card:ARO:3000005", 0.5).map((x) => x[0])).toEqual(["ncbi", "resfinder"]);
    const many = g("card:ARO:3000579", 0.9).find((x) => x[0] === "resfinder")![1];
    expect(many.length).toBeGreaterThan(1);
    expect(many.some((r) => !r[4])).toBe(true); // shown but not best
    const boundary = g("card:ARO:3003873", 0.5).find((x) => x[0] === "resfinder")![1];
    expect(boundary.map((r) => r[0])).toEqual(["resfinder:blaADC-25", "resfinder:blaOCH-8"]); // 0.5 included, 0.498 not
  });
  for (const c of expected.cases) {
    it(`${c.entry} at minimum identity ${c.minIdentity}`, () => {
      expect(rows(matchGroups(index, c.entry, c.minIdentity))).toEqual(c.groups);
    });
  }
  it("keeps exactly the edges at or above each whole-percent slider value (0 to 100)", () => {
    // Brute force from the raw links, no oracle and no app rounding: identities have 3 decimals in this release.
    const outEdges = new Map<string, number[]>();
    for (const l of graph.links) outEdges.set(l.source, [...(outEdges.get(l.source) ?? []), Math.round(l.identity * 1000)]);
    const sample = ["card:ARO:3003873", "card:ARO:3000230", "card:ARO:3000579", "ncbi:WP_003152694.1", "card:ARO:3000005"];
    for (const id of sample) {
      for (let p = 0; p <= 100; p++) {
        const shown = matchGroups(index, id, p / 100).reduce((n, g) => n + g.matches.length, 0);
        expect(shown, `${id} at ${p}%`).toBe(outEdges.get(id)!.filter((thousandths) => thousandths >= p * 10).length);
      }
    }
  });
  it("agrees on every entry at 0.9, 0.5 and 0", () => {
    const lines = Object.keys(index.entries)
      .sort()
      .flatMap((id) => [0.9, 0.5, 0].map((t) => JSON.stringify([id, Math.round(t * 100), rows(matchGroups(index, id, t))])));
    expect(lines).toHaveLength(expected.sweep.count);
    expect(createHash("sha256").update(lines.join("\n")).digest("hex")).toBe(expected.sweep.sha256);
  });
  it.skipIf(!process.env.ORACLE_PYTHON)("committed oracle output equals a fresh run of matches.py", () => {
    const fresh = execFileSync(process.env.ORACLE_PYTHON!, ["tests/oracle/matches.py", "data/graph.json"], { encoding: "utf8" });
    expect(JSON.parse(fresh)).toEqual(expected);
  });
});
