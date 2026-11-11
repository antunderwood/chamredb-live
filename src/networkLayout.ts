// Pure geometry for the interactive network (tickets #9 and #10). `pixel` is the ONLY function that maps a slot to
// pixel coordinates: chip rectangles, edge ends, text baselines, the Best ribbon, the expand pill, tooltip anchors
// and hit regions all derive from it (through `layoutNetwork`), so there is no second mapping to drift. It works on
// internal slot numbers only (column, row), never on ids. The UI draws what is returned here and adds no coordinate
// of its own: every offset it needs is a named constant of this file. Derivation: docs/network-layout.md.
//
// Three columns, left to right: the query (column 0), its shown matches (column 1) and, when an entry is
// expanded, the matches of those matches (column 2). A column of k nodes is centred on the tallest column. The
// viewBox is computed from the content, so a picture with no step-2 nodes is narrower.
//
// Every number is a viewBox unit. A unit is one CSS pixel only when the figure is drawn at its own width, so the UI
// keeps the figure at its design width inside a horizontally scrolling container (a node is at least 44 units high).
import type { NetEdge, NetNode, Network, Role } from "./networkModel";

export const ROW = 64; // vertical space per node: a 52 unit chip plus a 12 unit gap
export const PAD = 16; // space above the first and below the last row
export const HEADER = 32; // column headings sit in this band above the first row (baseline HEAD_Y)
export const HEAD_Y = 20;
export const SIDE = 16; // space left of the query chip and right of the last chip
export const QUERY_W = 224;
export const QUERY_H = 72;
export const CHIP_W = 248; // a match or step-2 chip
export const CHIP_H = 52; // at least 44, so the chip is its own click target
export const MARGIN_X = SIDE + QUERY_W / 2; // column 0 centre: 128
export const COL_GAP = 376; // distance between column centres
export const BADGE_W = 64; // the database badge at the left of a chip (text label, never colour alone)
export const TEXT_PAD = 10; // gap between the badge and the text
export const LINE = [20, 34, 47] as const; // baselines of the three text lines of a chip, from its top
export const QUERY_LINE = [28, 45, 61] as const; // the same for the query chip
export const RIBBON_H = 14;
export const RIBBON_RISE = 7; // the ribbon overhangs the top edge of the chip by this much
export const RIBBON_INSET = 12; // gap between the ribbon and the right edge of the chip
export const RIBBON_W = { best: 48, weak: 136, below: 80 } as const; // "Best", "Highest identity shown" and "Below 90%"
export const EXPAND_HIT = 44; // side of the click target of the expand pill (centred on the chip's right edge)
export const EXPAND_H = 20; // drawn height of the pill
export const EXPAND_R = 20; // a step-2 edge starts this far right of the chip edge, clear of the pill
export const FAN = 8; // spacing of the points where step-1 edges leave the query chip (at most QUERY_H - 16 in all)
export const LINK_INSET = 16; // a same-column link leaves and enters this far from the chip's vertical centre
export const QUERY_LINK = 30; // a link back to the query enters this far below its centre, clear of the fan
export const BOW = 84; // a same-column link bows this far to the right
export const LABEL_T = 0.7; // identity pill of a step-1 edge sits at this parameter of the curve
export const LINK_T = 0.5; // label of a step-2 link: the first place tried (see placeLabel)
// A "match of a match" label is moved along its curve off other edges: the places tried, in order, are these
// parameters; a label is "clear" at a parameter when no other edge, no identity pill and no earlier label touches its
// pill (grown by LABEL_CLEAR units on each side). The first clear place wins; if none is, the one touching least.
export const LABEL_TS = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8] as const;
export const LABEL_CLEAR = 2;
export const SAMPLES = 32; // other edges are tested at t = k / SAMPLES, k = 0 to SAMPLES
export const LINK_LABEL_CHARS = 16; // "match of a match"
export const ID_LABEL_CHARS = 6; // the widest identity pill, "100.0%"
const PILL_WEIGHT = 10; // touching another pill costs this many edge samples
// How much text a chip line holds (characters), at the font sizes of app.css: longer text is cut with an ellipsis and
// the full text is in the tooltip and in the list.
export const NAME_MAX = 19;
export const ID_MAX = 22; // was 24; the Linux CI font is wider than the macOS one (a 24-character line overflowed by 5 px)
export const DETAIL_MAX = 24;
export const QUERY_NAME_MAX = 14; // was 16; on the wider Linux CI font a 16-character bold name overflowed the query chip by 5.5 px

