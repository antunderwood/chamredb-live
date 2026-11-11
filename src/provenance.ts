import { useEffect, useState } from "react";

// The release provenance written at build time (vite.config.ts provenanceJson from data/provenance.json and
// data/data_manifest.json). Loaded once; `release` is index.release, undefined for a non-release (demo) build.
export interface Provenance {
  release: string;
  date: string;
  source: string;
  tool: string;
  graphSha256: string;
  manifestSha256: string;
  databases: { database: string; release: string; retrieved: string }[];
}

export const DB_LABEL: Record<string, string> = { card: "CARD", ncbi: "NCBI AMRFinderPlus", resfinder: "ResFinder" };

export function useProvenance(release: string | undefined): { provenance: Provenance | null; error: string | null } {
  const [provenance, setProvenance] = useState<Provenance | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!release) return;
    fetch("./provenance.json")
      .then((r) => {
        if (!r.ok) throw new Error(`provenance.json returned HTTP ${r.status}`);
        return r.json() as Promise<Provenance>;
      })
      .then((j) => {
        // A malformed file becomes the visible footer alert, not a crash or "undefined" in the panel.
        const strings = ["release", "date", "source", "tool", "graphSha256", "manifestSha256"] as const;
        const bad = strings.filter((k) => typeof j?.[k] !== "string");
        if (bad.length || !Array.isArray(j.databases) || j.databases.some((d) => typeof d?.database !== "string" || typeof d.release !== "string" || typeof d.retrieved !== "string"))
          throw new Error(`provenance.json is malformed${bad.length ? ` (missing ${bad.join(", ")})` : " (databases)"}`);
        if (j.release !== release) throw new Error(`provenance.json is for ${j.release}, the data is ${release}`);
        setProvenance(j);
      })
      .catch((e) => setError(`Could not load the release provenance: ${e}`));
  }, [release]);
  return { provenance, error };
}
