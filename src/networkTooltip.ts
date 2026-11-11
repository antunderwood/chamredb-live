import type { NetNode } from "./networkModel";
import { additionalPhenotypeText, phenotypeText } from "./phenotypeText";
import type { Entry } from "./types";

// Text of the node tooltip as plain lines (no markup), so the UI can show it on hover and focus and the tests can
// compare it. The phenotype text is the stored text verbatim (phenotypeText), cut for display only.
export const PHENOTYPE_MAX = 160; // characters of a phenotype text shown (label excluded), the ellipsis included

const pct = (fraction: number) => `${(fraction * 100).toFixed(1)}%`; // one decimal, as in the list
const TYPE = { RBH: "Reciprocal best hit", OWH: "One-way hit" } as const;

// Text cut to at most `max` characters (code points), ending in an ellipsis when cut. Never touches the source.
function shorten(text: string, max: number): { text: string; cut: boolean } {
  max = Math.max(1, max);
  const chars = [...text];
  return chars.length <= max ? { text, cut: false } : { text: `${chars.slice(0, max - 1).join("")}…`, cut: true };
}

// `truncated` tells the UI that a phenotype line was cut, so it can say the full text is in the list.
export function tooltip(node: NetNode, entry: Entry, maxPhenotype = PHENOTYPE_MAX): { lines: string[]; truncated: boolean } {
  if (node.id !== entry.id) throw new Error(`Tooltip node ${node.id} does not match entry ${entry.id}`);
  const lines = [node.id, node.name, `Database: ${node.database}`];
  if (node.role === "query") lines.push("Query entry");
  if (node.hit) {
    lines.push(`Identity: ${pct(node.hit.identity)}`, `Coverage: ${pct(node.hit.coverage)}`, `Type: ${TYPE[node.hit.type]}`);
    if (node.best) lines.push(node.weak ? "highest identity shown (weak evidence)" : "best");
    if (node.below) lines.push("Below 90% identity: weak evidence of equivalence."); // the list's own wording
    // identity and coverage of a step-2 node are between `via` and the node, not between the query and the node
    if (node.role === "step2") lines.push(`identity, coverage and best are relative to ${node.via}, not to the query`);
  }
  if (node.role === "step2") lines.push(`match of ${node.via}`);
  let truncated = false;
  const phenotype = (label: string, text: string) => {
    const s = shorten(text, maxPhenotype);
    truncated ||= s.cut;
    lines.push(`${label}: ${s.text}`);
  };
  phenotype("Phenotype", phenotypeText(entry));
  const additional = additionalPhenotypeText(entry);
  if (additional !== null) phenotype("Additional phenotype", additional);
  return { lines, truncated };
}
