import { isWeakGroup } from "./cardModel";
import { DATABASES, type Database, type Match, type MatchGroup } from "./types";

// The comparison strip as plain data (ADR 0006): one row per source database other than the query's, built from the
// same groups as the cards, so the strip and the cards cannot disagree. A database with no match at or above the
// minimum identity gets a "none" row: its absence is stated, never implied by leaving it out.
export type ComparisonRow =
  | { database: Database; kind: "match"; label: "best" | "highest"; top: Match[]; count: number }
  | { database: Database; kind: "none" };

export function comparisonRows(queryDatabase: Database, groups: MatchGroup[], weakBelow: number): ComparisonRow[] {
  return DATABASES.filter((d) => d !== queryDatabase).map((database): ComparisonRow => {
    const g = groups.find((x) => x.database === database);
    if (!g || g.matches.length === 0) return { database, kind: "none" };
    return {
      database,
      kind: "match",
      label: isWeakGroup(g, weakBelow) ? "highest" : "best", // below the weak line the top match is not called Best (ADR 0004)
      top: g.matches.filter((m) => m.best), // ties are all listed
      count: g.matches.length,
    };
  });
}
