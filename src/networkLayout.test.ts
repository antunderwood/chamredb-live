import { describe, expect, it } from "vitest";
import { DB_SHAPE, chipPath, ellipsize, expandRegions, hitRegions, layoutNetwork, pillRect, pixel, placeLabel, ribbonRect, type Cubic } from "./networkLayout";
import { MAX_NODES, type NetEdge, type NetNode, type Network } from "./networkModel";

// Expected pixels worked by hand (docs/network-layout.md). Constants: ROW 64, PAD 16, HEADER 32, SIDE 16, QUERY 224 by
// 72, CHIP 248 by 52, MARGIN_X 128 (= SIDE + QUERY_W / 2), COL_GAP 376, BADGE_W 64, TEXT_PAD 10, LINE 20, 34, 47 (the
// query chip: 28, 45, 61), RIBBON 14 high, 7 above the chip, inset 12, 48 wide (best) or 136 (weak), EXPAND_HIT 44,
// EXPAND_R 20, FAN 8, LINK_INSET 16, QUERY_LINK 30, BOW 84, LABEL_T 0.7, LINK_T 0.5, PILL pad 12 and 6 per character.
// Column x: 128, 128 + 376 = 504, 128 + 752 = 880.
// Row y of a node: 32 + 16 + 64 * ((rows - count) / 2 + row) + 64 / 2, where rows is the tallest column.
//
// Fixture A: query, 3 matches, 3 step-2 nodes; rows = 3.
//   Height = 32 + 2*16 + 64*3 = 256. Width = 880 + 124 + 16 = 1020 (half a chip, then SIDE).
//   Query: count 1, offset (3-1)/2 = 1, y = 48 + 64 + 32 = 144, so (128, 144); rect x = 128 - 112 = 16, y = 144 - 36 = 108, 224 by 72.
//   Matches: offset 0, y = 48 + 32 = 80, 144, 208 at x 504. FIRST (504, 80); LAST (504, 208).
//   Last match: rect x = 504 - 124 = 380, y = 208 - 26 = 182, 248 by 52. Badge (380, 182, 64, 52), badge text (412, 208).
//   Text x = 380 + 64 + 10 = 454; baselines 182 + 20 = 202, 182 + 34 = 216, 182 + 47 = 229. Tooltip anchor (504, 182 + 52 = 234).
//   Query text x = 16 + 64 + 10 = 90, baselines 108 + 28 = 136, 108 + 45 = 153, 108 + 61 = 169.
//   Right edge of a match chip: 380 + 248 = 628.
//   Ribbon, best: x = 628 - 12 - 48 = 568, y = 182 - 7 = 175, 48 by 14. Weak: x = 628 - 12 - 136 = 480.
//   Expand pill: centre on the right edge (628, 208); hit 44 by 44: (606, 186).
//   Step-1 edges: 3 leave the query chip (right edge x = 128 + 112 = 240) at y = 144 + (k - 1) * 8 = 136, 144, 152
//   (the pitch is min(8, (72 - 16) / 2 = 28) = 8) and enter the match chip at its left edge (380) at its centre y.
//   Query to last match: from (240, 152) to (380, 208); dx = (380 - 240) / 2 = 70; controls (310, 152) and (310, 208).
//   Identity pill at t = 0.7 (u = 0.3: weights 0.027, 0.189, 0.441, 0.343):
//     x = 0.027*240 + 0.189*310 + 0.441*310 + 0.343*380 = 6.48 + 58.59 + 136.71 + 130.34 = 332.12
//     y = 0.216*152 + 0.784*208 = 32.832 + 163.072 = 195.904 (both controls share the end y values).
//   Query to first match: from (240, 136) to (380, 80); pill y = 0.216*136 + 0.784*80 = 29.376 + 62.72 = 92.096.
//   Step-2 edge from the last match to the middle step-2 node (880, 144): from (628 + 20, 208) = (648, 208) to
//   (880 - 124, 144) = (756, 144); no label.
//   Link between the first and last match (same column): leaves the right edge (628) 16 toward the other at (628, 96)
//   and enters at (628, 208 - 16 = 192); controls (628 + 84, 96) = (712, 96) and (712, 192). Label at t = 0.5 (weights
//   0.125, 0.375, 0.375, 0.125): x = 0.25*628 + 0.75*712 = 157 + 534 = 691, y = (96 + 192) / 2 = 144.
//   Link back to the query from the last match: from its left edge (380, 208 + 16 = 224) to the query's right edge at
//   30 below its centre (240, 174); dx = (240 - 380) / 2 = -70; controls (310, 224) and (310, 174); label
//   x = 0.125*380 + 0.75*310 + 0.125*240 = 47.5 + 232.5 + 30 = 310, y = (224 + 174) / 2 = 199.
// Fixture B (centring): 2 matches and 3 step-2 nodes; rows = 3. Matches: count 2, offset 0.5: y = 48 + 32 + 32 = 112, 176.
// Fixture C: query only: width 128 + 112 + 16 = 256, height 32 + 32 + 64 = 128, query (128, 80). Matches, no step 2:
//   width 504 + 124 + 16 = 644.
const node = (id: string, role: NetNode["role"], via?: string): NetNode => ({ id, database: "card", name: id, role, via, best: false, weak: false });
const edge = (source: string, target: string, step: 1 | 2): NetEdge => ({ source, target, identity: 1, coverage: 1, type: "RBH", step });
const A: Network = {
  nodes: [node("q", "query"), node("m0", "match"), node("m1", "match"), node("m2", "match"), node("s0", "step2", "m2"), node("s1", "step2", "m2"), node("s2", "step2", "m2")],
  edges: [edge("q", "m0", 1), edge("q", "m1", 1), edge("q", "m2", 1), edge("m2", "s0", 2), edge("m2", "s1", 2), edge("m2", "s2", 2), edge("m0", "m2", 2), edge("m2", "q", 2)],
};
const near = (p: { x: number; y: number }, x: number, y: number) => {
  expect(p.x).toBeCloseTo(x, 9);
  expect(p.y).toBeCloseTo(y, 9);
};

