import { isWeakGroup } from "./cardModel";
import { DATABASES, type Database, type Match, type MatchGroup } from "./types";

// The comparison strip as plain data (ADR 0006): one row per source database other than the query's, built from the
// same groups as the cards, so the strip and the cards cannot disagree. A database with no match at or above the
// minimum identity gets a "none" row: its absence is stated, never implied by leaving it out, together with how many
// of this entry's matches in that database the minimum identity hides (0: none at any identity in this release).
export type ComparisonRow =
  | { database: Database; kind: "match"; label: "best" | "highest"; top: Match[]; count: number }
  | { database: Database; kind: "none"; below: number };

// The weak-evidence sentence of a weak group (no full stop), one source for the strip and the side-by-side view.
export const weakGroupNote = (weakBelow: number): string => `Weak evidence: every match here is below ${Math.round(weakBelow * 100)}% identity`;

// `groups`: the matches at the current minimum identity; `allGroups`: the same entry's matches at minimum identity 0.
export function comparisonRows(queryDatabase: Database, groups: MatchGroup[], allGroups: MatchGroup[], weakBelow: number): ComparisonRow[] {
  return DATABASES.filter((d) => d !== queryDatabase).map((database): ComparisonRow => {
    const g = groups.find((x) => x.database === database);
    if (!g || g.matches.length === 0) {
      return { database, kind: "none", below: allGroups.find((x) => x.database === database)?.matches.length ?? 0 };
    }
    return {
      database,
      kind: "match",
      label: isWeakGroup(g, weakBelow) ? "highest" : "best", // below the weak line the top match is not called Best (ADR 0004)
      top: g.matches.filter((m) => m.best), // ties are all listed
      count: g.matches.length,
    };
  });
}
