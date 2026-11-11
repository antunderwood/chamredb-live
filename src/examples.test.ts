import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { availableExamples, EXAMPLES } from "./Examples";
import { buildIndex } from "./parse";
import type { ReleaseGraph } from "./types";

// Expected ids come from a raw scan of data/graph.json (node id, native id, name, alternative and duplicate allele
// ids compared as plain strings), not from findEntries.
const release = buildIndex(JSON.parse(readFileSync("data/graph.json", "utf8")) as ReleaseGraph, "graph-2026.11.09");
const fixture = buildIndex(JSON.parse(readFileSync("tests/fixtures/graph.json", "utf8")) as ReleaseGraph);

describe("example searches", () => {
  it("all four exist in the shipped release, each finding exactly the expected entries", () => {
    expect(availableExamples(release).map((e) => e.query)).toEqual(EXAMPLES.map((e) => e.query));
    expect(EXAMPLES.map((e) => e.query)).toEqual(["card:ARO:3000230", "ncbi:WP_012695489.1", "resfinder:blaNDM-1", "tet(M)"]);
    expect(EXAMPLES[3].ids).toHaveLength(3); // the ambiguity example
  });
  it("the hand-written test graph has none of them, so none is offered", () => {
    expect(availableExamples(fixture)).toEqual([]);
  });
  it("an example whose search finds other entries than expected is not offered", () => {
    const changed = [{ query: "tet(M)", ids: ["card:ARO:3000186"], note: "" }];
    expect(availableExamples(release, changed)).toEqual([]);
  });
});
