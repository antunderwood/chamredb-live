import { describe, expect, it } from "vitest";
import {
  PORTRAIT_BELOW,
  cubicAt,
  expandRegions,
  hitRegions,
  layoutNetwork,
  orientationFor,
  pillRect,
  ribbonRect,
  textLimits,
  type EdgeSlot,
  type NetLayout,
  type Point,
  type Rect,
} from "./networkLayout";
import type { NetEdge, NetNode, Network } from "./networkModel";

// Portrait (phone) layout, expected pixels worked by hand (docs/network-layout.md, "Portrait"). Constants: P_SIDE 12,
// P_TOP 12, P_BOTTOM 12, P_RIGHT 24, GAP 28 (so a row is 52 + 28 = 80), LANE 5 with at most LANE_SPAN 25 between the first
// and the last lane, LANE_LEFT 24, ELBOW 20 (first lane to chip), INDENT 28 (step-2 chip), EXPAND_FROM 20, PILL_DX 22,
// PILL_RISE 14, BOW_BASE 24 + BOW_STEP 8 per extra row spanned (at most 3 rows), BOW_ROOM 8, QUERY_LINK_P 20, LINK_INSET 16,
// LABEL_DX 48, LABEL_DY 11.
//
// Fixture P1, width 360: query, three matches, one step-2 node under the last match. No link, so the right margin is 24.
//   xr = 360 - 24 = 336. Query chip: x = 12, y = 12, width 336 - 12 = 324, height 72: centre (174, 48), bottom 84.
//   Lanes: 3 edges, pitch min(5, 25 / 2) = 5; first lane x = 24 + 2 * 5 = 34, then 29 and 24. Chip left edge 34 + 20 = 54, width 336 - 54 = 282.
//   Row centres: 84 + 28 + 26 = 138, then + 80: 138, 218, 298; the step-2 row is the fourth: 378.
//   Chips: (54, 112), (54, 192), (54, 272), 282 by 52. Step-2 chip: x = 54 + 28 = 82, width 336 - 82 = 254, y = 378 - 26 = 352.
//   Size: width 360; height = 378 + 26 + 12 = 416.
//   Edges (straight, controls at thirds): query to the last match from (24, 84) to (54, 298): controls (34, 84 + 214 / 3) = (34, 155.3333) and (44, 226.6667).
//   Identity pill: centre y = chip top - 14 = 258, on the line at t = (258 - 84) / 214 = 0.813084: x = 24 + 30 * 0.813084 = 48.3925; the pill
//   centre is PILL_DX = 22 right of that: (70.3925, 258). First match: t = 14 / 54 = 0.259259, line x = 34 + 20 * t = 39.1852, pill (61.1852, 98).
//   Middle match: from (29, 84) to (54, 218), t = 94 / 134 = 0.701493, x = 29 + 25 * t = 46.5373, pill (68.5373, 178).
//   Step-2 edge: from the last match, 20 right of its left edge on its bottom (74, 324), to the step-2 chip's left edge middle (82, 378).
//   Expand pill of the last match: centre (336, 298), hit (314, 276, 44, 44).
//   Text limits (name 19, id 22, detail 24 at a 174 unit text area; the area is chip width - 64 - 10 - 16): chip 282: 192 / 174 > 1, so unchanged;
//   step-2 chip 254: area 164, floor(19 * 164 / 174) = 17, floor(22 * 164 / 174) = 20, floor(24 * 164 / 174) = 22; the query (name 14) stays 14.
const node = (id: string, role: NetNode["role"], via?: string, more: Partial<NetNode> = {}): NetNode => ({ id, database: "card", name: id, role, via, best: false, weak: false, ...more });
const edge = (source: string, target: string, step: 1 | 2): NetEdge => ({ source, target, identity: 0.95, coverage: 1, type: "RBH", step });
const P1: Network = {
  nodes: [node("q", "query"), node("m0", "match"), node("m1", "match"), node("m2", "match"), node("s0", "step2", "m2")],
  edges: [edge("q", "m0", 1), edge("q", "m1", 1), edge("q", "m2", 1), edge("m2", "s0", 2)],
};
const near = (p: Point, x: number, y: number, digits = 3) => {
  expect(p.x).toBeCloseTo(x, digits);
  expect(p.y).toBeCloseTo(y, digits);
};
const portrait = (n: Pick<Network, "nodes" | "edges">, width = 360) => layoutNetwork(n, { orientation: "portrait", width });

