import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { joinPhenotype, parsePhenotype, type PhenotypeShape } from "./parsePhenotype";
import { NOT_RECORDED, phenotypeText } from "./phenotypeText";
import type { ReleaseGraph } from "./types";

// Oracle: the raw JSON of the graph (not through buildIndex) and counts from this plain Python, run on
// data/graph.json (release graph-2026.11.09), which a human can rerun:
//
//   import json, collections
//   g = json.load(open("data/graph.json")); c = collections.Counter()
//   for n in g["nodes"]:
//       for k in ("phenotype", "additional_phenotype"):
//           p = n.get(k)
//           if p is None: c[k, "none"] += 1; continue
//           s = ("antibiotic" if p.startswith("confers resistance to antibiotic:") else
//                "drug class" if p.startswith("confers resistance to drug class:") else
//                "subclass" if p.startswith("confers resistance to subclass ") else
//                "list" if p.startswith("confers resistance to ") else "verbatim")
//           c[k, n["database"], s] += 1
//   print(sorted(c.items(), key=str))
//
// Result: phenotype: ncbi subclass 7299, card drug class 4339, card antibiotic 1507, resfinder list 2589, none 125;
// additional_phenotype: card drug class 1260, none 14599. No "verbatim" occurs in this release.
const graph = JSON.parse(readFileSync("data/graph.json", "utf8")) as ReleaseGraph;

describe("parsePhenotype (hand-worked)", () => {
  it("CARD antibiotic: heading keeps colon and space, items split on a bare comma", () => {
    expect(parsePhenotype("confers resistance to antibiotic: dalfopristin,virginiamycin M1")).toEqual({
      shape: "antibiotic",
      heading: "confers resistance to antibiotic: ",
      items: ["dalfopristin", "virginiamycin M1"],
      separator: ",",
    });
  });
  it("CARD drug class", () => {
    expect(parsePhenotype("confers resistance to drug class: pleuromutilin antibiotic,streptogramin A antibiotic")).toEqual({
      shape: "drug class",
      heading: "confers resistance to drug class: ",
      items: ["pleuromutilin antibiotic", "streptogramin A antibiotic"],
      separator: ",",
    });
  });
  it("ResFinder: split on comma and space only", () => {
    expect(parsePhenotype("confers resistance to Vancomycin, Teicoplanin")).toEqual({
      shape: "list",
      heading: "confers resistance to ",
      items: ["Vancomycin", "Teicoplanin"],
      separator: ", ",
    });
    expect(parsePhenotype("confers resistance to Quinupristin+Dalfopristin").items).toEqual(["Quinupristin+Dalfopristin"]);
  });
  it("ResFinder with a comma and no space is not split (the text is not altered to fit the rule)", () => {
    expect(parsePhenotype("confers resistance to Chloramphenicol,Florfenicol").items).toEqual(["Chloramphenicol,Florfenicol"]);
  });
  it("NCBI subclass: one item even with a slash", () => {
    expect(parsePhenotype("confers resistance to subclass METHICILLIN")).toEqual({
      shape: "subclass",
      heading: "confers resistance to subclass ",
      items: ["METHICILLIN"],
      separator: "",
    });
    expect(parsePhenotype("confers resistance to subclass A/B").items).toEqual(["A/B"]);
  });
  it("an unknown shape is one verbatim item with no heading", () => {
    expect(parsePhenotype("resistant to everything, maybe")).toEqual({
      shape: "verbatim",
      heading: "",
      items: ["resistant to everything, maybe"],
      separator: "",
    });
    // Near misses are unknown too: no trailing space after the prefix, capitalised, no colon.
    for (const s of ["confers resistance to", "Confers resistance to X"]) expect(parsePhenotype(s).shape, s).toBe("verbatim");
    // No colon-space after "antibiotic": falls to the ResFinder list shape, still one verbatim item.
    expect(parsePhenotype("confers resistance to antibiotic:x")).toMatchObject({ shape: "list", items: ["antibiotic:x"] });
  });
  it("the entry without a phenotype keeps the 'not recorded' wording and is never parsed as a phenotype", () => {
    const entry = { phenotype: undefined };
    expect(phenotypeText(entry)).toBe(NOT_RECORDED);
    expect(parsePhenotype(phenotypeText(entry))).toMatchObject({ shape: "verbatim", items: ["not recorded"] });
  });
  it("an empty item list entry stays: 'antibiotic: ' gives one empty item", () => {
    expect(parsePhenotype("confers resistance to antibiotic: ").items).toEqual([""]);
    expect(parsePhenotype("confers resistance to antibiotic: a,,b").items).toEqual(["a", "", "b"]);
  });
});

