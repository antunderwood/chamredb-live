import { DATABASES, type Candidate, type Database, type Index, type Match, type MatchedOn, type MatchGroup } from "./types";

// Identity is compared at 3 decimals of the fraction, the displayed precision (data contract).
const q = (fraction: number) => Math.round(fraction * 1000);

const PRIORITY: MatchedOn[] = ["id", "name", "alternative id", "duplicate allele id"];

// Search text to {entry id: best way it identifies that entry}. Built once per index; an Index is never mutated
// after buildIndex, so there is no invalidation.
const tables = new WeakMap<Index, Map<string, Map<string, MatchedOn>>>();

// Completions are ranked from per-database best ranks, built from the table (see suggest).
interface Suggestible { text: string; lower: string; ranks: number[] } // best rank per database, NONE if absent
const NONE = 99;
const suggestibles = new WeakMap<Index, Suggestible[]>();

// The one builder of both caches, as a generator that yields every SLICE units of work. The synchronous path
// drains it (no yield is ever awaited), `prime` awaits an event-loop turn between slices, so the two cannot
// drift. Phase 1 fills `tables`, phase 2 fills `suggestibles`; each is stored only once complete.
const SLICE = 1500;
const builds = new WeakMap<Index, Generator<void, void, void>>();
function* build(index: Index): Generator<void, void, void> {
  const built = new Map<string, Map<string, MatchedOn>>();
  const add = (text: string, entryId: string, how: MatchedOn) => {
    const hits = built.get(text) ?? new Map<string, MatchedOn>();
    const seen = hits.get(entryId);
    if (!seen || PRIORITY.indexOf(how) < PRIORITY.indexOf(seen)) hits.set(entryId, how);
    built.set(text, hits);
  };
  let n = 0;
  for (const e of Object.values(index.entries)) {
    add(e.id, e.id, "id");
    add(e.id.slice(e.database.length + 1), e.id, "id");
    add(e.name, e.id, "name");
    for (const a of Object.values(e.alternativeIds)) add(a, e.id, "alternative id");
    for (const accessions of Object.values(e.duplicateAlleleIds)) {
      for (const a of accessions) add(a, e.id, "duplicate allele id");
    }
    if (++n % SLICE === 0) yield;
  }
  tables.set(index, built);
  const all: Suggestible[] = [];
  for (const [text, hits] of built) {
    const ranks = DATABASES.map(() => NONE);
    for (const [id, how] of hits) {
      const d = DATABASES.indexOf(index.entries[id]!.database);
      ranks[d] = Math.min(ranks[d], PRIORITY.indexOf(how));
    }
    all.push({ text, lower: text.toLowerCase(), ranks });
    if (all.length % SLICE === 0) yield;
  }
  suggestibles.set(index, all);
}

function builder(index: Index) {
  let b = builds.get(index);
  if (!b) builds.set(index, (b = build(index)));
  return b;
}
// Runs the builder until `done` holds for the index. Resumes a build that `prime` has started, so a keystroke
// during priming only pays for the work that is left.
function ensure(index: Index, done: WeakMap<Index, unknown>) {
  const b = builder(index);
  try {
    while (!done.has(index) && !b.next().done);
  } catch (e) {
    builds.delete(index); // a generator that threw is finished for good: let the next call start afresh
    throw e;
  }
}

function table(index: Index) {
  ensure(index, tables);
  return tables.get(index)!;
}

// Builds the lookup table and the completions list in slices, yielding to the event loop between them, so the
// first keystroke does not pay for about 16k entries and 52k strings in one task (docs/performance.md). Optional: findEntries and
// suggest build synchronously when it has not run, with identical results. Idempotent; a synchronous call in
// between finishes the part of the build it needs (findEntries the table, suggest also the completions).
export async function prime(index: Index): Promise<void> {
  const b = builder(index);
  try {
    while (!suggestibles.has(index)) {
      if (b.next().done) break;
      await yieldToEventLoop();
    }
  } catch (e) {
    if (builds.get(index) === b) builds.delete(index); // a generator that threw is finished: let the next call rebuild
    throw e;
  }
}
const yieldToEventLoop = () => new Promise<void>((resolve) => setTimeout(resolve));

// Every entry the text identifies exactly (case-sensitive, after trimming) by composite id, native id, name,
// alternative id or duplicate allele id, sorted by id in UTF-16 code-unit order (the same as code-point order for these ASCII ids, and as the Python oracle).
// Never picks one: the caller shows all candidates. `database` restricts the result (the UI database filter).
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

// Completions for a typed prefix: searchable strings starting with it (case-insensitive), ranked by how they
// identify entries (id, name, alternative id, duplicate allele id), then shorter, then code-unit order. With a
// `database`, only strings that identify an entry in that database, ranked by how they do so in that database.
// Needs two characters.
export function suggest(index: Index, prefix: string, database?: Database, limit = 10): string[] {
  const p = prefix.trim().toLowerCase();
  if (p.length < 2) return [];
  ensure(index, suggestibles);
  const all = suggestibles.get(index)!;
  const d = database ? DATABASES.indexOf(database) : -1;
  const rank = (s: Suggestible) => (d < 0 ? Math.min(...s.ranks) : s.ranks[d]);
  return all
    .filter((s) => s.lower.startsWith(p) && rank(s) < NONE)
    .sort((a, b) => rank(a) - rank(b) || a.text.length - b.text.length || (a.text < b.text ? -1 : a.text > b.text ? 1 : 0))
    .slice(0, limit)
    .map((s) => s.text);
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