describe("orientationFor: portrait below the width at which the one-step landscape picture stops fitting", () => {
  it("640 is the line: below it portrait, at or above it landscape", () => {
    expect(PORTRAIT_BELOW).toBe(640);
    expect(orientationFor(639)).toBe("portrait");
    expect(orientationFor(640)).toBe("landscape");
    expect(orientationFor(1000)).toBe("landscape");
    expect(orientationFor(328)).toBe("portrait");
  });
});

describe("layoutNetwork, portrait: hand-worked pixels (fixture P1, width 360)", () => {
  const l = portrait(P1);
  const at = (id: string) => l.nodes.find((n) => n.id === id)!;
  const line = (s: string, t: string) => l.edges.find((e) => e.source === s && e.target === t)!;
  it("size is the width given and a height from the content", () => {
    expect(l.orientation).toBe("portrait");
    expect([l.width, l.height]).toEqual([360, 416]);
    expect(l.heads).toEqual([]);
  });
  it("chip rectangles: the query fills the width, matches are in one column, the step-2 chip is indented", () => {
    expect(at("q").rect).toEqual({ x: 12, y: 12, width: 324, height: 72 });
    expect(at("m0").rect).toEqual({ x: 54, y: 112, width: 282, height: 52 });
    expect(at("m1").rect).toEqual({ x: 54, y: 192, width: 282, height: 52 });
    expect(at("m2").rect).toEqual({ x: 54, y: 272, width: 282, height: 52 });
    expect(at("s0").rect).toEqual({ x: 82, y: 352, width: 254, height: 52 });
    near(at("m2").centre, 195, 298, 9);
    near(at("s0").centre, 209, 378, 9);
  });
  it("text lines, badge and tooltip anchor derive from the chip", () => {
    const m2 = at("m2");
    expect(m2.badge).toEqual({ x: 54, y: 272, width: 64, height: 52 });
    expect(m2.lines.map((p) => [p.x, p.y])).toEqual([[128, 292], [128, 306], [128, 319]]);
    near(m2.tooltip, 195, 324, 9);
  });
  it("text limits shrink with the chip and are never above the landscape ones", () => {
    expect(at("m2").limits).toEqual({ name: 19, sub: 22, detail: 24 });
    expect(at("s0").limits).toEqual({ name: 17, sub: 20, detail: 22 });
    expect(at("q").limits).toEqual({ name: 14, sub: 22, detail: 24 });
    expect(textLimits(248 + 0)).toEqual({ name: 17, sub: 19, detail: 21 }); // 158 / 174: 19 * 158 / 174 = 17.25, 22 * 158 / 174 = 19.98, 24 * 158 / 174 = 21.79
  });
  it("one expand pill per match, on the right edge, 44 by 44", () => {
    expect(at("m2").expand).toEqual({ centre: { x: 336, y: 298 }, hit: { x: 314, y: 276, width: 44, height: 44 } });
    expect(at("s0").expand).toBeUndefined();
    expect(at("q").expand).toBeUndefined();
  });
  it("step-1 edges are straight, leave the query's bottom in their own lane and enter the chip's left edge middle", () => {
    const last = line("q", "m2");
    expect(last.kind).toBe("query");
    near(last.path.from, 24, 84, 9);
    near(last.path.to, 54, 298, 9);
    near(last.path.c1, 34, 84 + 214 / 3, 9);
    near(last.path.c2, 44, 84 + 428 / 3, 9);
    near(line("q", "m0").path.from, 34, 84, 9);
    near(line("q", "m0").path.to, 54, 138, 9);
    near(line("q", "m1").path.from, 29, 84, 9);
    near(line("q", "m1").path.to, 54, 218, 9);
  });
  it("identity pills sit just above their chip, on the right of their own line", () => {
    near(line("q", "m2").label!, 70.3925, 258, 3);
    expect(line("q", "m2").labelT).toBeCloseTo(174 / 214, 9);
    near(line("q", "m0").label!, 61.1852, 98, 4);
    near(line("q", "m1").label!, 68.5373, 178, 4);
    // the line itself passes the pill's left end
    const e = line("q", "m2");
    near(cubicAt(e.path, e.labelT!), 48.3925, 258, 3);
  });
  it("the step-2 edge starts on the match's bottom and ends at the step-2 chip's left edge middle, with no label", () => {
    const e = line("m2", "s0");
    expect(e.kind).toBe("expand");
    near(e.path.from, 74, 324, 9);
    near(e.path.to, 82, 378, 9);
    expect(e.label).toBeUndefined();
  });
});

