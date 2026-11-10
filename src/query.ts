import type { Candidate, Database, Index, Match, MatchedOn, MatchGroup } from "./types";

// Identity is compared at 3 decimals of the fraction, the displayed precision (data contract).
const q = (fraction: number) => Math.round(fraction * 1000);

const PRIORITY: MatchedOn[] = ["id", "name", "alternative id", "duplicate allele id"];

// Search text to {entry id: best way it identifies that entry}. Built once per index; an Index is never mutated
// after buildIndex, so there is no invalidation.
const tables = new WeakMap<Index, Map<string, Map<string, MatchedOn>>>();
function table(index: Index) {
  const cached = tables.get(index);
  if (cached) return cached;
  const built = new Map<string, Map<string, MatchedOn>>();
  const add = (text: string, entryId: string, how: MatchedOn) => {
    const hits = built.get(text) ?? new Map<string, MatchedOn>();
    const seen = hits.get(entryId);
    if (!seen || PRIORITY.indexOf(how) < PRIORITY.indexOf(seen)) hits.set(entryId, how);
    built.set(text, hits);
  };
  for (const e of Object.values(index.entries)) {
    add(e.id, e.id, "id");
    add(e.id.slice(e.database.length + 1), e.id, "id");
    add(e.name, e.id, "name");
    for (const a of Object.values(e.alternativeIds)) add(a, e.id, "alternative id");
    for (const accessions of Object.values(e.duplicateAlleleIds)) {
      for (const a of accessions) add(a, e.id, "duplicate allele id");
    }
  }
  tables.set(index, built);
  return built;
}

// Every entry the text identifies exactly (case-sensitive, after trimming) by composite id, native id, name,
// alternative id or duplicate allele id, sorted by id in code-point order (same as the Python oracle).
// Never picks one: the caller shows all candidates. `database` restricts the result; the UI filter is ticket #8.
// A prefixed accession such as `ncbi:NG_050598.1` is not an id, so it finds nothing (owner decision, ADR 0004).
export function findEntries(index: Index, text: string, database?: Database): Candidate[] {
  const hits = table(index).get(text.trim());
  if (!hits) return [];
  return [...hits]
    .filter(([id]) => !database || index.entries[id]!.database === database)
    .map(([id, matchedOn]) => {
      const e = index.entries[id]!;
      return { id, database: e.database, name: e.name, matchedOn };
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// Matches of one entry with identity >= minIdentity (fraction 0 to 1, inclusive), grouped by database.
// Every match tied at the group's maximum identity is flagged best (ADR 0004).
export function matchGroups(index: Index, entryId: string, minIdentity: number): MatchGroup[] {
  const byDb = new Map<Database, Match[]>();
  for (const e of index.edges[entryId] ?? []) {
    if (q(e.identity) < q(minIdentity)) continue;
    const entry = index.entries[e.target]!; // buildIndex guarantees the target exists
    const list = byDb.get(entry.database) ?? [];
    list.push({ entry, identity: e.identity, coverage: e.coverage, type: e.type, best: false });
    byDb.set(entry.database, list);
  }
  return [...byDb]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([database, matches]) => {
      const max = Math.max(...matches.map((m) => q(m.identity)));
      for (const m of matches) m.best = q(m.identity) === max;
      return { database, matches: matches.sort((a, b) => b.identity - a.identity) };
    });
}
