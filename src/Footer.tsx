import { useEffect, useState } from "react";

interface Provenance {
  release: string;
  date: string;
  source: string;
  tool: string;
  graphSha256: string;
  manifestSha256: string;
  databases: { database: string; release: string; retrieved: string }[];
}

const LABEL: Record<string, string> = { card: "CARD", ncbi: "NCBI AMRFinderPlus", resfinder: "ResFinder" };

// Release provenance. `release` is index.release: undefined for a non-release (demo) build, which shows no footer.
export function Footer({ release }: { release: string | undefined }) {
  const [p, setP] = useState<Provenance | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!release) return;
    fetch("./provenance.json")
      .then((r) => {
        if (!r.ok) throw new Error(`provenance.json returned HTTP ${r.status}`);
        return r.json() as Promise<Provenance>;
      })
      .then((j) => {
        if (j.release !== release) throw new Error(`provenance.json is for ${j.release}, the data is ${release}`);
        setP(j);
      })
      .catch((e) => setError(`Could not load the release provenance: ${e}`));
  }, [release]);

  if (!release || (!p && !error)) return null; // no empty contentinfo landmark while loading
  return (
    <footer className="mx-auto mt-10 max-w-3xl border-t border-border px-4 py-6 text-sm text-muted">
      {error && <p role="alert" className="text-danger">{error}</p>}
      {p && (
        <>
          <p>
            Release {p.release}, built {p.date}. <a className="underline" href={p.source}>Release page</a>.
          </p>
          <p className="mt-1">Source databases:</p>
          <ul className="list-disc pl-5">
            {p.databases.map((d) => (
              <li key={d.database}>
                {LABEL[d.database] ?? d.database} {d.database === "resfinder" ? "git commit " : ""}{d.release}, retrieved {d.retrieved}
              </li>
            ))}
          </ul>
          <p className="mt-1">Graph built with {p.tool}.</p>
          <p className="mt-1 break-all">Release graph.json sha256 (a build input, see the release page): <code>{p.graphSha256}</code></p>
          <p className="break-all">Release data_manifest.json sha256 (the record of the source database files): <code>{p.manifestSha256}</code></p>
          <p className="mt-1">The checksums detect accidental change only; they do not prove who produced the files.</p>
        </>
      )}
    </footer>
  );
}