// Fixture P2, width 360: query, m0, m1 with a link between them (m0 to m1, one row apart).
//   A link one row long bows BOW_BASE = 24 (its middle reaches 0.75 * 24 = 18), so the right margin is max(24, 18 + 8) = 26: xr = 334.
//   Lanes: 2 edges, pitch 5, first lane x = 24 + 5 = 29; chip left 29 + 20 = 49, chip width 334 - 49 = 285, query 334 - 12 = 322.
//   Rows 138 and 218. Link: from (334, 138 + 16) = (334, 154) to (334, 218 - 16) = (334, 202); controls at x = 334 + 24 = 358.
//   The gap between the chips is y 164 to 192; the label's centre y = 164 + LABEL_DY = 175. y(t) = 154 + 48 (3t^2 - 2t^3) = 175
//   gives 3t^2 - 2t^3 = 0.4375, t = 0.45832 (Newton from 0.45: f = 0.42525, f' = 6t(1 - t) = 1.4850, step 0.00841; again: f = 0.43745, step 0.00005).
//   x(t) = 334 + 3 * 24 * t * (1 - t) = 334 + 72 * 0.45832 * 0.54168 = 351.8749; the label's centre is LABEL_DX = 48 left of that: 303.8749.
//   A link two rows long bows 32 and one three rows or more long bows 40 (margin 40 * 0.75 + 8 = 38): nested links do not lie on one another.
const P2: Network = {
  nodes: [node("q", "query"), node("m0", "match"), node("m1", "match")],
  edges: [edge("q", "m0", 1), edge("q", "m1", 1), edge("m0", "m1", 2)],
};
describe("layoutNetwork, portrait: a link between two matches (fixture P2)", () => {
  const l = portrait(P2);
  const link = l.edges.find((e) => e.kind === "link")!;
  it("the right margin grows to 26 to hold the bow", () => {
    expect(l.nodes.find((n) => n.id === "m0")!.rect).toEqual({ x: 49, y: 112, width: 285, height: 52 });
    expect(l.nodes.find((n) => n.id === "q")!.rect).toEqual({ x: 12, y: 12, width: 322, height: 72 });
  });
  it("the link leaves the right edge 16 below the chip's middle and enters 16 above the next, bowing 24 right", () => {
    near(link.path.from, 334, 154, 9);
    near(link.path.to, 334, 202, 9);
    near(link.path.c1, 358, 154, 9);
    near(link.path.c2, 358, 202, 9);
  });
  it("a link spanning more rows bows further, up to 40, and the margin follows", () => {
    const wide = portrait(fixture(5, [], [[0, 4]], []));
    const far = wide.edges.find((e) => e.kind === "link")!;
    expect(far.path.c1.x - far.path.from.x).toBe(40);
    expect(wide.nodes.find((n) => n.id === "q")!.rect.x + wide.nodes.find((n) => n.id === "q")!.rect.width).toBe(360 - 38);
    const mid = portrait(fixture(5, [], [[0, 2]], [])).edges.find((e) => e.kind === "link")!;
    expect(mid.path.c1.x - mid.path.from.x).toBe(32);
  });
  it("its label sits in the gap below the upper chip, its right end on the curve", () => {
    expect(link.labelT).toBeCloseTo(0.45832, 3);
    near(link.label!, 303.8749, 175, 3);
    const r = pillRect(link.label!, 16, 18);
    expect(r.y).toBeCloseTo(166, 6); // 164 + 2, clear of the chip below (192; its Best ribbon starts at 185)
    expect(r.y + r.height).toBeLessThanOrEqual(185);
  });
});

