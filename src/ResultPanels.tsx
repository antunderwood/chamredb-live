import { useState } from "react";
import { isWeakGroup } from "./cardModel";
import { ComparisonStrip } from "./ComparisonStrip";
import { MatchPanel } from "./MatchPanel";
import { NetworkView } from "./NetworkView";
import { QueryPanel } from "./QueryPanel";
import type { Entry, Index, MatchGroup } from "./types";

// The results area under the slider (ADR 0006, #25). From 1024 px two columns: a sticky left rail with the at-a-glance
// comparison strip and the network picture, and on the right the query panel then one panel per match grouped by
// database. Below 1024 px the same DOM order is one column: strip, network, query panel, cards. DOM order is the
// reading and Tab order at every width; CSS never reorders it. The picture and the panels are built from the same matches (matchGroups), so they list
// the same ones. `highlight` pairs a node with its card: hovering or focusing either lights up the other.
export function ResultPanels({
  index,
  query,
  groups,
  allGroups,
  weakBelow,
  minIdentity,
  onNavigate,
}: {
  index: Index;
  query: Entry;
  groups: MatchGroup[];
  allGroups: MatchGroup[]; // the same entry at minimum identity 0, for the strip's hidden-below counts
  weakBelow: number;
  minIdentity: number;
  onNavigate: (id: string) => void;
}) {
  const [highlight, setHighlight] = useState<string | null>(null);
  const pair = (id: string) => ({
    "data-hl": highlight === id ? "true" : undefined,
    onMouseEnter: () => setHighlight(id),
    onMouseLeave: () => setHighlight(null),
    onFocus: () => setHighlight(id),
    onBlur: () => setHighlight(null),
  });
  return (
    <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,43rem)_minmax(0,1fr)] lg:items-start lg:gap-6" data-testid="results">
      {/* The rail: sticky from 1024 px and never taller than the window, so the network stays beside the cards it pairs
          with; when its content is taller it scrolls on its own. Its buttons and the network's scroll box are its Tab stops. */}
      <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:overscroll-contain" data-testid="results-rail">
        <ComparisonStrip queryDatabase={query.database} groups={groups} allGroups={allGroups} minIdentity={minIdentity} weakBelow={weakBelow} />
        {groups.length > 0 && (
          <details open className="network-section mt-6 rounded-2xl bg-panel px-3 pb-3 pt-2 sm:px-4" data-testid="network-section">
            <summary className="cursor-pointer py-1 text-lg font-semibold">Network</summary>
            <NetworkView index={index} query={query} minIdentity={minIdentity} onNavigate={onNavigate} highlight={highlight} onHighlight={setHighlight} />
          </details>
        )}
      </div>
      {/* A size container: the cards lay out their inner panels by the width of this column, not of the window (#25). */}
      <div className="@container min-w-0" data-testid="results-detail">
      <QueryPanel entry={query} pair={pair(query.id)} />
      {groups.map((g) => {
        // Below the weak line the top match is weak evidence of equivalence (ADR 0004): do not call it Best.
        const weak = isWeakGroup(g, weakBelow);
        return (
          <section key={g.database} aria-label={`Matches in ${g.database}`} className="mt-6">
            <h2 className="inline-block rounded-md bg-chip-db px-2.5 py-0.5 text-base font-semibold text-chip-fg">{g.database}</h2>
            {weak && (
              <p className="mt-2 text-sm text-danger">
                Weak evidence: every match here is below {Math.round(weakBelow * 100)}% identity (a working default taken from the earlier
                site, not a validated cut-off). The highest identity is marked, but it ignores coverage and the match type.
              </p>
            )}
            <ul className="mt-3 space-y-4">
              {g.matches.map((m) => (
                <MatchPanel key={m.entry.id} match={m} native={m.entry.id.slice(g.database.length + 1)} weak={weak} weakBelow={weakBelow} pair={pair(m.entry.id)} />
              ))}
            </ul>
          </section>
        );
      })}
      </div>
    </div>
  );
}
