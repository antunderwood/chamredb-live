import { describe, expect, it } from "vitest";
import { layout, truncate } from "./layout";

// Expected pixels worked by hand (see docs/network-view.md). Constants: WIDTH 360, ROW 40, PAD 12,
// QUERY_X 60, NEIGHBOUR_X 156, CLEARANCE 13, LABEL_GAP 14, query label 16 above its centre.
//
// n = 3, orientation ltr. Height = 2*12 + 40*3 = 144. Row y centre = 12 + 40*row + 20 = 32 + 40*row.
//   Query is on row (3-1)/2 = 1, so (60, 72). Neighbours at x 156, rows 0, 1, 2: y = 32, 72, 112.
//   FIRST neighbour: centre (156, 32). Label anchor (156+14, 32) = (170, 32), anchor start.
//   LAST neighbour: centre (156, 112). Edge vector from the query (96, 40), length sqrt(9216+1600) = 104
//   (a 5-12-13 triangle scaled by 8), unit (12/13, 5/13). Clearance 13 gives an offset of (12, 5).
//   Edge from (60+12, 72+5) = (72, 77) to (156-12, 112-5) = (144, 107). Label (170, 112).
//   MIDDLE neighbour is level with the query: edge from (73, 72) to (143, 72).
//   Query label: (60, 72-16) = (60, 56).
// MIRROR (rtl): x becomes 360 - x, y unchanged. Query (300, 72). First neighbour (204, 32), label
//   (204-14, 32) = (190, 32), anchor end. Last neighbour (204, 112), edge from (300-12, 77) = (288, 77) to
//   (204+12, 107) = (216, 107), label (190, 112).
// n = 1: height 2*12 + 40 = 64, query (60, 32), neighbour (156, 32), edge (73, 32) to (143, 32).
describe("layout: hand-worked pixels", () => {
  it("n=3 ltr: first neighbour, last neighbour, query", () => {
    const l = layout(3, "ltr");
    expect(l.width).toBe(360);
    expect(l.height).toBe(144);
    expect(l.query.centre).toEqual({ x: 60, y: 72 });
    expect(l.query.label).toEqual({ x: 60, y: 56 });
    expect(l.neighbours[0]!.centre).toEqual({ x: 156, y: 32 });
    expect(l.neighbours[0]!.label).toEqual({ x: 170, y: 32 });
    expect(l.neighbours[0]!.anchor).toBe("start");
    const last = l.neighbours[2]!;
    expect(last.centre).toEqual({ x: 156, y: 112 });
    expect(last.label).toEqual({ x: 170, y: 112 });
    expect(last.edge.from.x).toBeCloseTo(72, 9);
    expect(last.edge.from.y).toBeCloseTo(77, 9);
    expect(last.edge.to.x).toBeCloseTo(144, 9);
    expect(last.edge.to.y).toBeCloseTo(107, 9);
    expect(l.neighbours[1]!.edge.from).toEqual({ x: 73, y: 72 });
    expect(l.neighbours[1]!.edge.to).toEqual({ x: 143, y: 72 });
  });

  it("n=3 rtl is the mirror: x becomes 360 - x, y unchanged", () => {
    const l = layout(3, "rtl");
    expect(l.query.centre).toEqual({ x: 300, y: 72 });
    expect(l.neighbours[0]!.centre).toEqual({ x: 204, y: 32 });
    expect(l.neighbours[0]!.label).toEqual({ x: 190, y: 32 });
    expect(l.neighbours[0]!.anchor).toBe("end");
    const last = l.neighbours[2]!;
    expect(last.centre).toEqual({ x: 204, y: 112 });
    expect(last.label).toEqual({ x: 190, y: 112 });
    expect(last.edge.from.x).toBeCloseTo(288, 9);
    expect(last.edge.from.y).toBeCloseTo(77, 9);
    expect(last.edge.to.x).toBeCloseTo(216, 9);
    expect(last.edge.to.y).toBeCloseTo(107, 9);
  });

  it("n=1: a single neighbour is level with the query", () => {
    const l = layout(1, "ltr");
    expect(l.height).toBe(64);
    expect(l.query.centre).toEqual({ x: 60, y: 32 });
    expect(l.neighbours[0]!.centre).toEqual({ x: 156, y: 32 });
    expect(l.neighbours[0]!.edge).toEqual({ from: { x: 73, y: 32 }, to: { x: 143, y: 32 } });
  });

  // n = 6 (the maximum out-degree): height 2*12 + 40*6 = 264; query row 2.5, y = 32 + 40*2.5 = 132;
  // first neighbour y = 32, last (row 5) y = 32 + 200 = 232.
  it("n=6: height and the centred query", () => {
    const l = layout(6, "ltr");
    expect(l.height).toBe(264);
    expect(l.query.centre).toEqual({ x: 60, y: 132 });
    expect(l.neighbours[0]!.centre).toEqual({ x: 156, y: 32 });
    expect(l.neighbours[5]!.centre).toEqual({ x: 156, y: 232 });
  });

  it("n=0 has no neighbours and a drawable height", () => {
    const l = layout(0, "ltr");
    expect(l.neighbours).toEqual([]);
    expect(l.height).toBe(64);
  });
});

describe("truncate", () => {
  it("keeps short text and cuts long text to the limit with an ellipsis", () => {
    expect(truncate("ncbi WP_1.1", 24)).toBe("ncbi WP_1.1");
    expect(truncate("abcdefghij", 5)).toBe("abcd…");
  });
});
