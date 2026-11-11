// The only value-to-pixel mapping for bars (ADR 0006): every bar length and the weak-evidence mark
// in the comparison strip go through `scale`, so there is no second mapping to drift. Values are fractions: identity
// 0 to 1, coverage may exceed 1. A coverage above 1 is drawn full length with `overflow` set; the printed number
// beside the bar stays exact. Overflow is judged at the displayed precision (3 decimals of the fraction, one decimal
// of the percentage), so a value printed as 100.0% never gets an overflow mark.
export const BAR_WIDTH = 200; // px, in the bar's own SVG coordinates

export function scale(value: number, width: number = BAR_WIDTH): { length: number; overflow: boolean } {
  return { length: Math.min(Math.max(value, 0), 1) * width, overflow: Math.round(value * 1000) > 1000 };
}