describe("pixel: the only slot-to-pixel mapping, hand-worked", () => {
  it("column x is 128, 504, 880", () => {
    expect(pixel(0, 0, 1, 1).x).toBe(128);
    expect(pixel(1, 0, 1, 1).x).toBe(504);
    expect(pixel(2, 0, 1, 1).x).toBe(880);
  });
  it("row y: first, last and a centred shorter column", () => {
    expect(pixel(1, 0, 3, 3)).toEqual({ x: 504, y: 80 }); // 48 + 0 + 32
    expect(pixel(1, 2, 3, 3)).toEqual({ x: 504, y: 208 }); // 48 + 128 + 32
    expect(pixel(1, 0, 2, 3)).toEqual({ x: 504, y: 112 }); // 48 + 64*0.5 + 32
    expect(pixel(1, 1, 2, 3)).toEqual({ x: 504, y: 176 }); // 48 + 64*1.5 + 32
    expect(pixel(0, 0, 1, 3)).toEqual({ x: 128, y: 144 }); // 48 + 64*1 + 32
  });
});

describe("layoutNetwork: hand-worked pixels", () => {
  const l = layoutNetwork(A);
  const at = (id: string) => l.nodes.find((n) => n.id === id)!;
  const line = (s: string, t: string) => l.edges.find((e) => e.source === s && e.target === t)!;
  it("viewBox size is computed from the content", () => {
    expect([l.width, l.height]).toEqual([1020, 256]);
    expect(layoutNetwork({ nodes: [node("q", "query")], edges: [] })).toMatchObject({ width: 256, height: 128 });
    expect(layoutNetwork({ nodes: [node("q", "query"), node("m", "match")], edges: [edge("q", "m", 1)] })).toMatchObject({ width: 644, height: 128 });
    expect(layoutNetwork({ nodes: [], edges: [] })).toMatchObject({ width: 256, height: 128, nodes: [], edges: [] });
  });
  it("column headings: one per used column, centred on the column", () => {
    expect(l.heads).toEqual([{ column: 0, x: 128, y: 20 }, { column: 1, x: 504, y: 20 }, { column: 2, x: 880, y: 20 }]);
    expect(layoutNetwork({ nodes: [node("q", "query"), node("m", "match")], edges: [] }).heads.map((h) => h.column)).toEqual([0, 1]);
    expect(layoutNetwork({ nodes: [node("q", "query")], edges: [] }).heads.map((h) => h.column)).toEqual([0]);
  });
  it("node centres: query, first and last match, step-2 column", () => {
    expect(at("q").centre).toEqual({ x: 128, y: 144 });
    expect(at("m0").centre).toEqual({ x: 504, y: 80 });
    expect(at("m2").centre).toEqual({ x: 504, y: 208 });
    expect(at("s0").centre).toEqual({ x: 880, y: 80 });
    expect(at("s1").centre).toEqual({ x: 880, y: 144 });
    expect(at("s2").centre).toEqual({ x: 880, y: 208 });
  });
  it("chip rectangles: the query is larger", () => {
    expect(at("q").rect).toEqual({ x: 16, y: 108, width: 224, height: 72 });
    expect(at("m2").rect).toEqual({ x: 380, y: 182, width: 248, height: 52 });
    expect(at("m2").hit).toEqual(at("m2").rect);
  });
  it("badge, text baselines and tooltip anchor of the last match", () => {
    const m = at("m2");
    expect(m.badge).toEqual({ x: 380, y: 182, width: 64, height: 52 });
    expect(m.badgeText).toEqual({ x: 412, y: 208 });
    expect(m.lines).toEqual([{ x: 454, y: 202 }, { x: 454, y: 216 }, { x: 454, y: 229 }]);
    expect(m.tooltip).toEqual({ x: 504, y: 234 });
    expect(at("q").lines).toEqual([{ x: 90, y: 136 }, { x: 90, y: 153 }, { x: 90, y: 169 }]);
  });
  it("Best, weak and below ribbons overhang the top edge at the right", () => {
    expect(ribbonRect(at("m2"), "best")).toEqual({ x: 568, y: 175, width: 48, height: 14 });
    expect(ribbonRect(at("m2"), "weak")).toEqual({ x: 480, y: 175, width: 136, height: 14 });
    expect(ribbonRect(at("m2"), "below")).toEqual({ x: 536, y: 175, width: 80, height: 14 }); // 628 - 12 - 80
  });
  it("only step-1 nodes have an expand pill, centred on the chip's right edge", () => {
    expect(at("m2").expand).toEqual({ centre: { x: 628, y: 208 }, hit: { x: 606, y: 186, width: 44, height: 44 } });
    expect(at("q").expand).toBeUndefined();
    expect(at("s0").expand).toBeUndefined();
  });
  it("step-1 edges fan out of the query chip and enter the match chip's left edge", () => {
    expect(line("q", "m0").path.from).toEqual({ x: 240, y: 136 });
    expect(line("q", "m1").path.from).toEqual({ x: 240, y: 144 });
    const e = line("q", "m2");
    expect(e.kind).toBe("query");
    expect(e.path.from).toEqual({ x: 240, y: 152 });
    expect(e.path.to).toEqual({ x: 380, y: 208 });
    expect(e.path.c1).toEqual({ x: 310, y: 152 });
    expect(e.path.c2).toEqual({ x: 310, y: 208 });
  });
  it("identity pills sit at t = 0.7 of the curve", () => {
    near(line("q", "m2").label!, 332.12, 195.904);
    near(line("q", "m0").label!, 332.12, 92.096);
  });
  it("step-2 edge from the last match to the middle step-2 node starts clear of the pill and has no label", () => {
    const e = line("m2", "s1");
    expect(e.kind).toBe("expand");
    expect(e.step).toBe(2);
    expect(e.path.from).toEqual({ x: 648, y: 208 });
    expect(e.path.to).toEqual({ x: 756, y: 144 });
    expect(e.label).toBeUndefined();
  });
  it("a link between two matches bows to the right of the column", () => {
    const e = line("m0", "m2");
    expect(e.kind).toBe("link");
    expect(e.path).toEqual({ from: { x: 628, y: 96 }, c1: { x: 712, y: 96 }, c2: { x: 712, y: 192 }, to: { x: 628, y: 192 } });
    // Not (691, 144): the step-2 edges from the last match pass through that spot (worked below), so the label
    // slides to t = 0.4, the cheapest of the places tried (4 samples of other edges touch it; none is clear).
    expect(e.labelT).toBe(0.4);
    near(e.label!, 688.48, 129.792);
  });
  it("a link back to the query runs right to left and enters below the fan", () => {
    const e = line("m2", "q");
    expect(e.kind).toBe("back");
    expect(e.path).toEqual({ from: { x: 380, y: 224 }, c1: { x: 310, y: 224 }, c2: { x: 310, y: 174 }, to: { x: 240, y: 174 } });
    expect(e.labelT).toBe(0.2); // t = 0.5 at (310, 199) is on the fan of query edges; t = 0.2 touches least (2 samples)
    near(e.label!, 345.28, 218.8); // 0.512 * 380 + 0.384 * 310 + 0.096 * 310 + 0.008 * 240; y = 0.896 * 224 + 0.104 * 174
  });
  it("a link label stays at t = 0.5 when nothing crosses it, and leaves a crossing edge when something does", () => {
    // Fixture D: query, matches m0 m1 m2 (y 80, 144, 208), step-2 nodes s0 s1 s2; one expand edge m1 to s1, which is
    // horizontal at y = 144 from x = 648 to 756, and the link m0 to m2 (label at t = 0.5 would be (691, 144)).
    const nodes = [node("q", "query"), node("m0", "match"), node("m1", "match"), node("m2", "match"), node("s0", "step2", "m1"), node("s1", "step2", "m1"), node("s2", "step2", "m1")];
    const base = [edge("q", "m0", 1), edge("q", "m1", 1), edge("q", "m2", 1)];
    const free = layoutNetwork({ nodes, edges: [...base, edge("m0", "m2", 2)] }).edges.find((e) => e.kind === "link")!;
    expect(free.labelT).toBe(0.5);
    near(free.label!, 691, 144);
    const moved = layoutNetwork({ nodes, edges: [...base, edge("m1", "s1", 2), edge("m0", "m2", 2)] }).edges.find((e) => e.kind === "link")!;
    expect(moved.labelT).toBe(0.4); // pill y 120.792 to 138.792, grown by 2 to 140.792: the line y = 144 is clear
    near(moved.label!, 688.48, 129.792);
  });
  it("two columns are centred on each other: 2 matches and 3 step-2 nodes", () => {
    const B: Network = { nodes: [node("q", "query"), node("m0", "match"), node("m1", "match"), node("s0", "step2", "m0"), node("s1", "step2", "m0"), node("s2", "step2", "m1")], edges: [] };
    const lb = layoutNetwork(B);
    expect(lb.height).toBe(256);
    expect(lb.nodes.map((n) => n.centre.y)).toEqual([144, 112, 176, 80, 144, 208]);
  });
  it("an edge to an unknown node is a programmer error", () => {
    expect(() => layoutNetwork({ nodes: [node("q", "query")], edges: [edge("q", "nope", 1)] })).toThrow(/not a node/);
  });
});

