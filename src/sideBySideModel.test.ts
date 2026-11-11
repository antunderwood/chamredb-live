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
import { sideBySide } from "./sideBySideModel";
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
          const cols = sideBySide(q, rows, 0.9);
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
    const cols = sideBySide(q, comparisonRows("card", matchGroups(fixture.index, q.id, 0.9), matchGroups(fixture.index, q.id, 0), 0.9), 0.9);
    expect(cols.map((c) => [c.database, c.kind === "entries" ? c.role : "none"])).toEqual([["card", "query"], ["ncbi", "best"], ["resfinder", "best"]]);
    expect(cols[1].kind === "entries" && cols[1].entries.map((e) => e.id)).toEqual(["ncbi:WP_1.1", "ncbi:WP_3.1"]);
  });
  it("card:ARO:2000 at 0.9: resfinder has no match at that identity and says so (tetM 0.88 is below)", () => {
    const q = fixture.index.entries["card:ARO:2000"]!;
    const cols = sideBySide(q, comparisonRows("card", matchGroups(fixture.index, q.id, 0.9), matchGroups(fixture.index, q.id, 0), 0.9), 0.9);
    expect(cols[2]).toEqual({ kind: "none", database: "resfinder", below: 1 });
  });
  it("card:ARO:2000 at 0.8: the resfinder match is the highest identity shown, not Best", () => {
    const q = fixture.index.entries["card:ARO:2000"]!;
    const cols = sideBySide(q, comparisonRows("card", matchGroups(fixture.index, q.id, 0.8), matchGroups(fixture.index, q.id, 0), 0.9), 0.9);
    expect(cols[2].kind === "entries" && cols[2].role).toBe("highest");
  });
});

// Evidence per entry (owner-approved after the review of #20 to #26). Oracle: the raw links of the graph (identity, coverage and
// type as stored), formatted here independently of cardModel's pct.
type RawLink = { source: string; target: string; identity: number; coverage: number; type: "RBH" | "OWH" };
const links = (path: string) => (JSON.parse(readFileSync(path, "utf8")) as { links: RawLink[] }).links;
const fmt = (f: number) => `${(f * 100).toFixed(1)}%`;
const TYPE = { RBH: "Reciprocal best hit (RBH)", OWH: "One-way hit (OWH)" } as const;
const MORE1 = "+1 more match in this database, see the cards";

describe("sideBySide evidence (raw links as oracle)", () => {
  const raw = links("tests/fixtures/graph.json");
  const cols = (id: string, min: number, weakBelow = 0.9) => {
    const q = fixture.index.entries[id]!;
    return sideBySide(q, comparisonRows(q.database, matchGroups(fixture.index, id, min), matchGroups(fixture.index, id, 0), weakBelow), weakBelow);
  };
  it("every non-query entry carries identity, coverage and RBH/OWH exactly as stored; the query column carries none", () => {
    for (const id of Object.keys(fixture.index.entries)) {
      for (const min of [0.9, 0]) {
        for (const c of cols(id, min)) {
          if (c.kind === "none") continue;
          if (c.role === "query") {
            expect(c.evidence).toEqual([]);
            expect(c.weakNote).toBeNull();
            expect(c.more).toBeNull();
            continue;
          }
          expect(c.evidence).toHaveLength(c.entries.length);
          c.entries.forEach((e, i) => {
            const l = raw.find((x) => x.source === id && x.target === e.id)!;
            expect(c.evidence[i]).toBe(`Identity ${fmt(l.identity)}, coverage ${fmt(l.coverage)}, ${TYPE[l.type]}`);
          });
        }
      }
    }
  });
  it("card:ARO:2000 at 80%: the weak resfinder column says so, with the working-default framing; ncbi and the query do not", () => {
    const c = cols("card:ARO:2000", 0.8);
    expect(c[2].kind === "entries" && c[2].weakNote).toBe("Weak evidence: every match here is below 90% identity (a working default, not a validated cut-off).");
    expect(c[1].kind === "entries" && c[1].weakNote).toBeNull();
    expect(c[0].kind === "entries" && c[0].weakNote).toBeNull();
  });
  it("a group at 100% is not weak", () => {
    const c = cols("card:ARO:1000", 0);
    expect(c[2].kind === "entries" && c[2].weakNote).toBeNull();
  });
  it("more matches than shown: card:ARO:1000 ncbi shows a tie of 2 of 3 (at 90% and at 0), resfinder at 0 shows 1 of 2", () => {
    const n = cols("card:ARO:1000", 0.9)[1];
    expect(n.kind === "entries" && n.more).toBe(MORE1);
    const r = cols("card:ARO:1000", 0)[2];
    expect(r.kind === "entries" && r.more).toBe(MORE1);
    const r90 = cols("card:ARO:1000", 0.9)[2];
    expect(r90.kind === "entries" && r90.more).toBeNull();
  });
  it("N is the group size minus the entries shown; plural for 2 or more; none when everything is shown", () => {
    for (const id of Object.keys(fixture.index.entries)) {
      for (const min of [0.9, 0]) {
        const groups = matchGroups(fixture.index, id, min);
        for (const c of cols(id, min)) {
          if (c.kind === "none" || c.role === "query") continue;
          const n = groups.find((g) => g.database === c.database)!.matches.length - c.entries.length;
          expect(c.more).toBe(n === 0 ? null : n === 1 ? MORE1 : `+${n} more matches in this database, see the cards`);
        }
      }
    }
  });
});

describe("sideBySide evidence (shipped release)", () => {
  const raw = links("data/graph.json");
  it("resfinder:blaNDM-1 at 90%: card and ncbi each show their stored identity, coverage and type, no weak note, nothing more", () => {
    const q = release.index.entries["resfinder:blaNDM-1"]!;
    const c = sideBySide(q, comparisonRows(q.database, matchGroups(release.index, q.id, 0.9), matchGroups(release.index, q.id, 0), 0.9), 0.9);
    expect(c).toHaveLength(3);
    for (const col of c.slice(1)) {
      if (col.kind !== "entries") throw new Error("expected entries");
      const l = raw.find((x) => x.source === q.id && x.target === col.entries[0].id)!;
      expect(col.evidence[0]).toBe(`Identity ${fmt(l.identity)}, coverage ${fmt(l.coverage)}, ${TYPE[l.type]}`);
      expect(col.weakNote).toBeNull();
      expect(col.more).toBeNull();
    }
  });
});
