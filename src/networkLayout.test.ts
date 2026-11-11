import { describe, expect, it } from "vitest";
import { HIT, hitRegions, layoutNetwork, pixel } from "./networkLayout";
import { MAX_NODES, type NetEdge, type NetNode, type Network } from "./networkModel";

// Expected pixels worked by hand (docs/network-layout.md). Constants: ROW 56, PAD 16, MARGIN_X 96 (the first column
// centre and the margin right of the last), COL_GAP 192, CLEARANCE 20, LABEL_RISE 24, HIT 48, BOW 42.
// Column x: column 0 = 96, column 1 = 96 + 192 = 288, column 2 = 96 + 2*192 = 480.
// Row y of a node: 16 + 56 * ((rows - count) / 2 + row) + 56 / 2, where rows is the tallest column and count the
// nodes in this column.
//
// Fixture A: query, 3 matches (column 1), 3 step-2 nodes (column 2); rows = 3.
//   Height = 2*16 + 56*3 = 200. Width = 480 + 96 = 576.
//   Query: count 1, offset (3-1)/2 = 1, y = 16 + 56*1 + 28 = 100, so (96, 100).
//   Matches: count 3, offset 0: y = 44, 100, 156 at x 288. FIRST (288, 44); LAST (288, 156).
//   Step-2 column: same rows at x 480: first (480, 44), middle (480, 100), last (480, 156).
//   Label of the last match: 24 above its centre, so (288, 132), anchor middle.
//   Hit region of the last match: 48 x 48 centred: x = 288 - 24 = 264, y = 156 - 24 = 132. Tooltip anchor: the
//   middle of its bottom edge, 24 below the centre: (288, 180).
//   Edge query to last match: vector (192, 56), length sqrt(36864 + 3136) = sqrt(40000) = 200 (a 7-24-25 triangle
//   scaled by 8), unit (0.96, 0.28), clearance 20 gives (19.2, 5.6): from (96 + 19.2, 100 + 5.6) = (115.2, 105.6)
//   to (288 - 19.2, 156 - 5.6) = (268.8, 150.4).
//   Step-2 edge from the last match (288, 156) to the middle step-2 node (480, 100): vector (192, -56), the same
//   triangle: from (288 + 19.2, 156 - 5.6) = (307.2, 150.4) to (480 - 19.2, 100 + 5.6) = (460.8, 105.6).
//   Same-column edge from the first match (288, 44) to the last (288, 156) bows out BOW = 42 to the right: control
//   = (288 + 42, (44+156)/2) = (330, 100). Each end is cut CLEARANCE along the line to the control point: from the
//   first, vector (42, 56), length 70 (a 3-4-5 triangle scaled by 14), unit (0.6, 0.8), so from (288 + 12, 44 + 16)
//   = (300, 60); from the last, vector (42, -56), unit (0.6, -0.8), so to (300, 140).
// Fixture B (centring): 2 matches and 3 step-2 nodes; rows = 3. Matches: count 2, offset 0.5: y = 16 + 56*0.5 + 28 +
//   56*row = 72, 128. The query is on the middle row of the tallest column: y = 100.
// Fixture C: query only: width 2 * 96 = 192, height 2*16 + 56*1 = 88, query (96, 44). Matches but no step 2: width
//   96 + 192 + 96 = 384.
const node = (id: string, role: NetNode["role"], via?: string): NetNode => ({ id, database: "card", name: id, role, via, best: false, weak: false });
const edge = (source: string, target: string, step: 1 | 2): NetEdge => ({ source, target, identity: 1, coverage: 1, type: "RBH", step });
const A: Network = {
  nodes: [node("q", "query"), node("m0", "match"), node("m1", "match"), node("m2", "match"), node("s0", "step2", "m2"), node("s1", "step2", "m2"), node("s2", "step2", "m2")],
  edges: [edge("q", "m0", 1), edge("q", "m1", 1), edge("q", "m2", 1), edge("m2", "s0", 2), edge("m2", "s1", 2), edge("m2", "s2", 2), edge("m0", "m2", 2)],
};
const near = (p: { x: number; y: number }, x: number, y: number) => {
  expect(p.x).toBeCloseTo(x, 9);
  expect(p.y).toBeCloseTo(y, 9);
};

describe("pixel: the only slot-to-pixel mapping, hand-worked", () => {
  it("column x is 96, 288, 480", () => {
    expect(pixel(0, 0, 1, 1).x).toBe(96);
    expect(pixel(1, 0, 1, 1).x).toBe(288);
    expect(pixel(2, 0, 1, 1).x).toBe(480);
  });
  it("row y: first, last and a centred shorter column", () => {
    expect(pixel(1, 0, 3, 3)).toEqual({ x: 288, y: 44 }); // 16 + 0 + 28
    expect(pixel(1, 2, 3, 3)).toEqual({ x: 288, y: 156 }); // 16 + 112 + 28
    expect(pixel(1, 0, 2, 3)).toEqual({ x: 288, y: 72 }); // 16 + 56*0.5 + 28
    expect(pixel(1, 1, 2, 3)).toEqual({ x: 288, y: 128 }); // 16 + 56*1.5 + 28
    expect(pixel(0, 0, 1, 3)).toEqual({ x: 96, y: 100 }); // 16 + 56*1 + 28
  });
});