// Helpers for the invariants.
const rects = (l: NetLayout): Rect[] => l.nodes.map((n) => n.rect);
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const strictlyInside = (r: Rect, p: Point, grow = 0) => p.x > r.x - grow && p.x < r.x + r.width + grow && p.y > r.y - grow && p.y < r.y + r.height + grow;
const samples = (e: EdgeSlot) => Array.from({ length: 33 }, (_, k) => cubicAt(e.path, k / 32));

// A cluster of fixtures: sizes 0 to 6 matches, expansions, links and back links.
function fixture(matches: number, expanded: number[], links: [number, number][], back: number[], best = false): Network {
  const nodes: NetNode[] = [node("q", "query")];
  const edges: NetEdge[] = [];
  for (let i = 0; i < matches; i++) {
    nodes.push(node(`m${i}`, "match", undefined, best ? { best: true, weak: i % 2 === 0, hit: { identity: 0.9, coverage: 1, type: "RBH" } } : {}));
    edges.push(edge("q", `m${i}`, 1));
  }
  for (const i of expanded) {
    nodes.push(node(`s${i}a`, "step2", `m${i}`), node(`s${i}b`, "step2", `m${i}`));
    edges.push(edge(`m${i}`, `s${i}a`, 2), edge(`m${i}`, `s${i}b`, 2));
  }
  for (const [a, b] of links) edges.push(edge(`m${a}`, `m${b}`, 2));
  for (const i of back) edges.push(edge(`m${i}`, "q", 2));
  return { nodes, edges };
}
const CASES: [string, Network][] = [
  ["query only", fixture(0, [], [], [])],
  ["one match", fixture(1, [], [], [])],
  ["six matches", fixture(6, [], [], [])],
  ["six matches, all with ribbons", fixture(6, [], [], [], true)],
  ["twenty matches", fixture(20, [], [], [])],
  ["expanded first, middle and last", fixture(4, [0, 2, 3], [], [])],
  ["links, adjacent and far", fixture(5, [], [[0, 1], [0, 4], [3, 1], [2, 3]], [])],
  ["back links and expansions", fixture(4, [1, 2], [[0, 3]], [1, 3])],
  ["a crowd of links", fixture(6, [1, 4], [[0, 1], [0, 2], [0, 3], [1, 2], [2, 5], [3, 5], [0, 5]], [0, 2, 5])],
];

