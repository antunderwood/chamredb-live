import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildIndex } from "./parse";
import { findEntries } from "./query";
import type { Database, ReleaseGraph } from "./types";

// Differential test: tests/oracle/lookup.py (networkx, no shared code) answers the same lookups on the real
// graph. `cases` are fixed lookups with full results; `sweep` is every searchable string in the graph, covered
// by one hash. The oracle output is committed; the last test regenerates it when ORACLE_PYTHON points at a
// Python with networkx 3.7 (tests/oracle/README.md), proving the committed file is the script's output.
interface Expected {
  graph_sha256: string;
  cases: { query: string; database: Database | null; results: { id: string; matchedOn: string }[] }[];
  sweep: { count: number; sha256: string };
}
const expected = JSON.parse(readFileSync("tests/oracle/lookup_expected.json", "utf8")) as Expected;
const provenance = JSON.parse(readFileSync("data/provenance.json", "utf8"));
const graph = JSON.parse(readFileSync("data/graph.json", "utf8")) as ReleaseGraph;
const index = buildIndex(graph);

describe("lookup on the pinned release agrees with the networkx oracle", () => {
  it("was generated from the pinned graph (after a release update, regenerate it)", () => {
    expect(expected.graph_sha256).toBe(provenance.sha256);
  });
  it("covers every way of matching, ambiguity across databases, and absent ids", () => {
    const ways = new Set(expected.cases.flatMap((c) => c.results.map((r) => r.matchedOn)));
    expect([...ways].sort()).toEqual(["alternative id", "duplicate allele id", "id", "name"]);
    expect(expected.cases.some((c) => new Set(c.results.map((r) => r.id.split(":")[0])).size > 1)).toBe(true);
    expect(expected.cases.some((c) => c.results.length === 0)).toBe(true);
  });
  for (const c of expected.cases) {
    it(`${JSON.stringify(c.query)}${c.database ? ` in ${c.database}` : ""}`, () => {
      const got = findEntries(index, c.query, c.database ?? undefined).map((x) => ({ id: x.id, matchedOn: x.matchedOn }));
      expect(got).toEqual(c.results);
    });
  }
  it("agrees on every searchable string in the graph", () => {
    // Texts are enumerated here from the raw release JSON, not from the index.
    const texts = new Set<string>();
    for (const n of graph.nodes) {
      texts.add(n.id);
      texts.add(n.id.slice(n.id.indexOf(":") + 1)); // native id: everything after the first colon
      texts.add(n.name);
      for (const a of Object.values(n.alternative_id ?? {})) texts.add(a);
      for (const list of Object.values(n.duplicate_allele_ids ?? {})) for (const a of list) texts.add(a);
    }
    const lines = [...texts].sort().map((t) =>
      JSON.stringify([t, findEntries(index, t).map((c) => [c.id, c.matchedOn])]),
    );
    expect(lines).toHaveLength(expected.sweep.count);
    expect(createHash("sha256").update(lines.join("\n")).digest("hex")).toBe(expected.sweep.sha256);
  });
  it.skipIf(!process.env.ORACLE_PYTHON)("committed oracle output equals a fresh run of lookup.py", () => {
    const fresh = execFileSync(process.env.ORACLE_PYTHON!, ["tests/oracle/lookup.py", "data/graph.json"], {
      encoding: "utf8",
    });
    expect(JSON.parse(fresh)).toEqual(expected);
  });
});
