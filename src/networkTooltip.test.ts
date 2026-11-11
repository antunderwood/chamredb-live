import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildNetwork } from "./networkModel";
import { PHENOTYPE_MAX, tooltip } from "./networkTooltip";
import { buildIndex } from "./parse";
import type { ReleaseGraph } from "./types";

// Fixture values (tests/fixtures/graph.json): card:ARO:1000 -> ncbi:WP_1.1 .97 RBH coverage 1.0, ncbi:WP_3.1 .97 OWH,
// ncbi:WP_4.1 .9 OWH; ncbi:WP_4.1 -> card:ARO:2000 .92 RBH coverage 1.05; card:ARO:2000 has phenotype
// "confers resistance to drug class: tetracycline antibiotic" and additional phenotype
// "confers resistance to antibiotic: tetracycline"; resfinder:blaXlow has no phenotype.
const index = buildIndex(JSON.parse(readFileSync("tests/fixtures/graph.json", "utf8")) as ReleaseGraph);
const net = buildNetwork(index, "card:ARO:1000", 0.9, ["ncbi:WP_4.1"]);
const tip = (id: string, max?: number) => {
  const n = net.nodes.find((x) => x.id === id)!;
  return tooltip(n, index.entries[id]!, max);
};

describe("tooltip text", () => {
  it("a best match: id, name, database, identity, coverage, type, best, phenotype", () => {
    expect(tip("ncbi:WP_1.1")).toEqual({
      lines: [
        "ncbi:WP_1.1",
        "blaX-1",
        "Database: ncbi",
        "Identity: 97.0%",
        "Coverage: 100.0%",
        "Type: Reciprocal best hit",
        "best",
        "Phenotype: confers resistance to subclass CEPHALOSPORIN",
      ],
      truncated: false,
    });
  });
  it("a match that is not best has no best line; a one-way hit is written out", () => {
    const lines = tip("ncbi:WP_4.1").lines; // .9 OWH, not best in the ncbi group
    expect(lines).toContain("Type: One-way hit");
    expect(lines).toContain("Identity: 90.0%");
    expect(lines).not.toContain("best");
    expect(lines.some((l) => l.includes("highest identity"))).toBe(false);
  });
  it("a step-2 node says whose match it is, shows coverage above 100% and both phenotype fields verbatim", () => {
    expect(tip("card:ARO:2000")).toEqual({
      lines: [
        "card:ARO:2000",
        "tet(M)",
        "Database: card",
        "Identity: 92.0%",
        "Coverage: 105.0%",
        "Type: Reciprocal best hit",
        "best",
        "identity, coverage and best are relative to ncbi:WP_4.1, not to the query",
        "match of ncbi:WP_4.1",
        "Phenotype: confers resistance to drug class: tetracycline antibiotic",
        "Additional phenotype: confers resistance to antibiotic: tetracycline",
      ],
      truncated: false,
    });
  });
  it("a weak best match reads 'highest identity shown (weak evidence)', never 'best'", () => {
    const n = buildNetwork(index, "ncbi:WP_4.1", 0.8, ["card:ARO:2000"]);
    const tetM = n.nodes.find((x) => x.id === "resfinder:tetM")!;
    const lines = tooltip(tetM, index.entries["resfinder:tetM"]!).lines;
    expect(lines).toContain("highest identity shown (weak evidence)");
    expect(lines).not.toContain("best");
    expect(lines).toContain("match of card:ARO:2000");
    expect(lines).toContain("Identity: 88.0%");
  });
  it("the query has no identity, coverage, type or best line", () => {
    expect(tip("card:ARO:1000").lines).toEqual(["card:ARO:1000", "blaX", "Database: card", "Query entry", "Phenotype: confers resistance to antibiotic: cephalosporin"]);
  });
  it("an entry without a phenotype says 'not recorded' and omits the additional field", () => {
    const g = buildNetwork(index, "card:ARO:1000", 0.5);
    expect(tooltip(g.nodes.find((x) => x.id === "resfinder:blaXlow")!, index.entries["resfinder:blaXlow"]!).lines.at(-1)).toBe("Phenotype: not recorded");
  });
});

describe("tooltip truncation is for display only", () => {
  const long = "confers resistance to " + "aminoglycoside ".repeat(20).trim();
  const withLong = { ...index.entries["card:ARO:2000"]!, phenotype: long, additionalPhenotype: "short" };
  const n = { ...net.nodes[0]! };
  it("cuts a long phenotype to the limit with an ellipsis and says so", () => {
    const t = tooltip(n, withLong);
    const line = t.lines.find((l) => l.startsWith("Phenotype: "))!;
    expect(t.truncated).toBe(true);
    expect(line).toBe(`Phenotype: ${long.slice(0, PHENOTYPE_MAX - 1)}…`);
    expect([...line.slice("Phenotype: ".length)]).toHaveLength(PHENOTYPE_MAX);
    expect(t.lines).toContain("Additional phenotype: short");
  });
  it("never alters the stored entry, and a text exactly at the limit is shown whole", () => {
    const before = JSON.stringify(withLong);
    tooltip(n, withLong);
    expect(JSON.stringify(withLong)).toBe(before);
    expect(withLong.phenotype).toBe(long);
    const exact = { ...withLong, phenotype: "x".repeat(PHENOTYPE_MAX), additionalPhenotype: undefined };
    const t = tooltip(n, exact);
    expect(t.truncated).toBe(false);
    expect(t.lines).toContain(`Phenotype: ${"x".repeat(PHENOTYPE_MAX)}`);
    expect(tooltip(n, { ...exact, phenotype: "x".repeat(PHENOTYPE_MAX + 1) }).truncated).toBe(true);
  });
  it("the limit is a parameter", () => {
    expect(tooltip(n, { ...withLong, phenotype: "abcdefghij" }, 5).lines).toContain("Phenotype: abcd…");
  });
});
