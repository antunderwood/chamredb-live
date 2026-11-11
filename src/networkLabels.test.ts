import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LABEL_CLEAR, LINK_LABEL_CHARS, PILL, SAMPLES, cubicAt, layoutNetwork, pillRect, type EdgeSlot, type NetLayout } from "./networkLayout";
import { buildNetwork, visibleEdges } from "./networkModel";
import { buildIndex } from "./parse";
import type { ReleaseGraph } from "./types";

// "Match of a match" labels on the real release: where the label goes, against where it would sit at t = 0.5. The exact
// counts below are a characterisation of the current placement (not an independent oracle: the hand-worked arithmetic is
// in networkLayout.test.ts and docs/network-layout.md, "Label placement"); the invariant tested is that placing never
// makes a label worse than t = 0.5.
const index = buildIndex(JSON.parse(readFileSync("data/graph.json", "utf8")) as ReleaseGraph);

const picture = (query: string, expanded: string[]) => {
  const n = buildNetwork(index, query, 0.9, expanded);
  return layoutNetwork({ nodes: n.nodes, edges: visibleEdges(n).edges });
};
// How many samples of the other edges fall inside the label's pill at parameter t (grown by LABEL_CLEAR).
const touches = (l: NetLayout, e: EdgeSlot, t: number) => {
  const r = pillRect(cubicAt(e.path, t), LINK_LABEL_CHARS, PILL.labelH);
  let c = 0;
  for (const o of l.edges) {
    if (o === e) continue;
    for (let k = 0; k <= SAMPLES; k++) {
      const p = cubicAt(o.path, k / SAMPLES);
      if (p.x >= r.x - LABEL_CLEAR && p.x <= r.x + r.width + LABEL_CLEAR && p.y >= r.y - LABEL_CLEAR && p.y <= r.y + r.height + LABEL_CLEAR) c++;
    }
  }
  return c;
};

describe("label placement on the real release", () => {
  const entries: [string, string[]][] = [
    ["card:ARO:3002546", ["ncbi:WP_003159191.1", "resfinder:ant(3'')-Ii-aac(6')-IId"]], // four links between matches
    ["card:ARO:3000010", ["ncbi:WP_063856521.1", "resfinder:VanHAX"]], // a reciprocal RBH pair
  ];
  for (const [query, expanded] of entries) {
    it(`${query}: no label touches more other-edge samples than it would at t = 0.5`, () => {
      const l = picture(query, expanded);
      const labelled = l.edges.filter((e) => e.kind === "link" || e.kind === "back");
      expect(labelled.length).toBeGreaterThan(0);
      for (const e of labelled) expect(touches(l, e, e.labelT!), `${e.source} to ${e.target}`).toBeLessThanOrEqual(touches(l, e, 0.5));
    });
  }
  it("card:ARO:3002546: the four crowded links touch 16 samples in all, where t = 0.5 would touch 49", () => {
    // Four links bow into the same strip, so some contact is unavoidable (7, 2, 0, 7 samples; at 0.5: 7, 10, 24, 8).
    const l = picture(...entries[0]!);
    const links = l.edges.filter((e) => e.kind === "link");
    expect(links.map((e) => e.labelT)).toEqual([0.5, 0.8, 0.8, 0.8]);
    expect(links.map((e) => touches(l, e, e.labelT!))).toEqual([7, 2, 0, 7]);
    expect(links.map((e) => touches(l, e, 0.5))).toEqual([7, 10, 24, 8]);
  });
});