// Chip outlines for a rect (364, 182, 248, 52): right edge 612, bottom 234, corner 10, pill radius 26.
describe("chipPath: one shape per database", () => {
  const r = { x: 364, y: 182, width: 248, height: 52 };
  it("CARD rounded, NCBI cut corners, ResFinder pill, worked by hand", () => {
    expect(chipPath(r, "round")).toBe("M374,182 H602 Q612,182 612,192 V224 Q612,234 602,234 H374 Q364,234 364,224 V192 Q364,182 374,182 Z");
    expect(chipPath(r, "cut")).toBe("M374,182 H602 L612,192 V224 L602,234 H374 L364,224 V192 Z");
    expect(chipPath(r, "pill")).toBe("M390,182 H586 A26,26 0 0 1 586,234 H390 A26,26 0 0 1 390,182 Z");
  });
  it("a short swatch clamps the corner to half its height (14 high: 7)", () => {
    expect(chipPath({ x: 2, y: 1, width: 30, height: 14 }, "cut")).toBe("M9,1 H25 L32,8 V8 L25,15 H9 L2,8 V8 Z");
  });
  it("the three databases map to three different shapes", () => {
    expect(new Set(Object.values(DB_SHAPE)).size).toBe(3);
  });
});

describe("pillRect: width grows with the text", () => {
  it("the identity pill '98.2%' (5 characters, 18 high) and a '+5' expand pill (2 characters, 20 high)", () => {
    // width 12 + 6*5 = 42; x = 332.12 - 21 = 311.12; y = 195.904 - 9 = 186.904
    const p = pillRect({ x: 332.12, y: 195.904 }, 5, 18);
    expect([p.width, p.height]).toEqual([42, 18]);
    expect(p.x).toBeCloseTo(311.12, 9);
    expect(p.y).toBeCloseTo(186.904, 9);
    // width 12 + 12 = 24 centred on (628, 208): x = 616, y = 198
    expect(pillRect({ x: 628, y: 208 }, 2, 20)).toEqual({ x: 616, y: 198, width: 24, height: 20 });
  });
});

