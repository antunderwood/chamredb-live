import type { Candidate, Database, Index, Match, MatchGroup } from "./types";

// Identity is compared at 3 decimals of the fraction, the displayed precision (data contract).
const q = (fraction: number) => Math.round(fraction * 1000);

// Exact, case-sensitive match on the composite id (`card:ARO:3000230`) or the native id (`ARO:3000230`).
// ponytail: names, alternative ids and duplicate allele ids arrive in ticket #6.
export function findEntries(index: Index, text: string): Candidate[] {
  const t = text.trim();
  return Object.values(index.entries)
    .filter((e) => e.id === t || e.id.slice(e.database.length + 1) === t)
    .map(({ id, database, name }) => ({ id, database, name }));
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