describe.each([320, 360, 390, 600, 639])("portrait invariants at width %i", (width) => {
  const W = width - 10;
  it.each(CASES)("%s: chips do not overlap, everything is inside the picture, no edge enters a chip", (_name, net) => {
    const l = portrait(net, W);
    const chips = rects(l);
    for (let i = 0; i < chips.length; i++) for (let j = i + 1; j < chips.length; j++) expect(overlap(chips[i]!, chips[j]!), `${i} ${j}`).toBe(false);
    for (const r of chips) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(l.width);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.y + r.height).toBeLessThanOrEqual(l.height);
    }
    for (const e of l.edges) {
      for (const p of samples(e)) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(l.width);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(l.height);
        for (const r of chips) expect(strictlyInside(r, p, -0.001), `edge ${e.source}>${e.target} enters a chip at ${p.x},${p.y}`).toBe(false);
      }
      if (e.label) {
        const r = pillRect(e.label, e.kind === "query" ? 6 : 16, 18);
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width).toBeLessThanOrEqual(l.width);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.y + r.height).toBeLessThanOrEqual(l.height);
      }
    }
  });
  it.each(CASES)("%s: labels touch no chip, no ribbon and no other label; every target is 44 or more", (_name, net) => {
    const l = portrait(net, W);
    const taken: Rect[] = [];
    for (const e of l.edges) {
      if (!e.label) continue;
      const r = pillRect(e.label, e.kind === "query" ? 6 : 16, 18);
      for (const c of rects(l)) expect(overlap(r, c), `label of ${e.source}>${e.target} on a chip`).toBe(false);
      for (const s of l.nodes) {
        const kind = (net.nodes.find((n) => n.id === s.id) as NetNode).best ? "weak" : null;
        if (kind) expect(overlap(r, ribbonRect(s, kind)), `label of ${e.source}>${e.target} on the ribbon of ${s.id}`).toBe(false);
      }
      for (const t of taken) expect(overlap(r, t), `labels of ${e.source}>${e.target} overlap`).toBe(false);
      taken.push(r);
    }
    for (const h of hitRegions(l)) {
      expect(h.height).toBeGreaterThanOrEqual(44);
      expect(h.width).toBeGreaterThanOrEqual(44);
    }
    for (const h of expandRegions(l)) {
      expect(h.height).toBeGreaterThanOrEqual(44);
      expect(h.x).toBeGreaterThanOrEqual(0);
      expect(h.x + h.width).toBeLessThanOrEqual(l.width);
      for (const c of l.nodes.filter((n) => n.id !== h.id)) expect(overlap(h, c.rect), `the pill of ${h.id} reaches ${c.id}`).toBe(false);
    }
  });
  it.each(CASES)("%s: visual order is top to bottom: the query, then each match followed by its own step-2 nodes", (_name, net) => {
    const l = portrait(net, W);
    const ys = l.nodes.map((n) => n.centre.y);
    const order = l.nodes.map((n, i) => ({ id: n.id, y: ys[i]! })).sort((a, b) => a.y - b.y);
    expect(order[0]!.id).toBe("q");
    for (let i = 1; i < order.length; i++) expect(order[i]!.y).toBeGreaterThan(order[i - 1]!.y);
    // a step-2 chip is directly under its own match or under a sibling of it
    for (const n of net.nodes.filter((x) => x.role === "step2")) {
      const row = order.findIndex((o) => o.id === n.id);
      let k = row - 1;
      while (k > 0 && net.nodes.find((x) => x.id === order[k]!.id)!.role === "step2") k--;
      expect(order[k]!.id, `${n.id} sits under ${n.via}`).toBe(n.via);
    }
  });
  it.each(CASES)("%s: text limits are never above the landscape ones, and a chip holds its text", (_name, net) => {
    const l = portrait(net, W);
    for (const s of l.nodes) {
      const q = s.role === "query";
      expect(s.limits.name).toBeLessThanOrEqual(q ? 14 : 19);
      expect(s.limits.sub).toBeLessThanOrEqual(22);
      expect(s.limits.detail).toBeLessThanOrEqual(24);
      expect(s.limits.name).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("portrait: no two step-1 lines cross (later lanes lie further left)", () => {
  it("six matches: every pair of lines keeps its left to right order from the query to the chips", () => {
    const l = portrait(fixture(6, [], [], []));
    const lines = l.edges.filter((e) => e.kind === "query");
    for (let a = 0; a < lines.length; a++)
      for (let b = a + 1; b < lines.length; b++) {
        const [ea, eb] = [lines[a]!, lines[b]!];
        for (let k = 0; k <= 32; k++) {
          const y = ea.path.from.y + ((ea.path.to.y - ea.path.from.y) * k) / 32;
          // x of line b at the same height (straight lines)
          const tb = (y - eb.path.from.y) / (eb.path.to.y - eb.path.from.y);
          if (tb < 0 || tb > 1) continue;
          const xb = eb.path.from.x + (eb.path.to.x - eb.path.from.x) * tb;
          const xa = cubicAt(ea.path, k / 32).x;
          expect(xa, `${a} right of ${b} at y ${y}`).toBeGreaterThanOrEqual(xb - 1e-9);
        }
      }
  });
  it("more than six matches: the lanes squeeze into the same 30 units", () => {
    const l = portrait(fixture(11, [], [], []));
    const xs = l.edges.filter((e) => e.kind === "query").map((e) => e.path.from.x);
    expect(xs[0]! - xs[10]!).toBeCloseTo(25, 9);
    expect(xs[10]).toBeCloseTo(24, 9);
  });
});

describe("portrait: the landscape layout is untouched", () => {
  it("no view argument draws landscape, as before", () => {
    const l = layoutNetwork(P1);
    expect(l.orientation).toBe("landscape");
    expect(l.nodes.find((n) => n.id === "m2")!.limits).toEqual({ name: 19, sub: 22, detail: 24 });
    expect(l.nodes.find((n) => n.id === "q")!.limits).toEqual({ name: 14, sub: 22, detail: 24 });
    expect(l.heads.length).toBe(3);
  });
});
