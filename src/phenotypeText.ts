import type { Entry } from "./types";

export const NOT_RECORDED = "not recorded";

// Phenotype exactly as the source database wrote it (never rephrased, trimmed, shortened or merged with the
// additional phenotype), or "not recorded" when the entry has none. "Not recorded" is a gap in the source
// database, not a statement that the gene confers no resistance.
export const hasPhenotype = (e: Pick<Entry, "phenotype">): boolean => !!e.phenotype;
export const phenotypeText = (e: Pick<Entry, "phenotype">): string => (hasPhenotype(e) ? e.phenotype! : NOT_RECORDED);

// The additional phenotype is shown only when present: null means "do not show the field".
export const additionalPhenotypeText = (e: Pick<Entry, "additionalPhenotype">): string | null => e.additionalPhenotype || null;