export interface Point {
  x: number;
  y: number;
}
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Cubic {
  from: Point;
  c1: Point;
  c2: Point;
  to: Point;
}
export interface NodeSlot {
  id: string;
  role: Role;
  column: 0 | 1 | 2;
  centre: Point;
  rect: Rect; // the chip; it is also the click target
  hit: Rect;
  badge: Rect; // the database badge, at the left of the chip
  badgeText: Point; // text-anchor middle
  lines: [Point, Point, Point]; // baselines of the three text lines, text-anchor start
  tooltip: Point; // middle of the bottom edge of the chip
  expand?: { centre: Point; hit: Rect }; // step-1 nodes only: the pill on the chip's right edge
}
export type EdgeKind = "query" | "expand" | "link" | "back";
export interface EdgeSlot {
  source: string;
  target: string;
  step: 1 | 2;
  kind: EdgeKind; // query: query to a match; expand: a match to a step-2 node; link: between two matches; back: to the query
  path: Cubic; // from the source side to the target side
  label?: Point; // centre of the identity pill (step 1) or of the "match of a match" label (links); none on expand edges
  labelT?: number; // where on the curve the label is (0 at the source); LABEL_T for an identity pill
}
export interface ColumnHead {
  column: 0 | 1 | 2;
  x: number;
  y: number;
}
export interface NetLayout {
  width: number;
  height: number;
  heads: ColumnHead[];
  nodes: NodeSlot[]; // in the order of network.nodes
  edges: EdgeSlot[]; // in the order of network.edges
}

// The single position-to-pixel function. column: 0 query, 1 matches, 2 step-2; row: 0 to count - 1 within the
// column; count: nodes in this column; rows: nodes in the tallest column (at least 1).
// Row centre y = HEADER + PAD + ROW * ((rows - count) / 2 + row) + ROW / 2.
export function pixel(column: 0 | 1 | 2, row: number, count: number, rows: number): Point {
  return { x: MARGIN_X + COL_GAP * column, y: HEADER + PAD + ROW * ((rows - count) / 2 + row) + ROW / 2 };
}

const COLUMN = { query: 0, match: 1, step2: 2 } as const;
const widthOf = (role: Role) => (role === "query" ? QUERY_W : CHIP_W);
const heightOf = (role: Role) => (role === "query" ? QUERY_H : CHIP_H);

// Text cut to at most `max` characters (code points), ending in an ellipsis when cut.
export function ellipsize(text: string, max: number): string {
  const chars = [...text];
  return chars.length <= max ? text : `${chars.slice(0, Math.max(1, max - 1)).join("")}…`;
}

// The ribbon: overhangs the top edge of the chip at its right. best: "Best"; weak: "Highest identity shown";
// below: "Below 90%" (a match under the line that is not the best of its group).
export function ribbonRect(slot: NodeSlot, kind: keyof typeof RIBBON_W): Rect {
  const width = RIBBON_W[kind];
  return { x: slot.rect.x + slot.rect.width - RIBBON_INSET - width, y: slot.rect.y - RIBBON_RISE, width, height: RIBBON_H };
}

// Chip outline: the database is carried by the shape as well as by colour. CARD: rounded corners of radius CORNER;
// NCBI: corners cut by CORNER; ResFinder: a pill (ends are half circles). Used for the outline, the badge clip and
// the legend swatches.
export const CORNER = 10;
export type ChipShape = "round" | "cut" | "pill";
export const DB_SHAPE = { card: "round", ncbi: "cut", resfinder: "pill" } as const;
export function chipPath({ x, y, width: w, height: h }: Rect, shape: ChipShape): string {
  const [x2, y2, c] = [x + w, y + h, Math.min(CORNER, h / 2)];
  if (shape === "pill") {
    const r = h / 2;
    return `M${x + r},${y} H${x2 - r} A${r},${r} 0 0 1 ${x2 - r},${y2} H${x + r} A${r},${r} 0 0 1 ${x + r},${y} Z`;
  }
  if (shape === "cut") return `M${x + c},${y} H${x2 - c} L${x2},${y + c} V${y2 - c} L${x2 - c},${y2} H${x + c} L${x},${y2 - c} V${y + c} Z`;
  return `M${x + c},${y} H${x2 - c} Q${x2},${y} ${x2},${y + c} V${y2 - c} Q${x2},${y2} ${x2 - c},${y2} H${x + c} Q${x},${y2} ${x},${y2 - c} V${y + c} Q${x},${y} ${x + c},${y} Z`;
}

