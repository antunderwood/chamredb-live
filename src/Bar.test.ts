import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Bar } from "./Bar";

// Hand-worked pixels (tests/fixtures/README.md, "Bar scale"), bar width 200: the Bar component draws the fill exactly as long as
// scale() says, so the strip and the Match details cards (which share it) cannot disagree.
const html = (value: number, kind: "identity" | "coverage" = "identity", weakBelow?: number) => renderToStaticMarkup(createElement(Bar, { value, kind, weakBelow }));
const fill = (h: string) => Number(/<rect[^>]*width="([\d.]+)"[^>]*data-fill/.exec(h)![1]);

describe("Bar", () => {
  for (const [value, px] of [[0.97, 194], [0.9, 180], [1.0, 200], [1.05, 200], [0.5, 100]] as const) {
    it(`${value} is a ${px} px fill`, () => {
      const h = html(value);
      expect(fill(h)).toBeCloseTo(px, 9);
      expect(h).toContain(`data-length="${px}"`);
    });
  }
  it("marks coverage above 100% (1.05) and not coverage printed as 100.0% (1.0004)", () => {
    expect(html(1.05, "coverage")).toContain("data-overflow");
    expect(html(1.0004, "coverage")).not.toContain("data-overflow");
    expect(html(1, "coverage")).not.toContain("data-overflow");
  });
  it("draws the weak mark only when asked", () => {
    expect(html(0.97)).not.toContain("data-line");
    expect(html(0.97, "identity", 0.9)).toContain('data-line="weak"');
  });
});