describe("ellipsize", () => {
  it("keeps short text, cuts long text to max characters with an ellipsis, counting code points", () => {
    expect(ellipsize("abcdefghij", 10)).toBe("abcdefghij");
    expect(ellipsize("abcdefghijk", 10)).toBe("abcdefghi…");
    expect(ellipsize("x".repeat(30), 24)).toBe(`${"x".repeat(23)}…`);
    expect(ellipsize("ab😀cde", 4)).toBe("ab😀…");
  });
});

describe("click targets", () => {
  const l = layoutNetwork(A);
  it("every chip is its own target and at least 44 by 44 viewBox units, centred on the node", () => {
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
  it("expand targets are 44 by 44 and exist for the matches only", () => {
    const regions = expandRegions(l);
    expect(regions.map((r) => r.id)).toEqual(["m0", "m1", "m2"]);
    for (const r of regions) expect([r.width, r.height]).toEqual([44, 44]);
    expect(regions[2]).toEqual({ id: "m2", x: 606, y: 186, width: 44, height: 44 });
  });
  it("chips never overlap each other and expand targets never touch another node's chip, at the cap", () => {
    const nodes = [node("q", "query"), ...Array.from({ length: 6 }, (_, i) => node(`m${i}`, "match")), ...Array.from({ length: MAX_NODES - 7 }, (_, i) => node(`s${i}`, "step2", "m0"))];
    const c = layoutNetwork({ nodes, edges: [] });
    expect(c.height).toBe(32 + 2 * 16 + 64 * 18);
    const apart = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
      a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
    const rs = hitRegions(c);
    for (const a of rs) {
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.y).toBeGreaterThanOrEqual(0);
      expect(a.x + a.width).toBeLessThanOrEqual(c.width);
      expect(a.y + a.height).toBeLessThanOrEqual(c.height);
      for (const b of rs) if (a !== b) expect(apart(a, b), `${a.id} and ${b.id}`).toBe(true);
    }
    const xs = expandRegions(c);
    for (const x of xs) {
      expect(x.x + x.width).toBeLessThanOrEqual(c.width);
      for (const b of rs) if (b.id !== x.id) expect(apart(x, b), `expand ${x.id} and ${b.id}`).toBe(true);
      for (const y of xs) if (x !== y) expect(apart(x, y)).toBe(true);
    }
  });
});

describe("layoutNetwork works for 0 to 25 nodes", () => {
  it("handles every size, with finite coordinates and everything inside the viewBox", () => {
    for (let n = 1; n <= MAX_NODES; n++) {
      const matches = Math.min(6, n - 1);
      const nodes = [node("q", "query"), ...Array.from({ length: matches }, (_, i) => node(`m${i}`, "match")), ...Array.from({ length: n - 1 - matches }, (_, i) => node(`s${i}`, "step2", "m0"))];
      const l = layoutNetwork({ nodes, edges: nodes.slice(1, 1 + matches).map((m) => edge("q", m.id, 1)) });
      expect(l.nodes).toHaveLength(n);
      for (const s of l.nodes) {
        expect(s.rect.x).toBeGreaterThanOrEqual(0);
        expect(s.rect.x + s.rect.width).toBeLessThanOrEqual(l.width);
        expect(s.rect.y).toBeGreaterThanOrEqual(32); // below the column headings
        expect(s.rect.y + s.rect.height).toBeLessThanOrEqual(l.height);
      }
      for (const e of l.edges) expect(Number.isFinite(e.path.from.x + e.path.to.y + e.label!.x)).toBe(true);
    }
  });
});

// placeLabel by hand. A horizontal curve (both controls on the end y) is the straight line y = Y; the link from
// (628, 96) to (628, 192) with controls at x = 712 has y(t) = 96 + 96 * (3ut^2 + t^3) and x(t) = 628 * (u^3 + t^3) + 712 * 3ut
// (u = 1 - t). Pill "match of a match": 16 characters, 12 + 96 = 108 wide, 18 high.
//   t = 0.5: u = 0.5: y = 96 + 0.5 * 96 = 144, x = 628 * 0.25 + 712 * 0.75 = 691.
//   t = 0.4: u = 0.6: 3ut^2 = 0.288, t^3 = 0.064: y = 96 + 0.352 * 96 = 129.792; x = 628 * 0.28 + 712 * 0.72 = 688.48.
//   t = 0.6: y = 96 + 0.648 * 96 = 158.208; x = 688.48 again (x is symmetric in t).
const link: Cubic = { from: { x: 628, y: 96 }, c1: { x: 712, y: 96 }, c2: { x: 712, y: 192 }, to: { x: 628, y: 192 } };
const flat = (y: number): Cubic => ({ from: { x: 500, y }, c1: { x: 600, y }, c2: { x: 800, y }, to: { x: 900, y } });
describe("placeLabel: the first place along the curve that touches nothing", () => {
  it("nothing around: t = 0.5", () => {
    const p = placeLabel(link, 16, [], []);
    expect(p.t).toBe(0.5);
    near(p.point, 691, 144);
    expect(p.touches).toBe(0);
  });
  it("a line through the middle moves it to t = 0.4 (pill y 120.792 to 138.792, grown by 2 still short of 144)", () => {
    const p = placeLabel(link, 16, [flat(144)], []);
    expect(p.t).toBe(0.4);
    near(p.point, 688.48, 129.792);
    expect(p.touches).toBe(0);
  });
  it("lines through t = 0.5 and t = 0.4 as well: t = 0.6 (y 158.208, pill 149.208 to 167.208)", () => {
    const p = placeLabel(link, 16, [flat(144), flat(130)], []);
    expect(p.t).toBe(0.6);
    near(p.point, 688.48, 158.208);
  });
  it("an identity pill or earlier label in the way counts as ten touches", () => {
    const p = placeLabel(link, 16, [], [{ x: 640, y: 140, width: 40, height: 10 }]); // covers t = 0.5 only
    expect(p.t).toBe(0.4);
    const stuck = placeLabel(link, 16, [], [{ x: 0, y: 0, width: 2000, height: 2000 }]);
    expect([stuck.t, stuck.touches]).toEqual([0.5, 10]); // equally bad everywhere: the first place
  });
  it("when every place is touched the cheapest wins, the earliest on a tie", () => {
    // A vertical wall at x = 691 from y = 0 to 320 with its samples every 10 units (y = 10k): it crosses every place.
    // The pill grown by 2 spans y +-11 about the centre: t = 0.5 (133 to 155) holds the samples y = 140 and 150, so 2;
    // t = 0.4 (118.79 to 140.79) holds 120, 130, 140: 3; t = 0.6 (147.2 to 169.2) holds 150 and 160: 2.
    const wall: Cubic = { from: { x: 691, y: 0 }, c1: { x: 691, y: 320 / 3 }, c2: { x: 691, y: 640 / 3 }, to: { x: 691, y: 320 } };
    const tie = placeLabel(link, 16, [wall], []);
    expect([tie.t, tie.touches]).toEqual([0.5, 2]);
    // Add the line y = 144 (about nine samples fall in the pill at t = 0.5, none at 0.4 or 0.6): t = 0.4 now has 3, t = 0.6 has 2.
    const p = placeLabel(link, 16, [wall, flat(144)], []);
    expect([p.t, p.touches]).toEqual([0.6, 2]);
  });
});