describe("layoutNetwork: hand-worked pixels", () => {
  const l = layoutNetwork(A);
  const at = (id: string) => l.nodes.find((n) => n.id === id)!;
  const line = (s: string, t: string) => l.edges.find((e) => e.source === s && e.target === t)!;
  it("viewBox size is computed from the content", () => {
    expect([l.width, l.height]).toEqual([576, 200]);
    expect(layoutNetwork({ nodes: [node("q", "query")], edges: [] })).toMatchObject({ width: 192, height: 88 });
    expect(layoutNetwork({ nodes: [node("q", "query"), node("m", "match")], edges: [edge("q", "m", 1)] })).toMatchObject({ width: 384, height: 88 });
  });
  it("node centres: query, first and last match, step-2 column", () => {
    expect(at("q").centre).toEqual({ x: 96, y: 100 });
    expect(at("m0").centre).toEqual({ x: 288, y: 44 });
    expect(at("m2").centre).toEqual({ x: 288, y: 156 });
    expect(at("s0").centre).toEqual({ x: 480, y: 44 });
    expect(at("s1").centre).toEqual({ x: 480, y: 100 });
    expect(at("s2").centre).toEqual({ x: 480, y: 156 });
  });
  it("label, tooltip anchor and hit region of the last match", () => {
    const m = at("m2");
    expect(m.label).toEqual({ x: 288, y: 132 });
    expect(m.tooltip).toEqual({ x: 288, y: 180 });
    expect(m.hit).toEqual({ x: 264, y: 132, width: 48, height: 48 });
  });
  it("edge from the query to the last match, cut 20 from each centre", () => {
    const e = line("q", "m2");
    near(e.from, 115.2, 105.6);
    near(e.to, 268.8, 150.4);
    expect(e.control).toBeUndefined();
  });
  it("step-2 edge from the last match to the middle step-2 node", () => {
    const e = line("m2", "s1");
    near(e.from, 307.2, 150.4);
    near(e.to, 460.8, 105.6);
    expect(e.step).toBe(2);
  });
  it("a same-column edge bows to the right: control (330, 100), ends cut along the line to it", () => {
    const e = line("m0", "m2");
    expect(e.control).toEqual({ x: 330, y: 100 });
    near(e.from, 300, 60);
    near(e.to, 300, 140);
  });
  it("an edge back to the query runs right to left", () => {
    const l2 = layoutNetwork({ nodes: A.nodes.slice(0, 4), edges: [edge("m2", "q", 2)] });
    const e = l2.edges[0]!;
    near(e.from, 288 - 19.2, 156 - 5.6);
    near(e.to, 96 + 19.2, 100 + 5.6);
  });
  it("two columns are centred on each other: 2 matches and 3 step-2 nodes", () => {
    const B: Network = { nodes: [node("q", "query"), node("m0", "match"), node("m1", "match"), node("s0", "step2", "m0"), node("s1", "step2", "m0"), node("s2", "step2", "m1")], edges: [] };
    const lb = layoutNetwork(B);
    expect(lb.height).toBe(200);
    expect(lb.nodes.map((n) => n.centre.y)).toEqual([100, 72, 128, 44, 100, 156]);
  });
});

describe("hit regions", () => {
  it("every node has a target of at least 44 by 44 viewBox units centred on the node, from the same pixel()", () => {
    expect(HIT).toBeGreaterThanOrEqual(44);
    const l = layoutNetwork(A);
    const regions = hitRegions(l);
    expect(regions.map((r) => r.id)).toEqual(A.nodes.map((n) => n.id));
    for (const r of regions) {
      const c = l.nodes.find((n) => n.id === r.id)!.centre;
      expect(r.width).toBeGreaterThanOrEqual(44);
      expect(r.height).toBeGreaterThanOrEqual(44);
      expect(r.x + r.width / 2).toBe(c.x);
      expect(r.y + r.height / 2).toBe(c.y);
    }
  });
  it("targets never overlap, at the cap: 1 query, 6 matches, 18 step-2 nodes", () => {
    const nodes = [node("q", "query"), ...Array.from({ length: 6 }, (_, i) => node(`m${i}`, "match")), ...Array.from({ length: MAX_NODES - 7 }, (_, i) => node(`s${i}`, "step2", "m0"))];
    const l = layoutNetwork({ nodes, edges: [] });
    expect(l.height).toBe(2 * 16 + 56 * 18);
    const rs = hitRegions(l);
    for (const a of rs) {
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.y).toBeGreaterThanOrEqual(0);
      expect(a.x + a.width).toBeLessThanOrEqual(l.width);
      expect(a.y + a.height).toBeLessThanOrEqual(l.height);
      for (const b of rs) {
        if (a === b) continue;
        const apart = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
        expect(apart, `${a.id} and ${b.id}`).toBe(true);
      }
    }
  });
});

describe("layoutNetwork works for 0 to 25 nodes", () => {
  it("handles every size, with finite coordinates and a drawable box", () => {
    expect(layoutNetwork({ nodes: [], edges: [] })).toMatchObject({ width: 192, height: 88, nodes: [], edges: [] });
    for (let n = 1; n <= MAX_NODES; n++) {
      const matches = Math.min(6, n - 1);
      const nodes = [node("q", "query"), ...Array.from({ length: matches }, (_, i) => node(`m${i}`, "match")), ...Array.from({ length: n - 1 - matches }, (_, i) => node(`s${i}`, "step2", "m0"))];
      const l = layoutNetwork({ nodes, edges: nodes.slice(1, 1 + matches).map((m) => edge("q", m.id, 1)) });
      expect(l.nodes).toHaveLength(n);
      for (const s of l.nodes) {
        expect(Number.isFinite(s.centre.x + s.centre.y)).toBe(true);
        expect(s.centre.y).toBeGreaterThan(0);
        expect(s.centre.y).toBeLessThan(l.height);
      }
    }
  });
});
