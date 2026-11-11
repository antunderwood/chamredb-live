import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isWeakGroup, matchDetails, otherMetadata, pubmedHref } from "./cardModel";
import { buildIndex } from "./parse";
import { matchGroups } from "./query";
import type { ReleaseGraph } from "./types";

// Oracle: the raw JSON of the graphs read directly (not through buildIndex), the hand-worked tests/fixtures/README.md
// and literals copied from a plain Python read of data/graph.json.
const raw = (path: string) => JSON.parse(readFileSync(path, "utf8")) as ReleaseGraph;
const fixture = raw("tests/fixtures/graph.json");
const fx = buildIndex(fixture);
const real = raw("data/graph.json");
const rl = buildIndex(real);

describe("pubmedHref", () => {
  it("is the PubMed address with the stored id unchanged", () => {
    expect(pubmedHref("3024112")).toBe("https://pubmed.ncbi.nlm.nih.gov/3024112/");
  });
  it("does not link a value that is not a PubMed id (the release has a DOI in a PMID field)", () => {
    expect(pubmedHref("DOI:10.1039/C2MD20038D")).toBeNull();
    expect(pubmedHref("123/../x")).toBeNull();
    expect(pubmedHref("")).toBeNull();
  });
});

describe("otherMetadata (fixture, hand-worked)", () => {
  it("an entry with every field", () => {
    expect(otherMetadata(fx.entries["card:ARO:2000"])).toEqual({
      pmids: [
        { id: "10000002", href: "https://pubmed.ncbi.nlm.nih.gov/10000002/" },
        { id: "10000003", href: "https://pubmed.ncbi.nlm.nih.gov/10000003/" },
        { id: "DOI:10.0000/hand-written", href: null },
      ],
      isA: "ARO:0000002:ribosomal protection protein",
      product: "hand-written product of tet(M)",
    });
  });
  it("shows only the fields that are present", () => {
    expect(otherMetadata(fx.entries["card:ARO:1000"])).toEqual({
      pmids: [{ id: "10000001", href: "https://pubmed.ncbi.nlm.nih.gov/10000001/" }],
      isA: "ARO:0000001:beta-lactamase",
      product: undefined,
    });
    expect(otherMetadata(fx.entries["ncbi:WP_1.1"])).toEqual({ pmids: [], isA: undefined, product: "class A beta-lactamase BlaX-1" });
  });
  it("an entry with none says so by being empty", () => {
    expect(otherMetadata(fx.entries["resfinder:orphan"])).toEqual({ pmids: [], isA: undefined, product: undefined });
  });
});

describe("otherMetadata (real release graph-2026.11.09)", () => {
  it("equals the raw JSON value for every entry", () => {
    for (const n of real.nodes) {
      const m = otherMetadata(rl.entries[n.id]);
      expect(m.pmids.map((p) => p.id), n.id).toEqual(n.PMID ?? []);
      expect(m.isA, n.id).toBe(n.is_a);
      expect(m.product, n.id).toBe(n.product);
      for (const p of m.pmids) expect(p.href, n.id).toBe(/^[0-9]+$/.test(p.id) ? `https://pubmed.ncbi.nlm.nih.gov/${p.id}/` : null);
    }
  });
  it("fixed entries as read by plain Python", () => {
    expect(otherMetadata(rl.entries["card:ARO:3000230"])).toEqual({
      pmids: [
        { id: "25564464", href: "https://pubmed.ncbi.nlm.nih.gov/25564464/" },
        { id: "3024112", href: "https://pubmed.ncbi.nlm.nih.gov/3024112/" },
      ],
      isA: "ARO:3007405:ANT(2'')-I",
      product: undefined,
    });
    expect(otherMetadata(rl.entries["ncbi:WP_003152694.1"]).product).toBe("multidrug efflux transporter outer membrane subunit TOprJ1");
    expect(otherMetadata(rl.entries["card:ARO:3001313"]).pmids).toEqual([{ id: "DOI:10.1039/C2MD20038D", href: null }]);
    expect(otherMetadata(rl.entries["resfinder:VanHDX"])).toEqual({ pmids: [], isA: undefined, product: undefined });
  });
  it("counts: 2262 entries with a PMID, 5971 with is_a, 7299 with a product", () => {
    const all = Object.values(rl.entries).map(otherMetadata);
    expect(all.filter((m) => m.pmids.length)).toHaveLength(2262);
    expect(all.filter((m) => m.isA !== undefined)).toHaveLength(5971);
    expect(all.filter((m) => m.product !== undefined)).toHaveLength(7299);
  });
});

describe("matchDetails (fixture, hand-worked)", () => {
  it("percentages to one decimal, the type written out, a tie is Best for both", () => {
    const [a, b, c] = matchGroups(fx, "card:ARO:1000", 0.9)[0].matches.map((m) => matchDetails(m, false));
    expect(a).toEqual({ identity: "97.0%", coverage: "100.0%", type: "RBH", typeLabel: "Reciprocal best hit", badge: "best" });
    expect(b).toEqual({ identity: "97.0%", coverage: "100.0%", type: "OWH", typeLabel: "One-way hit", badge: "best" });
    expect(c).toEqual({ identity: "90.0%", coverage: "100.0%", type: "OWH", typeLabel: "One-way hit", badge: null });
  });
  it("coverage can exceed 100%", () => {
    expect(matchDetails(matchGroups(fx, "card:ARO:2000", 0.9)[0].matches[0], false).coverage).toBe("105.0%");
  });
  it("a weak group's top match is 'highest', never 'best'", () => {
    const groups = matchGroups(fx, "card:ARO:2000", 0.8);
    const g = groups.find((x) => x.database === "resfinder")!;
    expect(isWeakGroup(g, 0.9)).toBe(true);
    expect(matchDetails(g.matches[0], true)).toEqual({ identity: "88.0%", coverage: "100.0%", type: "OWH", typeLabel: "One-way hit", badge: "highest" });
    expect(isWeakGroup(groups.find((x) => x.database === "ncbi")!, 0.9)).toBe(false);
  });
  it("compares at 3 decimals like the filter: 0.8996 shows as 90.0% and is not weak; an empty group is not weak", () => {
    const m = { ...matchGroups(fx, "card:ARO:1000", 0.9)[0].matches[2], identity: 0.8996 };
    expect(matchDetails(m, false).identity).toBe("90.0%");
    expect(isWeakGroup({ database: "ncbi", matches: [m] }, 0.9)).toBe(false);
    expect(isWeakGroup({ database: "ncbi", matches: [{ ...m, identity: 0.8994 }] }, 0.9)).toBe(true);
    expect(isWeakGroup({ database: "ncbi", matches: [] }, 0.9)).toBe(false);
  });
  it("exactly 0.9 is not weak", () => {
    const m = matchGroups(fx, "card:ARO:1000", 0.9)[0].matches[2];
    expect(m.identity).toBe(0.9);
    expect(isWeakGroup({ database: "ncbi", matches: [m] }, 0.9)).toBe(false);
  });
});
