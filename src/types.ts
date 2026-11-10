export type Database = "card" | "ncbi" | "resfinder";
export type MatchType = "RBH" | "OWH";

// Release graph.json, node-link form (only the keys the app reads).
export interface GraphNode {
  id: string;
  database: Database;
  name: string;
  phenotype?: string;
  additional_phenotype?: string;
  product?: string;
  is_a?: string;
  PMID?: string[];
  alternative_id?: Record<string, string>;
  duplicate_allele_ids?: Record<string, string[]>;
}
export interface GraphLink {
  source: string;
  target: string;
  identity: number;
  coverage: number;
  type: MatchType;
}
export interface ReleaseGraph {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface Entry {
  id: string; // `<database>:<native id>`
  database: Database;
  name: string;
  phenotype?: string;
  additionalPhenotype?: string;
  product?: string;
  isA?: string;
  pmids: string[];
  alternativeIds: string[];
  duplicateAlleleIds: string[];
}
export interface Edge {
  target: string;
  identity: number; // fraction 0 to 1
  coverage: number; // fraction, may exceed 1
  type: MatchType;
}
export interface Index {
  entries: Record<string, Entry>;
  edges: Record<string, Edge[]>;
}

export interface Candidate {
  id: string;
  database: Database;
  name: string;
}
export interface Match {
  entry: Entry;
  identity: number;
  coverage: number;
  type: MatchType;
  best: boolean;
}
export interface MatchGroup {
  database: Database;
  matches: Match[];
}
