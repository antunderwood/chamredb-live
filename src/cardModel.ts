import type { Entry, Match, MatchGroup, MatchType } from "./types";

// What the result cards show, as plain data: no React, so the text can be compared with the stored fields.
// Nothing here rephrases, trims or infers a value; fields that are absent stay absent.

export const pct = (fraction: number) => `${(fraction * 100).toFixed(1)}%`;

export const TYPE_LABEL: Record<MatchType, string> = { RBH: "Reciprocal best hit", OWH: "One-way hit" };

// A group whose top identity is below `weakBelow` (a fraction) is weak evidence of equivalence (ADR 0004).
export const isWeakGroup = (g: MatchGroup, weakBelow: number): boolean => Math.max(...g.matches.map((m) => m.identity)) < weakBelow;

const PUBMED = "https://pubmed.ncbi.nlm.nih.gov/";

// A PubMed id is digits only. The stored value is used unchanged in the address; anything else (the release has
// one value of the form "DOI:10.1039/...") is not a PubMed id, so it gets no link and is shown as text.
export const pubmedHref = (id: string): string | null => (/^[0-9]+$/.test(id) ? `${PUBMED}${id}/` : null);

export interface OtherMetadata {
  pmids: { id: string; href: string | null }[];
  isA?: string;
  product?: string;
}

export const otherMetadata = (e: Pick<Entry, "pmids" | "isA" | "product">): OtherMetadata => ({
  pmids: e.pmids.map((id) => ({ id, href: pubmedHref(id) })),
  isA: e.isA,
  product: e.product,
});

export const hasOtherMetadata = (m: OtherMetadata): boolean => m.pmids.length > 0 || !!m.isA || !!m.product;

export interface MatchDetails {
  identity: string;
  coverage: string;
  type: MatchType;
  typeLabel: string;
  badge: "best" | "highest" | null; // "highest": the top identity of a weak group, which is never called Best
}

export const matchDetails = (m: Match, weakGroup: boolean): MatchDetails => ({
  identity: pct(m.identity),
  coverage: pct(m.coverage),
  type: m.type,
  typeLabel: TYPE_LABEL[m.type],
  badge: m.best ? (weakGroup ? "highest" : "best") : null,
});
