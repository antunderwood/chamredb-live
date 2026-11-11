// The only value-to-pixel mapping for bars (ADR 0006): every bar length, the minimum identity line and the weak line
// in the comparison strip go through `scale`, so there is no second mapping to drift. Values are fractions: identity
// 0 to 1, coverage may exceed 1. A coverage above 1 is drawn full length with `overflow` set; the printed number
// beside the bar stays exact.
export const BAR_WIDTH = 200; // px, in the bar's own SVG coordinates

export function scale(value: number, width: number): { length: number; overflow: boolean } {
  return { length: Math.min(Math.max(value, 0), 1) * width, overflow: value > 1 };
}
