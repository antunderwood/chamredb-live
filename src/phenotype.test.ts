import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildIndex } from "./parse";
import { additionalPhenotypeText, NOT_RECORDED, phenotypeText } from "./phenotypeText";
import { matchGroups } from "./query";
import type { ReleaseGraph } from "./types";

// Oracle: the raw JSON of the graph, read directly (not through buildIndex), and literals copied from a plain
// Python read of data/graph.json. Hand-worked fixture values: tests/fixtures/README.md.
const raw = (path: string) => JSON.parse(readFileSync(path, "utf8")) as ReleaseGraph;
const rawNode = (g: ReleaseGraph, id: string) => g.nodes.find((n) => n.id === id)!;

describe("phenotypeText (fixture, hand-worked)", () => {
  const fixture = raw("tests/fixtures/graph.json");
  const index = buildIndex(fixture);
  it("is the stored text verbatim", () => {
    expect(phenotypeText(index.entries["card:ARO:1000"])).toBe("confers resistance to antibiotic: cephalosporin");
    expect(phenotypeText(index.entries["resfinder:tetM"])).toBe("confers resistance to Tetracycline");
  });
  it("says 'not recorded' for the entry without a phenotype", () => {
    expect(rawNode(fixture, "resfinder:orphan").phenotype).toBeUndefined();
    expect(phenotypeText(index.entries["resfinder:orphan"])).toBe("not recorded");
  });
  it("keeps the additional phenotype apart, and only when present", () => {
    expect(additionalPhenotypeText(index.entries["card:ARO:2000"])).toBe("confers resistance to antibiotic: tetracycline");
    expect(phenotypeText(index.entries["card:ARO:2000"])).toBe("confers resistance to drug class: tetracycline antibiotic");
    expect(additionalPhenotypeText(index.entries["card:ARO:1000"])).toBeNull();
  });
});

describe("phenotypeText (real release graph-2026.11.09)", () => {
  const graph = raw("data/graph.json");
  const index = buildIndex(graph);
  it("equals the raw JSON value for every entry, and 'not recorded' exactly where it is absent", () => {
    for (const n of graph.nodes) {
      expect(phenotypeText(index.entries[n.id]), n.id).toBe(n.phenotype ?? NOT_RECORDED);
      expect(additionalPhenotypeText(index.entries[n.id]), n.id).toBe(n.additional_phenotype ?? null);
    }
  });
  it("counts 125 without a phenotype (counts with a phenotype and additional phenotype: src/release.test.ts)", () => {
    const entries = Object.values(index.entries);
    expect(entries.filter((e) => phenotypeText(e) === NOT_RECORDED)).toHaveLength(125);
    expect(entries.filter((e) => phenotypeText(e) !== NOT_RECORDED)).toHaveLength(15734);
    expect(entries.filter((e) => additionalPhenotypeText(e) !== null)).toHaveLength(1260);
  });
  it("shows fixed entries as read by plain Python (no phenotype; both fields)", () => {
    expect(phenotypeText(index.entries["card:ARO:3000124"])).toBe("not recorded"); // mecA-type mecI, CARD
    expect(phenotypeText(index.entries["card:ARO:3000118"])).toBe("confers resistance to antibiotic: dalfopristin,virginiamycin M1");
    expect(additionalPhenotypeText(index.entries["card:ARO:3000118"])).toBe(
      "confers resistance to drug class: pleuromutilin antibiotic,streptogramin A antibiotic",
    );
    expect(phenotypeText(index.entries["ncbi:WP_000369216.1"])).toBe("confers resistance to subclass METHICILLIN");
  });
  it("gives the match without a phenotype 'not recorded'", () => {
    const groups = matchGroups(index, "ncbi:WP_000369216.1", 0.9);
    expect(groups.map((g) => g.database)).toEqual(["card"]);
    const m = groups[0].matches[0];
    expect(m.entry.id).toBe("card:ARO:3000124");
    expect(phenotypeText(m.entry)).toBe("not recorded");
  });
});
