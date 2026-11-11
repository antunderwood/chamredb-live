import { useState } from "react";
import { isWeakGroup } from "./cardModel";
import { MatchPanel } from "./MatchPanel";
import { NetworkView } from "./NetworkView";
import { QueryPanel } from "./QueryPanel";
import type { Entry, Index, MatchGroup } from "./types";

// The results area under the slider: the query panel, the network picture in its own section, then one panel per
// match grouped by database. The picture and the panels are built from the same matches (matchGroups), so they list
// the same ones. `highlight` pairs a node with its card: hovering or focusing either lights up the other.
export function ResultPanels({
  index,
  query,
  groups,
  weakBelow,
  minIdentity,
  onNavigate,
}: {
  index: Index;
  query: Entry;
  groups: MatchGroup[];
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
    <>
      <QueryPanel entry={query} pair={pair(query.id)} />
      {groups.length > 0 && (
        <details open className="network-section mt-6 rounded-2xl bg-panel px-3 pb-3 pt-2 sm:px-4" data-testid="network-section">
          <summary className="cursor-pointer py-1 text-lg font-semibold">Network</summary>
          <NetworkView index={index} query={query} minIdentity={minIdentity} onNavigate={onNavigate} highlight={highlight} onHighlight={setHighlight} />
        </details>
      )}
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
    </>
  );
}
