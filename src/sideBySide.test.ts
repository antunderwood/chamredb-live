import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PhenotypeBody } from "./Cards";
import { comparisonRows } from "./comparison";
import { EXAMPLES } from "./Examples";
import { buildIndex } from "./parse";
import { joinPhenotype, parsePhenotype } from "./parsePhenotype";
import { matchGroups } from "./query";
import { sideBySide } from "./sideBySide";
import type { Index, ReleaseGraph } from "./types";

// Oracle: the raw JSON of each graph (node.phenotype and node.additional_phenotype as stored), not Entry fields. For every
// column of every example entry (shipped release) and every entry of the hand-written fixture, at minimum identities 0.9 and 0:
// the column's database label is its entry's database, the shown pieces recompose to the stored text, and an entry without a
// phenotype says "not recorded".
type Raw = { nodes: { id: string; database: string; phenotype?: string; additional_phenotype?: string }[] };
const load = (path: string, release?: string) => {
  const raw = JSON.parse(readFileSync(path, "utf8")) as Raw;
  return { raw: new Map(raw.nodes.map((n) => [n.id, n])), index: buildIndex(raw as unknown as ReleaseGraph, release) };
};
const unescape = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
const pieces = (html: string) => [...html.matchAll(/<li [^>]*>([^<]*)<\/li>/g)].map((m) => unescape(m[1]));

function check(name: string, g: { raw: Map<string, Raw["nodes"][number]>; index: Index }, ids: string[]) {
  describe(name, () => {
    for (const id of ids) {
      for (const min of [0.9, 0]) {
        it(`${id} at ${min}: labels, verbatim pieces, not recorded`, () => {
          const q = g.index.entries[id]!;
          const rows = comparisonRows(q.database, matchGroups(g.index, id, min), matchGroups(g.index, id, 0), 0.9);
          const cols = sideBySide(q, rows);
          expect(cols[0].database).toBe(q.database); // the query first
          expect(cols.map((c) => c.database).sort()).toEqual(["card", "ncbi", "resfinder"]); // one column per database, none dropped
          for (const c of cols) {
            if (c.kind === "none") continue;
            for (const e of c.entries) {
              expect(e.database).toBe(c.database); // the column's label is its entry's database
              const stored = g.raw.get(e.id)!;
              expect(e.database).toBe(stored.database);
              const html = renderToStaticMarkup(createElement(PhenotypeBody, { entry: e, of: "match", view: "side" }));
              if (!stored.phenotype) {
                expect(html).toMatch(/data-side-gap="" class="italic">not recorded<\/span> in this database/);
                expect(html).not.toContain("<ul");
              } else {
                const p = parsePhenotype(stored.phenotype);
                expect(joinPhenotype(p)).toBe(stored.phenotype); // the pieces recompose to the stored text
                const primary = pieces(html.split("Additional phenotype")[0]);
                expect(primary).toEqual(p.shape === "verbatim" ? [] : p.items);
                if (p.shape === "verbatim") expect(unescape(html)).toContain(stored.phenotype);
              }
              if (stored.additional_phenotype) {
                const p = parsePhenotype(stored.additional_phenotype);
                expect(joinPhenotype(p)).toBe(stored.additional_phenotype);
                expect(pieces(html.split("Additional phenotype")[1] ?? "")).toEqual(p.shape === "verbatim" ? [] : p.items);
              } else {
                expect(html).not.toContain("Additional phenotype");
              }
            }
          }
        });
      }
    }
  });
}

const fixture = load("tests/fixtures/graph.json");
check("fixture", fixture, Object.keys(fixture.index.entries));
const release = load("data/graph.json", "graph-2026.11.09");
check("examples in the shipped release", release, [...new Set(EXAMPLES.flatMap((e) => e.ids))]);

describe("sideBySide (hand-worked, fixture)", () => {
  it("card:ARO:1000 at 0.9: the query, then the best matches of ncbi (a tie of two) and resfinder", () => {
    const q = fixture.index.entries["card:ARO:1000"]!;
    const cols = sideBySide(q, comparisonRows("card", matchGroups(fixture.index, q.id, 0.9), matchGroups(fixture.index, q.id, 0), 0.9));
    expect(cols.map((c) => [c.database, c.kind === "entries" ? c.role : "none"])).toEqual([["card", "query"], ["ncbi", "best"], ["resfinder", "best"]]);
    expect(cols[1].kind === "entries" && cols[1].entries.map((e) => e.id)).toEqual(["ncbi:WP_1.1", "ncbi:WP_3.1"]);
  });
  it("card:ARO:2000 at 0.9: resfinder has no match at that identity and says so (tetM 0.88 is below)", () => {
    const q = fixture.index.entries["card:ARO:2000"]!;
    const cols = sideBySide(q, comparisonRows("card", matchGroups(fixture.index, q.id, 0.9), matchGroups(fixture.index, q.id, 0), 0.9));
    expect(cols[2]).toEqual({ kind: "none", database: "resfinder", below: 1 });
  });
  it("card:ARO:2000 at 0.8: the resfinder match is the highest identity shown, not Best", () => {
    const q = fixture.index.entries["card:ARO:2000"]!;
    const cols = sideBySide(q, comparisonRows("card", matchGroups(fixture.index, q.id, 0.8), matchGroups(fixture.index, q.id, 0), 0.9));
    expect(cols[2].kind === "entries" && cols[2].role).toBe("highest");
  });
});
