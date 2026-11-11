import { BAR_WIDTH, scale } from "./bars";

// The bar drawn next to a printed percentage, in the comparison strip and in the Match details card (ADR 0006). Every
// length goes through scale() in bars.ts; the printed number beside it stays the exact value, so the bar only repeats it.
const BAR_H = 12;
const LINE_OVERHANG = 3; // the two vertical lines stick out this far above and below the bar
const HALO = 5; // each line is drawn on a --surface halo this wide, so it reads against the bar fill and the track
const px = (n: number) => Math.round(n * 100) / 100; // attribute values without float noise (0.931 x 200 = 186.2)

// The weak-evidence mark (ADR 0006, decision 2026-11-11): one dashed line at 90% on the identity bar, labelled above it
// in HTML text so the label stays readable however narrow the bar is drawn. It is an interpretation, not a filter; the
// minimum identity slider decides what is shown, so the minimum identity is not drawn on the bars.
const VIEW_X0 = -3; // the viewBox starts left of 0 so the track outline and line halos are not clipped
export const VIEW_W = BAR_WIDTH + 14; // room for the overflow chevron
function WeakLine({ x, h }: { x: number; h: number }) {
  return (
    <g data-line="weak" data-x={px(x)}>
      <line x1={px(x)} x2={px(x)} y1={0} y2={h} style={{ stroke: "var(--surface)", strokeWidth: HALO }} data-halo />
      <line x1={px(x)} x2={px(x)} y1={0} y2={h} style={{ stroke: "var(--danger)", strokeWidth: 2, strokeDasharray: "3 2" }} data-stroke />
    </g>
  );
}

export function Bar({ value, weakBelow, kind }: { value: number; weakBelow?: number; kind: "identity" | "coverage" }) {
  const s = scale(value);
  const h = BAR_H + 2 * LINE_OVERHANG;
  const weakX = weakBelow !== undefined ? scale(weakBelow).length : undefined;
  return (
    <div className={`relative w-full ${weakX !== undefined ? "pt-4" : ""}`} style={{ maxWidth: VIEW_W }}>
      {weakX !== undefined && (
        <span
          className="absolute top-0 -translate-x-1/2 text-xs leading-none font-semibold text-danger"
          style={{ left: `${px(((weakX - VIEW_X0) / VIEW_W) * 100)}%` }}
          aria-hidden="true"
          data-mark-label
          data-x={px(weakX)}
        >
          {Math.round(weakBelow! * 100)}%
        </span>
      )}
      <svg
        viewBox={`${VIEW_X0} 0 ${VIEW_W} ${h}`}
        className="block h-[18px] w-full"
        aria-hidden="true"
        focusable="false"
        data-bar={kind}
        data-length={px(s.length)}
      >
        <rect x={0} y={LINE_OVERHANG} width={BAR_WIDTH} height={BAR_H} rx={2} style={{ fill: "var(--panel)", stroke: "var(--control-border)" }} data-track />
        <rect x={0} y={LINE_OVERHANG} width={px(s.length)} height={BAR_H} rx={2} style={{ fill: "var(--label)" }} data-fill />
        {s.overflow && (
          // coverage above 100%: a chevron past the end of the full bar
          <path d={`M${BAR_WIDTH + 3},${LINE_OVERHANG} L${BAR_WIDTH + 9},${h / 2} L${BAR_WIDTH + 3},${h - LINE_OVERHANG}`} style={{ fill: "none", stroke: "var(--fg)", strokeWidth: 2 }} data-overflow />
        )}
        {weakX !== undefined && <WeakLine x={weakX} h={h} />}
      </svg>
    </div>
  );
}

