import { isWeakGroup } from "./cardModel";
import { ComparisonStrip } from "./ComparisonStrip";
import { MatchPanel } from "./MatchPanel";
import { NetworkView } from "./NetworkView";
import { QueryPanel } from "./QueryPanel";
import type { Entry, MatchGroup } from "./types";

// The results area under the slider: the at-a-glance comparison strip (ADR 0006), the query panel, the network picture in its own section, then one panel per
// match grouped by database. The picture and the panels are built from the same groups, so they list the same matches.
export function ResultPanels({
  query,
  groups,
  allGroups,
  minIdentity,
  weakBelow,
}: {
  query: Entry;
  groups: MatchGroup[];
  allGroups: MatchGroup[]; // the same entry at minimum identity 0, for the strip's hidden-below counts
  minIdentity: number;
  weakBelow: number;
}) {
  return (
    <>
      <ComparisonStrip queryDatabase={query.database} groups={groups} allGroups={allGroups} minIdentity={minIdentity} weakBelow={weakBelow} />
      <QueryPanel entry={query} />
      {groups.length > 0 && (
        <details open className="mt-6 rounded-2xl bg-panel px-3 pb-3 pt-2 sm:px-4" data-testid="network-section">
          <summary className="cursor-pointer py-1 text-lg font-semibold">Network</summary>
          <NetworkView query={query} groups={groups} weakBelow={weakBelow} />
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
                <MatchPanel key={m.entry.id} match={m} native={m.entry.id.slice(g.database.length + 1)} weak={weak} weakBelow={weakBelow} />
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
