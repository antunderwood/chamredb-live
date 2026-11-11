import { BAR_WIDTH, scale } from "./bars";
import { cardDomId, matchDetails } from "./cardModel";
import { comparisonRows } from "./comparison";
import type { Database, Match, MatchGroup, MatchType } from "./types";

// At a glance (ADR 0006): one row per other source database, from the same groups as the cards. Every value is printed
// as text beside its bar; the bars, lines and glyphs only repeat it. All lengths come from scale() in bars.ts, and the
// printed values and labels come from matchDetails(), the same formatter as the cards.
const BAR_H = 12;
const LINE_OVERHANG = 3; // the two vertical lines stick out this far above and below the bar
const HALO = 5; // each line is drawn on a --surface halo this wide, so it reads against the bar fill and the track
const px = (n: number) => Math.round(n * 100) / 100; // attribute values without float noise (0.931 x 200 = 186.2)

function Line({ x, kind, h }: { x: number; kind: "min" | "weak"; h: number }) {
  return (
    <g data-line={kind} data-x={px(x)}>
      <line x1={px(x)} x2={px(x)} y1={0} y2={h} style={{ stroke: "var(--surface)", strokeWidth: HALO }} data-halo />
      <line
        x1={px(x)}
        x2={px(x)}
        y1={0}
        y2={h}
        style={kind === "weak" ? { stroke: "var(--danger)", strokeWidth: 2, strokeDasharray: "3 2" } : { stroke: "var(--fg)", strokeWidth: 2 }}
        data-stroke
      />
    </g>
  );
}

function Bar({ value, minIdentity, weakBelow, kind }: { value: number; minIdentity?: number; weakBelow?: number; kind: "identity" | "coverage" }) {
  const s = scale(value);
  const h = BAR_H + 2 * LINE_OVERHANG;
  return (
    <svg
      viewBox={`-3 0 ${BAR_WIDTH + 14} ${h}`}
      className="h-[18px] w-full max-w-[214px]"
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
      {/* The minimum identity line first, the dashed weak line on top, so both stay visible when they coincide. */}
      {minIdentity !== undefined && <Line x={scale(minIdentity).length} kind="min" h={h} />}
      {weakBelow !== undefined && <Line x={scale(weakBelow).length} kind="weak" h={h} />}
    </svg>
  );
}

// RBH: a two-headed arrow; OWH: a one-headed dashed arrow. Same encoding as the network picture; the text says it too.
function TypeGlyph({ type }: { type: MatchType }) {
  return (
    <svg viewBox="0 0 28 10" width="28" height="10" aria-hidden="true" focusable="false" className="shrink-0" data-glyph={type}>
      <line x1={type === "RBH" ? 6 : 1} x2={22} y1={5} y2={5} style={{ stroke: "var(--fg)", strokeWidth: 1.5, strokeDasharray: type === "OWH" ? "3 2" : undefined }} />
      <path d="M21,1 L27,5 L21,9 z" style={{ fill: "var(--fg)" }} />
      {type === "RBH" && <path d="M7,1 L1,5 L7,9 z" style={{ fill: "var(--fg)" }} />}
    </svg>
  );
}

const goToCard = (id: string) => {
  const card = document.getElementById(cardDomId(id));
  if (!card) return;
  card.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  card.focus({ preventScroll: true });
};

function TopMatch({ m, weak, database, minIdentity, weakBelow }: { m: Match; weak: boolean; database: Database; minIdentity: number; weakBelow: number }) {
  const d = matchDetails(m, weak);
  return (
    <div className="mt-3 first:mt-0" data-top={m.entry.id}>
      <button
        type="button"
        onClick={() => goToCard(m.entry.id)}
        className="w-fit text-left font-semibold underline decoration-label decoration-2 underline-offset-2 [overflow-wrap:anywhere]"
      >
        {m.entry.name} ({m.entry.id.slice(database.length + 1)})
        <span className="sr-only">, go to its card</span>
      </button>
      <dl className="mt-1 grid grid-cols-[5.5rem_minmax(0,1fr)_5.5rem] items-center gap-x-2 gap-y-1 text-sm">
        <dt className="text-muted">Identity</dt>
        <dd className="contents">
          <Bar value={m.identity} minIdentity={minIdentity} weakBelow={weakBelow} kind="identity" />
          <span className="tabular-nums" data-value="identity">{d.identity}</span>
        </dd>
        <dt className="text-muted">Coverage</dt>
        <dd className="contents">
          <Bar value={m.coverage} kind="coverage" />
          <span className="tabular-nums" data-value="coverage">
            {d.coverage}
            {scale(m.coverage).overflow && <span className="block text-xs text-muted" data-overflow-note>{" "}(over 100%)</span>}
          </span>
        </dd>
        <dt className="text-muted">Type</dt>
        <dd className="col-span-2 flex items-center gap-2" data-value="type">
          <TypeGlyph type={d.type} />
          {d.typeLabel}
        </dd>
      </dl>
    </div>
  );
}

