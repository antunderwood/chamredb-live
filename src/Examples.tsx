import { useMemo } from "react";
import { findEntries } from "./query";
import type { Index } from "./types";

// Example searches for the real release. Each one is shown only if it finds exactly the entries listed in `ids` in
// the loaded data, so a retired example never appears as a dead button and the hand-written test graph shows none.
// Checked against data/graph.json (graph-2026.11.09) and again by tests/examples.spec.ts on the release build.
export interface Example {
  query: string;
  ids: string[]; // entry ids the search must find, in the order findEntries lists them
  note: string; // what the example demonstrates, shown under the button
}

export const EXAMPLES: Example[] = [
  { query: "card:ARO:3000230", ids: ["card:ARO:3000230"], note: "A CARD entry with one match in each of the other two databases." },
  { query: "ncbi:WP_012695489.1", ids: ["ncbi:WP_012695489.1"], note: "An NCBI entry, searched by its id." },
  { query: "resfinder:blaNDM-1", ids: ["resfinder:blaNDM-1"], note: "A ResFinder entry, with matches in CARD and NCBI." },
  {
    query: "tet(M)",
    ids: ["card:ARO:3000186", "ncbi:WP_063856115.1", "resfinder:tet(M)"],
    note: "A name used in all three databases: you choose which entry you mean.",
  },
];

export function availableExamples(index: Index, examples: Example[] = EXAMPLES): Example[] {
  return examples.filter((ex) => {
    const found = findEntries(index, ex.query).map((c) => c.id);
    return found.length === ex.ids.length && ex.ids.every((id) => found.includes(id));
  });
}

// `compact`: once a result is shown the example cards shrink to one row of small chips, so the results start higher (#26).
export function Examples({ index, onPick, compact = false }: { index: Index | null; onPick: (query: string) => void; compact?: boolean }) {
  const shown = useMemo(() => (index ? availableExamples(index) : []), [index]);
  if (shown.length === 0) return null;
  if (compact) {
    return (
      <section aria-labelledby="examples-heading" className="mt-3 flex items-center gap-x-2" data-examples="compact">
        <h2 id="examples-heading" className="shrink-0 text-xs font-medium text-muted">Examples:</h2>
        {/* One row: at phone width the chips scroll sideways inside this list, not the page. */}
        <ul className="relative flex min-w-0 gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
          {shown.map((ex, i) => (
            <li key={ex.query} className="shrink-0">
              <button
                type="button"
                onClick={() => onPick(ex.query)}
                aria-label={`Example: ${ex.query}`}
                aria-describedby={`ex-note-${i}`}
                title={ex.note}
                className="example-button whitespace-nowrap rounded-full border border-control-border px-2.5 py-0.5 text-xs"
              >
                {ex.query}
              </button>
              <span id={`ex-note-${i}`} className="sr-only">{ex.note}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  }
  return (
    <section aria-labelledby="examples-heading" className="mt-4" data-examples="cards">
      <h2 id="examples-heading" className="text-sm font-medium">Some examples to try</h2>
      <ul className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {shown.map((ex, i) => (
          <li key={ex.query} className="flex">
            <button
              type="button"
              onClick={() => onPick(ex.query)}
              aria-label={`Example: ${ex.query}`}
              aria-describedby={`ex-note-${i}`}
              className="example-button w-full rounded-lg border border-control-border px-2.5 py-2 text-left"
            >
              <span className="block break-words text-xs font-medium sm:text-sm lg:text-xs min-[1500px]:text-sm">{ex.query}</span>
              <span id={`ex-note-${i}`} className="mt-1 block text-xs text-muted">{ex.note}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
