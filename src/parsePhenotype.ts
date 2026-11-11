// Splits a stored phenotype string into a heading and items for display, without losing a character:
// joinPhenotype(parsePhenotype(x)) === x for every string x. Nothing is trimmed, normalised, merged or inferred;
// the heading keeps its trailing colon or space and the separator is the exact text between items.
//
// Shapes seen in release graph-2026.11.09 (rules from the release, ADR 0005):
//   CARD       "confers resistance to antibiotic: a,b"     items split on "," (no space)
//   CARD       "confers resistance to drug class: a,b"     items split on "," (no space)
//   NCBI       "confers resistance to subclass X/Y"        ONE item: a slash can belong to a combination name
//   ResFinder  "confers resistance to X, Y"                items split on ", " (comma and space)
//   anything else                                          no heading, the verbatim string as one item
export type PhenotypeShape = "antibiotic" | "drug class" | "subclass" | "list" | "verbatim";

export interface ParsedPhenotype {
  shape: PhenotypeShape;
  heading: string; // exactly as stored, including trailing colon and/or space; "" when there is none
  items: string[]; // never empty; items are text only, never parsed as HTML
  separator: string; // exactly what sits between two items; "" when there is a single item
}

const PREFIX = "confers resistance to ";
const WITH_COLON: [string, PhenotypeShape][] = [
  [`${PREFIX}antibiotic: `, "antibiotic"],
  [`${PREFIX}drug class: `, "drug class"],
];
const SUBCLASS = `${PREFIX}subclass `;

export function parsePhenotype(text: string): ParsedPhenotype {
  for (const [heading, shape] of WITH_COLON) {
    if (text.startsWith(heading)) return { shape, heading, items: text.slice(heading.length).split(","), separator: "," };
  }
  if (text.startsWith(SUBCLASS)) return { shape: "subclass", heading: SUBCLASS, items: [text.slice(SUBCLASS.length)], separator: "" };
  // ResFinder: anything else that starts with the prefix (the shapes above are tested first).
  if (text.startsWith(PREFIX)) return { shape: "list", heading: PREFIX, items: text.slice(PREFIX.length).split(", "), separator: ", " };
  return { shape: "verbatim", heading: "", items: [text], separator: "" };
}

export const joinPhenotype = (p: ParsedPhenotype): string => p.heading + p.items.join(p.separator);