// A pill around a label (identity on an edge, "+3" on the expand control): width grows with the text.
export const PILL = { pad: 12, char: 6, labelH: 18 } as const;
export const pillRect = (centre: Point, chars: number, height: number): Rect => {
  const width = PILL.pad + PILL.char * chars;
  return { x: centre.x - width / 2, y: centre.y - height / 2, width, height };
};

// The legend swatches (a small drawing of a chip outline and of an edge), in their own viewBox.
export const SWATCH = { width: 34, height: 16, chip: { x: 2, y: 1, width: 30, height: 14 }, line: { from: { x: 5, y: 8 }, to: { x: 29, y: 8 } } } as const;

// A point of a cubic at parameter t.
export function cubicAt(c: Cubic, t: number): Point {
  const u = 1 - t;
  const [a, b, d, e] = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return { x: a * c.from.x + b * c.c1.x + d * c.c2.x + e * c.to.x, y: a * c.from.y + b * c.c1.y + d * c.c2.y + e * c.to.y };
}

const inside = (r: Rect, p: Point, grow: number) => p.x >= r.x - grow && p.x <= r.x + r.width + grow && p.y >= r.y - grow && p.y <= r.y + r.height + grow;
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

// Where a label of `chars` characters goes on `path` so that it does not sit on a crossing. For each parameter in
// LABEL_TS the pill is placed on the curve and charged one for every sample of every curve in `others` that falls inside it
// (grown by LABEL_CLEAR), and PILL_WEIGHT for every rectangle in `taken` it overlaps. The first parameter with no charge
// wins; with none, the cheapest (the earlier in LABEL_TS on a tie). Pure and deterministic.
export function placeLabel(path: Cubic, chars: number, others: Cubic[], taken: Rect[]): { t: number; point: Point; touches: number } {
  let best = { t: LABEL_TS[0] as number, point: cubicAt(path, LABEL_TS[0]), touches: Infinity };
  for (const t of LABEL_TS) {
    const point = cubicAt(path, t);
    const rect = pillRect(point, chars, PILL.labelH);
    let touches = 0;
    for (const o of others) for (let k = 0; k <= SAMPLES; k++) if (inside(rect, cubicAt(o, k / SAMPLES), LABEL_CLEAR)) touches++;
    for (const r of taken) if (overlap(rect, r)) touches += PILL_WEIGHT;
    if (touches < best.touches) best = { t, point, touches };
    if (touches === 0) break;
  }
  return best;
}

// A curve that leaves `from` and enters `to` horizontally: both control points are half the horizontal distance out.
const sCurve = (from: Point, to: Point): Cubic => {
  const dx = (to.x - from.x) / 2;
  return { from, c1: { x: from.x + dx, y: from.y }, c2: { x: to.x - dx, y: to.y }, to };
};

