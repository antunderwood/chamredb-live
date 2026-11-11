import type { ComparisonRow } from "./comparison";
import type { Database, Entry } from "./types";

// The phenotype side-by-side view as plain data (#24): the query's phenotype next to the phenotype of each best match, one
// column per source database, labelled with that database. Nothing is merged, normalised or mapped between databases: a
// column holds the entry's own stored phenotype and nothing else. Built from the comparison strip's rows, so the columns
// and the strip name the same matches. A database with no match shows that, never an empty or missing column.
export type SideColumn =
  | { kind: "entries"; database: Database; role: "query" | "best" | "highest"; entries: Entry[] }
  | { kind: "none"; database: Database; below: number };

export function sideBySide(query: Entry, rows: ComparisonRow[]): SideColumn[] {
  return [
    { kind: "entries", database: query.database, role: "query", entries: [query] },
    ...rows.map((r): SideColumn => (r.kind === "none" ? { kind: "none", database: r.database, below: r.below } : { kind: "entries", database: r.database, role: r.label, entries: r.top.map((m) => m.entry) })),
  ];
}
