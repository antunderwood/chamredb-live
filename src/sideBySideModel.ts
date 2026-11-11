import { matchDetails } from "./cardModel";
import { weakGroupNote, type ComparisonRow } from "./comparison";
import type { Database, Entry } from "./types";

// The phenotype side-by-side view as plain data (#24): the query's phenotype next to the phenotype of each best match, one
// column per source database, labelled with that database. Nothing is merged, normalised or mapped between databases: a
// column holds the entry's own stored phenotype and nothing else. Built from the comparison strip's rows, so the columns
// and the strip name the same matches. A database with no match shows that, never an empty or missing column.
//
// Each match entry also carries its evidence (identity, coverage, RBH or OWH) from matchDetails(), the cards' formatter; a
// weak column says so with the strip's sentence; and a database with more matches than shown says how many more. The query
// column carries none of these (it is not a match).
export type SideColumn =
  | {
      kind: "entries";
      database: Database;
      role: "query" | "best" | "highest";
      entries: Entry[];
      evidence: string[]; // one per entry, same order; empty for the query
      weakNote: string | null; // set when role is "highest"
      more: string | null; // set when the database has matches not shown in this column
    }
  | { kind: "none"; database: Database; below: number };

const WORKING_DEFAULT = "a working default, not a validated cut-off";
const moreText = (n: number) => `+${n} more ${n === 1 ? "match" : "matches"} in this database, see the cards`;

export function sideBySide(query: Entry, rows: ComparisonRow[], weakBelow: number): SideColumn[] {
  return [
    { kind: "entries", database: query.database, role: "query", entries: [query], evidence: [], weakNote: null, more: null },
    ...rows.map((r): SideColumn => {
      if (r.kind === "none") return { kind: "none", database: r.database, below: r.below };
      const weak = r.label === "highest";
      const notShown = r.count - r.top.length;
      return {
        kind: "entries",
        database: r.database,
        role: r.label,
        entries: r.top.map((m) => m.entry),
        evidence: r.top.map((m) => {
          const d = matchDetails(m, weak);
          return `Identity ${d.identity}, coverage ${d.coverage}, ${d.typeLabel} (${d.type})`;
        }),
        weakNote: weak ? `${weakGroupNote(weakBelow)} (${WORKING_DEFAULT}).` : null,
        more: notShown > 0 ? moreText(notShown) : null,
      };
    }),
  ];
}