export function layoutNetwork(network: Pick<Network, "nodes" | "edges">): NetLayout {
  const counts = [0, 0, 0];
  for (const n of network.nodes) counts[COLUMN[n.role]]!++;
  const rows = Math.max(1, ...counts);
  const seen = [0, 0, 0];
  const nodes: NodeSlot[] = network.nodes.map((n: NetNode) => {
    const column = COLUMN[n.role];
    const c = pixel(column, seen[column]!++, counts[column]!, rows);
    const [w, h] = [widthOf(n.role), heightOf(n.role)];
    const rect = { x: c.x - w / 2, y: c.y - h / 2, width: w, height: h };
    const base = n.role === "query" ? QUERY_LINE : LINE;
    const x = rect.x + BADGE_W + TEXT_PAD;
    return {
      id: n.id,
      role: n.role,
      column,
      centre: c,
      rect,
      hit: rect,
      badge: { x: rect.x, y: rect.y, width: BADGE_W, height: h },
      badgeText: { x: rect.x + BADGE_W / 2, y: c.y },
      lines: [{ x, y: rect.y + base[0] }, { x, y: rect.y + base[1] }, { x, y: rect.y + base[2] }],
      tooltip: { x: c.x, y: rect.y + h },
      ...(n.role === "match" && {
        expand: { centre: { x: rect.x + w, y: c.y }, hit: { x: rect.x + w - EXPAND_HIT / 2, y: c.y - EXPAND_HIT / 2, width: EXPAND_HIT, height: EXPAND_HIT } },
      }),
    };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const slot = (id: string) => {
    const s = byId.get(id);
    if (!s) throw new Error(`Edge endpoint ${id} is not a node`);
    return s;
  };
  const fanned = network.edges.filter((e) => e.step === 1).length;
  const pitch = fanned > 1 ? Math.min(FAN, (QUERY_H - 16) / (fanned - 1)) : 0;
  let k = 0;
  const edges = network.edges.map((e: NetEdge): EdgeSlot => {
    const a = slot(e.source);
    const b = slot(e.target);
    const base = { source: e.source, target: e.target, step: e.step };
    if (e.step === 1) {
      const from = { x: a.rect.x + a.rect.width, y: a.centre.y + (k++ - (fanned - 1) / 2) * pitch };
      const path = sCurve(from, { x: b.rect.x, y: b.centre.y });
      return { ...base, kind: "query", path, label: cubicAt(path, LABEL_T), labelT: LABEL_T };
    }
    if (b.role === "step2") return { ...base, kind: "expand", path: sCurve({ x: a.rect.x + a.rect.width + EXPAND_R, y: a.centre.y }, { x: b.rect.x, y: b.centre.y }) };
    if (b.role === "query") {
      const path = sCurve({ x: a.rect.x, y: a.centre.y + LINK_INSET }, { x: b.rect.x + b.rect.width, y: b.centre.y + QUERY_LINK });
      return { ...base, kind: "back", path };
    }
    const dir = Math.sign(b.centre.y - a.centre.y);
    const xr = a.rect.x + a.rect.width;
    const from = { x: xr, y: a.centre.y + dir * LINK_INSET };
    const to = { x: xr, y: b.centre.y - dir * LINK_INSET };
    const path = { from, c1: { x: xr + BOW, y: from.y }, c2: { x: xr + BOW, y: to.y }, to };
    return { ...base, kind: "link", path };
  });
  // Second pass: the labels of links and back links go where they touch no other edge (placeLabel). The identity pills
  // are fixed; the others are placed in edge order, each avoiding the pills and the labels already placed.
  const taken: Rect[] = edges.flatMap((e) => (e.label ? [pillRect(e.label, ID_LABEL_CHARS, PILL.labelH)] : []));
  edges.forEach((e) => {
    if (e.kind !== "link" && e.kind !== "back") return;
    const { t, point } = placeLabel(e.path, LINK_LABEL_CHARS, edges.filter((o) => o !== e).map((o) => o.path), taken);
    e.label = point;
    e.labelT = t;
    taken.push(pillRect(point, LINK_LABEL_CHARS, PILL.labelH));
  });
  const last = counts[2]! > 0 ? 2 : counts[1]! > 0 ? 1 : 0;
  const right = pixel(last, 0, 1, 1).x + (last === 0 ? QUERY_W : CHIP_W) / 2 + SIDE;
  const heads = ([0, 1, 2] as const).filter((c) => c <= last).map((column) => ({ column, x: pixel(column, 0, 1, 1).x, y: HEAD_Y }));
  // The picture must hold everything drawn: a link bows right of its column and its label sits on the bow, so the width is
  // the larger of the last column's edge and the furthest right any edge sample or label pill reaches, plus SIDE (room for
  // the arrowhead and the box's edge). Likewise the height, plus PAD below. The left and top never need room: every edge
  // and label lies between the query chip and the last column, below the headings.
  let [farX, farY] = [0, 0];
  for (const e of edges) {
    for (let k = 0; k <= SAMPLES; k++) {
      const p = cubicAt(e.path, k / SAMPLES);
      [farX, farY] = [Math.max(farX, p.x), Math.max(farY, p.y)];
    }
    if (e.label && (e.kind === "link" || e.kind === "back")) {
      const r = pillRect(e.label, LINK_LABEL_CHARS, PILL.labelH);
      [farX, farY] = [Math.max(farX, r.x + r.width), Math.max(farY, r.y + r.height)];
    }
  }
  return { width: Math.max(right, farX + SIDE), height: Math.max(HEADER + 2 * PAD + ROW * rows, farY + PAD), heads, nodes, edges };
}

// The rectangle of every node's click target (its chip), in node order.
export const hitRegions = (layout: NetLayout): (Rect & { id: string })[] => layout.nodes.map((n) => ({ id: n.id, ...n.hit }));
// The click target of every expand pill, for the step-1 nodes only.
export const expandRegions = (layout: NetLayout): (Rect & { id: string })[] =>
  layout.nodes.flatMap((n) => (n.expand ? [{ id: n.id, ...n.expand.hit }] : []));
