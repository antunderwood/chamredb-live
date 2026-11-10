// Pure geometry for the network picture (ticket #11). `pixel` is the ONLY function that maps a slot to pixel
// coordinates; node centres, edge endpoints and label anchors all go through it, so there is no second mapping
// to drift. It works on internal slot numbers only and never converts conventions.
//
// Picture: the query in one column, its n shown matches in a second column, one row of ROW units each, with the
// query centred on the rows. "ltr" has the query on the left; "rtl" is the mirror image (x becomes WIDTH - x).

export type Orientation = "ltr" | "rtl";

export const WIDTH = 360;
export const ROW = 40; // vertical space per neighbour
export const PAD = 12; // space above the first and below the last row
export const QUERY_X = 60; // column centres, measured in the ltr orientation
export const NEIGHBOUR_X = 156;
export const CLEARANCE = 13; // an edge stops this far from a node centre, leaving room for the arrowhead
export const LABEL_GAP = 14; // label anchor distance from the neighbour centre, towards the free side
export const QUERY_LABEL_RISE = 16; // query label baseline sits this far above the query centre

export interface Point {
  x: number;
  y: number;
}
export interface Slot {
  centre: Point;
  edge: { from: Point; to: Point }; // from the query's edge to this neighbour's edge, clear of both nodes
  label: Point; // anchor of the neighbour's label
  anchor: "start" | "end"; // text-anchor for that label
}
export interface Layout {
  width: number;
  height: number;
  query: { centre: Point; label: Point };
  neighbours: Slot[];
}

// The single position-to-pixel function. column: which column; row: row number, fractional for the query,
// which sits at (n - 1) / 2.
export function pixel(column: "query" | "neighbour", row: number, orientation: Orientation): Point {
  const x = column === "query" ? QUERY_X : NEIGHBOUR_X;
  return { x: orientation === "ltr" ? x : WIDTH - x, y: PAD + ROW * row + ROW / 2 };
}

export function layout(n: number, orientation: Orientation): Layout {
  const q = pixel("query", (n - 1) / 2, orientation);
  const side = orientation === "ltr" ? 1 : -1; // direction from a neighbour to its label
  const neighbours: Slot[] = Array.from({ length: n }, (_, i) => {
    const c = pixel("neighbour", i, orientation);
    const len = Math.hypot(c.x - q.x, c.y - q.y);
    const ux = (c.x - q.x) / len;
    const uy = (c.y - q.y) / len;
    return {
      centre: c,
      edge: {
        from: { x: q.x + ux * CLEARANCE, y: q.y + uy * CLEARANCE },
        to: { x: c.x - ux * CLEARANCE, y: c.y - uy * CLEARANCE },
      },
      label: { x: c.x + side * LABEL_GAP, y: c.y },
      anchor: orientation === "ltr" ? "start" : "end",
    };
  });
  return {
    width: WIDTH,
    height: 2 * PAD + ROW * Math.max(n, 1),
    query: { centre: q, label: { x: q.x, y: q.y - QUERY_LABEL_RISE } },
    neighbours,
  };
}

// Label text cut to at most `max` characters, ending in an ellipsis when cut (full text goes in the node title).
export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
