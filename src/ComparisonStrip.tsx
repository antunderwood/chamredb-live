import { Bar, VIEW_W } from "./Bar";
import { scale } from "./bars";
import { cardDomId, matchDetails } from "./cardModel";
import { comparisonRows } from "./comparison";
import type { Database, Match, MatchGroup, MatchType } from "./types";

// At a glance (ADR 0006): one row per other source database, from the same groups as the cards. Every value is printed
// as text beside its bar; the bars, the 90% mark and glyphs only repeat it. All lengths come from scale() in bars.ts, and the
// printed values and labels come from matchDetails(), the same formatter as the cards.
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

function TopMatch({ m, weak, database, weakBelow }: { m: Match; weak: boolean; database: Database; weakBelow: number }) {
  const d = matchDetails(m, weak);
  return (
    <div className="mt-3 border-t border-border pt-3 first-of-type:mt-0 first-of-type:border-t-0 first-of-type:pt-0" data-top={m.entry.id}>
      <button
        type="button"
        onClick={() => goToCard(m.entry.id)}
        className="w-fit text-left font-semibold underline decoration-label decoration-2 underline-offset-2 [overflow-wrap:anywhere]"
      >
        {m.entry.name} ({m.entry.id.slice(database.length + 1)})
        <span className="sr-only">, go to its card</span>
      </button>
      {/* The bar column is capped at the bar's drawn width (VIEW_W, the same cap as Bar), so the printed value sits next to
          its bar rather than at the far edge of a wide row. */}
      <dl className="mt-1 grid items-center gap-x-2 gap-y-1 text-sm" style={{ gridTemplateColumns: `4.5rem minmax(0, ${VIEW_W}px) 4.75rem` }}>
        <dt className="text-muted">Identity</dt>
        <dd className="contents">
          <Bar value={m.identity} weakBelow={weakBelow} kind="identity" />
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
    <section aria-labelledby="glance-title" className="rounded-2xl bg-panel p-3 sm:p-4" data-testid="comparison">
      <h2 id="glance-title" className="text-lg font-semibold">At a glance</h2>
      <div className="mt-1 space-y-1 text-sm text-muted" data-testid="comparison-key">
        <p>Matches from this entry to each other database. Best: highest identity only; coverage and RBH or OWH are not considered.</p>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-start gap-2" data-key="weak">
            <svg viewBox="0 0 4 14" width="4" height="14" aria-hidden="true" focusable="false" className="mt-[3px] shrink-0"><line x1={2} x2={2} y1={0} y2={14} style={{ stroke: "var(--danger)", strokeWidth: 2, strokeDasharray: "3 2" }} /></svg>
            {weakPct}% mark: identity below it is weak evidence (a working default, not a validated cut-off). It does not hide anything.
          </span>
        </p>
        <p data-key="min">Only matches at or above the minimum identity ({minPct}%) are shown.</p>
      </div>
      <ul className="mt-3 grid gap-3 @2xl:grid-cols-2">
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
            </h3>
            {/* The count has its own line under the heading, so every row reads the same whether or not the label wraps. */}
            {r.kind === "match" && (
              <p className="mt-1 text-sm text-muted" data-count={r.count}>
                {r.count} {r.count === 1 ? "match" : "matches"} shown
              </p>
            )}
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
                  <TopMatch key={m.entry.id} m={m} weak={r.label === "highest"} database={r.database} weakBelow={weakBelow} />
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
