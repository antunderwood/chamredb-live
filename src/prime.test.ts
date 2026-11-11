import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildIndex } from "./parse";
import { findEntries, prime, suggest } from "./query";
import type { ReleaseGraph } from "./types";

// prime() builds the lookup table and the completions in slices; it must change timing only, never results.
const graph = JSON.parse(readFileSync("data/graph.json", "utf8")) as ReleaseGraph;
const fresh = () => buildIndex(graph); // a new Index object has its own caches
type Idx = ReturnType<typeof fresh>;

// A spread of searchable strings: composite ids, native ids, names, absent text, case and whitespace variants.
function sample(idx: Idx): string[] {
  const ids = Object.keys(idx.entries);
  const out: string[] = ["", " ", "zzzz", "nothing-matches"];
  for (let i = 0; i < ids.length; i += 211) {
    const e = idx.entries[ids[i]!]!;
    out.push(e.id, e.id.slice(e.database.length + 1), e.name, ` ${e.name.toLowerCase()} `, e.id.slice(0, 3), e.name.slice(0, 2));
    out.push(...Object.values(e.alternativeIds).slice(0, 1));
  }
  return out;
}
const answers = (idx: Idx, texts: string[]) =>
  texts.map((t) => [findEntries(idx, t), suggest(idx, t), suggest(idx, t, "card"), suggest(idx, t, "resfinder", 3)]);

afterEach(() => vi.restoreAllMocks());

// These build the real index twice: a loaded CI runner exceeded the 5 s default once, so allow 20 s.
describe("prime", { timeout: 20000 }, () => {
  it("leaves findEntries and suggest unchanged on the real index", async () => {
    const reference = fresh();
    const primed = fresh();
    await prime(primed);
    const texts = sample(reference);
    expect(texts.length).toBeGreaterThan(300);
    expect(answers(primed, texts)).toEqual(answers(reference, texts));
  });

  it("works in several slices, yielding to the event loop between them", async () => {
    const spy = vi.spyOn(globalThis, "setTimeout");
    await prime(fresh());
    // about 16k entries and 52k strings at 1500 per slice: tens of slices. A loose floor, not a timing.
    expect(spy.mock.calls.length).toBeGreaterThan(20);
  });

  // Slice 3 falls in the first phase (about 16k entries, 1500 per slice); slice 20 in the second (about 52k strings).
  it.each([3, 20])("answers correctly when called synchronously after slice %i, which finishes the build", async (at) => {
    const reference = fresh();
    const idx = fresh();
    const texts = sample(reference).slice(0, 60);
    const expected = answers(reference, texts);
    const real = globalThis.setTimeout;
    let during: unknown[][] | undefined;
    let ticks = 0;
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((fn: () => void) => {
      if (++ticks === at) during = answers(idx, texts);
      return real(fn);
    }) as typeof setTimeout);
    await prime(idx);
    expect(ticks).toBe(at); // the synchronous call finished the build, so prime found nothing left to slice
    expect(during).toEqual(expected);
    expect(answers(idx, texts)).toEqual(expected);
  });

  it("a failed build is not cached: the next call rebuilds and gives the real answer", async () => {
    const idx = fresh();
    const reference = fresh();
    const entries = idx.entries;
    const victim = Object.keys(entries)[5]!;
    const saved = entries[victim]!;
    // an entry whose alternativeIds is missing makes the builder throw
    (entries as Record<string, unknown>)[victim] = { ...saved, alternativeIds: undefined };
    await expect(prime(idx)).rejects.toThrow();
    expect(() => findEntries(idx, "x")).toThrow(); // not a TypeError from a half-built cache, and not silent
    (entries as Record<string, unknown>)[victim] = saved;
    expect(findEntries(idx, saved.id)).toEqual(findEntries(reference, saved.id));
  });

  it("is idempotent and safe to run twice at once", async () => {
    const reference = fresh();
    const idx = fresh();
    await Promise.all([prime(idx), prime(idx)]);
    const spy = vi.spyOn(globalThis, "setTimeout");
    await prime(idx); // already built: nothing left to slice
    expect(spy).not.toHaveBeenCalled();
    const texts = sample(reference).slice(0, 80);
    expect(answers(idx, texts)).toEqual(answers(reference, texts));
  });
});