describe("recompose: join(parse(x)) equals x character for character", () => {
  const table = [
    "",
    " ",
    "  \t\n",
    " leading",
    "trailing ",
    " confers resistance to antibiotic: a,b",
    "confers resistance to antibiotic: a,b ",
    "confers resistance to antibiotic: ,a,",
    "confers resistance to antibiotic: a, b",
    "confers resistance to drug class: ",
    "confers resistance to subclass ",
    "confers resistance to subclass  X/Y ",
    "confers resistance to ",
    "confers resistance to  X,  Y, ",
    "confers resistance to X, Y,Z, ",
    "<b>x</b> & <script>",
    "unicode éß, \u{1F9EC}",
  ];
  it.each(table)("table %j", (s) => expect(joinPhenotype(parsePhenotype(s))).toBe(s));

  it("random strings built from the delimiters", () => {
    const parts = ["confers resistance to ", "antibiotic: ", "drug class: ", "subclass ", ",", ", ", " ", "a", "B/c", ":", "\n", ""];
    let seed = 12345; // fixed LCG so a failure is reproducible
    const next = () => (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;
    for (let i = 0; i < 5000; i++) {
      const s = Array.from({ length: Math.floor(next() * 8) }, () => parts[Math.floor(next() * parts.length)]).join("");
      expect(joinPhenotype(parsePhenotype(s)), JSON.stringify(s)).toBe(s);
    }
  });

  it("holds for every phenotype and additional phenotype of the real release", () => {
    let checked = 0;
    const expected = graph.nodes.filter((n) => n.phenotype !== undefined).length + graph.nodes.filter((n) => n.additional_phenotype !== undefined).length;
    for (const n of graph.nodes) {
      for (const x of [n.phenotype, n.additional_phenotype]) {
        if (x === undefined) continue;
        expect(joinPhenotype(parsePhenotype(x)), n.id).toBe(x);
        checked++;
      }
    }
    expect(checked).toBe(expected);
    expect(checked).toBe(15734 + 1260); // 15734 with a phenotype (125 without), 1260 additional, from the Python count
  });
});

describe("shape counts on the real release equal the independent Python count", () => {
  const count = (field: "phenotype" | "additional_phenotype") => {
    const c: Record<string, number> = {};
    for (const n of graph.nodes) {
      const x = n[field];
      if (x === undefined) continue;
      const key = `${n.database} ${parsePhenotype(x).shape}`;
      c[key] = (c[key] ?? 0) + 1;
    }
    return c;
  };
  it("phenotype", () => {
    expect(count("phenotype")).toEqual({
      "ncbi subclass": 7299,
      "card drug class": 4339,
      "card antibiotic": 1507,
      "resfinder list": 2589,
    });
  });
  it("additional phenotype", () => {
    expect(count("additional_phenotype")).toEqual({ "card drug class": 1260 });
  });
  it("no phenotype is parsed as an unknown shape in this release", () => {
    const shapes = new Set<PhenotypeShape>();
    for (const n of graph.nodes) if (n.phenotype !== undefined) shapes.add(parsePhenotype(n.phenotype).shape);
    expect(shapes.has("verbatim")).toBe(false);
  });
});
