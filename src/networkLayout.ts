// Pure geometry for the interactive network (tickets #9 and #10). `pixel` is the ONLY function that maps a slot to
// pixel coordinates: node centres, edge endpoints, label anchors, tooltip anchors and hit regions all go through
// it, so there is no second mapping to drift. It works on internal slot numbers only (column, row), never on ids.
// src/layout.ts is the older, smaller picture and is not used here.
//
// Three columns, left to right: the query (column 0), its shown matches (column 1) and, when an entry is
// expanded, the matches of those matches (column 2). A column of k nodes is centred on the tallest column. The
// viewBox is computed from the content, so a picture with no step-2 nodes is narrower. Derivation: docs/network-layout.md.
import type { NetEdge, NetNode, Network } from "./networkModel";

export const ROW = 56; // vertical space per node: the 48 unit hit target plus an 8 unit gap
export const PAD = 16; // space above the first and below the last row
export const MARGIN_X = 96; // column 0 centre, and the space right of the last column's centre (room for a 24 character label)
export const COL_GAP = 192; // distance between column centres
export const CLEARANCE = 20; // an edge stops this far from a node centre: node radius 16 plus room for the arrowhead
export const LABEL_RISE = 24; // label baseline sits this far above the node centre, anchored at its middle
export const HIT = 48; // side of the square click target, at least 44 CSS pixels when the picture is drawn at its own width
export const BOW = 42; // a same-column edge bows out this far to the right

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
export interface NodeSlot {
  id: string;
  centre: Point;
  label: Point; // text-anchor middle
  tooltip: Point; // middle of the bottom edge of the hit region
  hit: Rect;
}
export interface EdgeSlot {
  source: string;
  target: string;
  step: 1 | 2;
  from: Point; // cut CLEARANCE from the source centre
  to: Point; // cut CLEARANCE from the target centre
  control?: Point; // same-column edges only: a quadratic curve control point (the ends are cut along the line to it)
}
export interface NetLayout {
  width: number;
  height: number;
  nodes: NodeSlot[]; // in the order of network.nodes
  edges: EdgeSlot[]; // in the order of network.edges
}

// The single position-to-pixel function. column: 0 query, 1 matches, 2 step-2; row: 0 to count - 1 within the
// column; count: nodes in this column; rows: nodes in the tallest column. Row centre y = PAD + ROW * ((rows - count) / 2 + row) + ROW / 2.
export function pixel(column: 0 | 1 | 2, row: number, count: number, rows: number): Point {
  return { x: MARGIN_X + COL_GAP * column, y: PAD + ROW * ((rows - count) / 2 + row) + ROW / 2 };
}

const COLUMN = { query: 0, match: 1, step2: 2 } as const;

// A point `distance` from `a` towards `b`.
const towards = (a: Point, b: Point, distance: number): Point => {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  return { x: a.x + ((b.x - a.x) / len) * distance, y: a.y + ((b.y - a.y) / len) * distance };
};

export function layoutNetwork(network: Pick<Network, "nodes" | "edges">): NetLayout {
  const counts = [0, 0, 0];
  for (const n of network.nodes) counts[COLUMN[n.role]]!++;
  const rows = Math.max(1, ...counts);
  const seen = [0, 0, 0];
  const nodes: NodeSlot[] = network.nodes.map((n: NetNode) => {
    const column = COLUMN[n.role];
    const c = pixel(column, seen[column]!++, counts[column]!, rows);
    return {
      id: n.id,
      centre: c,
      label: { x: c.x, y: c.y - LABEL_RISE },
      tooltip: { x: c.x, y: c.y + HIT / 2 },
      hit: { x: c.x - HIT / 2, y: c.y - HIT / 2, width: HIT, height: HIT },
    };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges = network.edges.map((e: NetEdge): EdgeSlot => {
    const a = byId.get(e.source)?.centre;
    const b = byId.get(e.target)?.centre;
    if (!a || !b) throw new Error(`Edge ${e.source} -> ${e.target}: endpoint is not a node`);
    const control = a.x === b.x ? { x: a.x + BOW, y: (a.y + b.y) / 2 } : undefined;
    const aim = control ?? b;
    return {
      source: e.source,
      target: e.target,
      step: e.step,
      from: towards(a, aim, CLEARANCE),
      to: towards(b, control ?? a, CLEARANCE),
      ...(control && { control }),
    };
  });
  const last = counts[2]! > 0 ? 2 : counts[1]! > 0 ? 1 : 0;
  return { width: pixel(last, 0, 1, 1).x + MARGIN_X, height: 2 * PAD + ROW * rows, nodes, edges };
}

// The rectangle of every node's invisible click target, in node order, for the UI to place over the node.
export const hitRegions = (layout: NetLayout): (Rect & { id: string })[] => layout.nodes.map((n) => ({ id: n.id, ...n.hit }));
