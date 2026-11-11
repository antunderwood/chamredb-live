import { Chip, ChipRow, PhenotypeBody } from "./Cards";
import { comparisonRows } from "./comparison";
import { sideBySide } from "./sideBySideModel";
import type { Entry, MatchGroup } from "./types";

const ROLE = { query: "Query", best: "Best match", highest: "Highest identity shown" } as const;

// Phenotypes side by side (#24): one column per source database, the query's first, each entry's phenotype verbatim as in
// its own card. Nothing is compared for the reader: no shared-term highlighting (owner decision on #18), no mapping between
// the databases' wording. Shown only when at least one other database has a match; the strip says the rest.
export function SideBySide({ query, groups, allGroups, weakBelow, minIdentity }: { query: Entry; groups: MatchGroup[]; allGroups: MatchGroup[]; weakBelow: number; minIdentity: number }) {
  const cols = sideBySide(query, comparisonRows(query.database, groups, allGroups, weakBelow));
  if (!cols.some((c) => c.kind === "entries" && c.role !== "query")) return null;
  return (
    <section aria-label="Phenotypes side by side" className="mt-6 rounded-2xl bg-panel p-3 sm:p-4" data-testid="side-by-side">
      <h2 className="mb-3 text-lg font-semibold">Phenotypes side by side</h2>
      <div className="grid gap-3 @xl:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))]">
        {cols.map((c) => (
          <div key={c.database} className="min-w-0 rounded-xl bg-surface p-3 shadow-card" data-side-col={c.database}>
            {c.kind === "none" ? (
              <>
                <h3 className="mb-2"><ChipRow><Chip kind="db">{c.database}</Chip></ChipRow></h3>
                <p data-side-none>
                  No match at or above {Math.round(minIdentity * 100)}% identity
                  {c.below > 0 ? `; ${c.below} below` : ""}.
                </p>
              </>
            ) : (
              c.entries.map((e) => (
                <div key={e.id} className="mt-3 first:mt-0" data-side-entry={e.id}>
                  <h3 className="mb-2">
                    <ChipRow>
                      <Chip kind={c.role === "query" ? "query" : "match"}>{ROLE[c.role]}</Chip> <Chip kind="db">{e.database}</Chip> <Chip kind="name">{e.name}</Chip>
                    </ChipRow>
                  </h3>
                  <PhenotypeBody entry={e} of={c.role === "query" ? "query" : "match"} view="side" />
                </div>
              ))
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