export function ComparisonStrip({
  queryDatabase,
  groups,
  allGroups,
  minIdentity,
  weakBelow,
}: {
  queryDatabase: Database;
  groups: MatchGroup[]; // matches at the current minimum identity (the cards' groups)
  allGroups: MatchGroup[]; // the same entry's matches at minimum identity 0, for the hidden-below counts
  minIdentity: number; // fraction, the slider
  weakBelow: number; // fraction, the weak-evidence line
}) {
  const rows = comparisonRows(queryDatabase, groups, allGroups, weakBelow);
  const minPct = Math.round(minIdentity * 100);
  const weakPct = Math.round(weakBelow * 100);
  return (
    <section aria-labelledby="glance-title" className="mt-6 rounded-2xl bg-panel p-3 sm:p-4" data-testid="comparison">
      <h2 id="glance-title" className="text-lg font-semibold">At a glance</h2>
      <div className="mt-1 space-y-1 text-sm text-muted" data-testid="comparison-key">
        <p>Matches from this entry to each other database. Best: highest identity only; coverage and RBH or OWH are not considered.</p>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <svg viewBox="0 0 4 14" width="4" height="14" aria-hidden="true" focusable="false"><line x1={2} x2={2} y1={0} y2={14} style={{ stroke: "var(--fg)", strokeWidth: 2 }} /></svg>
            Minimum identity ({minPct}%)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg viewBox="0 0 4 14" width="4" height="14" aria-hidden="true" focusable="false"><line x1={2} x2={2} y1={0} y2={14} style={{ stroke: "var(--danger)", strokeWidth: 2, strokeDasharray: "3 2" }} /></svg>
            Weak evidence below {weakPct}% (a working default, not a validated cut-off)
          </span>
        </p>
      </div>
      <ul className="mt-3 grid gap-3 md:grid-cols-2">
        {rows.map((r) => (
          <li key={r.database} className="min-w-0 rounded-xl bg-surface p-3 shadow-card" data-db={r.database} data-kind={r.kind}>
            <h3 className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-chip-db px-2.5 py-0.5 text-base font-semibold text-chip-fg">{r.database}</span>
              {r.kind === "match" && (
                <span className="text-sm font-semibold" data-label={r.label}>
                  {r.label === "best" ? "Best" : "Highest identity shown"}
                  {r.top.length > 1 && ` (${r.top.length} tied)`}
                </span>
              )}
              {r.kind === "match" && (
                <span className="ml-auto text-sm text-muted" data-count={r.count}>
                  {r.count} {r.count === 1 ? "match" : "matches"} shown
                </span>
              )}
            </h3>
            {r.kind === "none" ? (
              <div className="mt-2" data-none data-below={r.below}>
                <p>No match at or above {minPct}% identity</p>
                <p className="mt-1 text-sm text-muted">
                  {r.below > 0
                    ? `${r.below} ${r.below === 1 ? "match" : "matches"} below ${minPct}% in this release's graph; lower the minimum identity to see ${r.below === 1 ? "it" : "them"}.`
                    : "No match from this entry at any identity in this release's graph; not evidence that no equivalent gene exists."}
                </p>
              </div>
            ) : (
              <div className="mt-2">
                {r.label === "highest" && (
                  <p className="mb-2 text-sm text-danger" data-weak-note>Weak evidence: every match here is below {weakPct}% identity.</p>
                )}
                {r.top.map((m) => (
                  <TopMatch key={m.entry.id} m={m} weak={r.label === "highest"} database={r.database} minIdentity={minIdentity} weakBelow={weakBelow} />
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
