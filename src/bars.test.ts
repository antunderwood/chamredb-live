import { describe, expect, it } from "vitest";
import { BAR_WIDTH, scale } from "./bars";

// Hand-worked pixels (tests/fixtures/README.md, "Bar scale"), W = 200 px. Not recomputed from scale().
describe("scale: the only value-to-pixel mapping for bars", () => {
  it("uses a 200 px bar", () => expect(BAR_WIDTH).toBe(200));
  const cases: [number, number, boolean][] = [
    [0, 0, false],
    [0.5, 100, false],
    [0.9, 180, false],
    [1.0, 200, false],
    [1.3, 200, true],
  ];
  for (const [value, length, overflow] of cases) {
    it(`${value} -> ${length} px${overflow ? ", overflow" : ""}`, () => {
      const s = scale(value, 200);
      expect(s.length).toBeCloseTo(length, 9);
      expect(s.overflow).toBe(overflow);
    });
  }
  it("never draws a negative length", () => expect(scale(-0.1, 200)).toEqual({ length: 0, overflow: false }));
});
