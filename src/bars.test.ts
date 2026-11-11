import { describe, expect, it } from "vitest";
import { BAR_WIDTH, scale } from "./bars";

// Hand-worked pixels (tests/fixtures/README.md, "Bar scale"), W = 200 px. Not recomputed from scale().
describe("scale: the only value-to-pixel mapping for bars", () => {
  it("uses a 200 px bar", () => expect(BAR_WIDTH).toBe(200));
  const cases: [number, number, boolean][] = [
    [0, 0, false], // 0 x 200 = 0
    [0.5, 100, false], // 0.5 x 200 = 100
    [0.9, 180, false], // 0.9 x 200 = 180: the weak line
    [1.0, 200, false], // 1.0 x 200 = 200
    [1.3, 200, true], // min(1.3, 1) x 200 = 200, and 1.3 > 1: overflow
  ];
  for (const [value, length, overflow] of cases) {
    it(`${value} -> ${length} px${overflow ? ", overflow" : ""}`, () => {
      const s = scale(value, 200);
      expect(s.length).toBeCloseTo(length, 9);
      expect(s.overflow).toBe(overflow);
    });
  }
  it("judges overflow at the displayed precision: 1.0004 prints 100.0% and has no mark; 1.0036 prints 100.4% and has one", () => {
    expect(scale(1.0004, 200).overflow).toBe(false); // round(1000.4) = 1000, not above 1000
    expect(scale(1.0036, 200).overflow).toBe(true); // round(1003.6) = 1004 > 1000 (card:ARO:3001305 to ncbi, real graph)
  });
  it("defaults to the 200 px bar", () => expect(scale(0.5).length).toBeCloseTo(100, 9));
  it("never draws a negative length", () => expect(scale(-0.1, 200)).toEqual({ length: 0, overflow: false }));
});
