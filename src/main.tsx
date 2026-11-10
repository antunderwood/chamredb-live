import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import "./app.css";
import { findEntries, matchGroups } from "./query";
import type { Candidate, Index } from "./types";

const DEFAULT_MIN_PCT = 90; // default minimum identity, ADR 0004
const pct = (fraction: number) => `${(fraction * 100).toFixed(1)}%`;

function App() {
  const [index, setIndex] = useState<Index | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [searched, setSearched] = useState<string | null>(null);
  const [minPct, setMinPct] = useState(DEFAULT_MIN_PCT); // whole percent from the slider; identity is a 0 to 1 fraction
  const minIdentity = minPct / 100;

  useEffect(() => {
    fetch("./index.json")
      .then((r) => {
        if (!r.ok) throw new Error(`index.json returned HTTP ${r.status}; check the deployed base path`);
        return r.json() as Promise<Index>;
      })
      .then(setIndex)
      .catch((e) => setError(`Could not load the data: ${e}`));
  }, []);

  const found: Candidate[] = useMemo(
    () => (index && searched !== null ? findEntries(index, searched) : []),
    [index, searched],
  );
  const groups = useMemo(
    () => (index && found.length === 1 ? matchGroups(index, found[0].id, minIdentity) : []),
    [index, found, minIdentity],
  );

  const shown = (searched ?? "").trim();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSearched(text);
  };
  const choose = (id: string) => {
    setText(id);
    setSearched(id);
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-semibold">chAMReDB</h1>
      <p className="mt-2 text-muted">
        Find the equivalent of an antimicrobial resistance gene in CARD, NCBI AMRFinderPlus and ResFinder.
      </p>
      {index && !index.release && (
        <p role="note" className="mt-4 rounded-md border border-border bg-surface px-3 py-2 text-sm">
          Demo data: a hand-written test graph, not a ChamRedB release. Do not use these results.
        </p>
      )}
      <p className="mt-2 text-sm text-muted">
        Privacy: all searches run in your browser. Your searches never leave your browser, and this site loads no
        third-party scripts, fonts or analytics. The web host keeps ordinary access logs of page and data file requests.
      </p>

      <form onSubmit={submit} className="mt-6 flex gap-2">
        <label className="flex-1">
          <span className="block text-sm font-medium">Entry id or name</span>
          <input
            value={text}
            disabled={!index}
            onChange={(e) => setText(e.target.value)}
            placeholder="card:ARO:1000"
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 disabled:opacity-50"
          />
        </label>
        <button
          type="submit"
          disabled={!index || !text.trim()}
          className="self-end rounded-md bg-accent px-4 py-2 font-medium text-accent-fg disabled:opacity-50"
        >
          Search
        </button>
      </form>

      {error && <p role="alert" className="mt-6 text-danger">{error}</p>}
      {searched !== null && found.length === 0 && (
        <p role="alert" className="mt-6 text-danger">
          No entry has the id, name, alternative id or duplicate allele id exactly {shown}. Matching is
          exact and case-sensitive, including brackets and version suffixes (tet(M), not tetM; WP_012695489.1, not
          WP_012695489).
        </p>
      )}
      {found.length > 1 && (
        <div role="status" className="mt-6">
          <p>More than one entry matches {shown}. Choose one:</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {found.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => choose(c.id)} className="rounded-md border border-border bg-surface px-3 py-1">
                  {c.id} ({c.name}), matched on {c.matchedOn}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {found.length === 1 && found[0].matchedOn !== "id" && (
        <p role="status" className="mt-6 rounded-md border border-border bg-surface px-3 py-2 text-sm">
          {shown} is the {found[0].matchedOn} of {found[0].id}
          {found[0].matchedOn === "duplicate allele id" ? ", not an entry of its own" : ""}. The matches below are for
          this entry only
          {found[0].matchedOn === "name" ? "; other databases may list entries with the same name" : ""}.
        </p>
      )}
      {found.length === 1 && (
        <div className="mt-6">
          <label htmlFor="min-identity" className="block text-sm font-medium">Minimum identity</label>
          <div className="mt-1 flex items-center gap-3">
            <input
              id="min-identity"
              type="range"
              min={0}
              max={100}
              step={1}
              value={minPct}
              aria-valuetext={`${minPct}%`}
              onChange={(e) => setMinPct(Number(e.target.value))}
              className="w-full accent-accent"
            />
            <output htmlFor="min-identity" className="w-12 text-right tabular-nums">{minPct}%</output>
          </div>
        </div>
      )}
      {found.length === 1 && groups.length === 0 && (
        <p role="status" className="mt-4 text-muted">
          No matches with identity of at least {minPct}% for {found[0].id}. Lower the minimum identity to see weaker matches.
        </p>
      )}
      {groups.length > 0 && (
        <p role="status" className="mt-4 text-sm text-muted">
          {groups.length} {groups.length === 1 ? "database" : "databases"} with matches of identity at least {minPct}%
          (identity: fraction of identical residues; coverage: alignment length / query length, so it can exceed
          100%). Best is the highest identity in that database among the matches shown, by identity only: it ignores
          coverage and the match type. RBH: reciprocal best hit; OWH: one-way hit (the reverse direction is not implied).
        </p>
      )}
      {groups.map((g) => {
        // Below 90% identity the top match is weak evidence of equivalence (ADR 0004): do not call it Best.
        const weak = Math.max(...g.matches.map((m) => m.identity)) < DEFAULT_MIN_PCT / 100;
        return (
        <section key={g.database} aria-label={`Matches in ${g.database}`} className="mt-6 rounded-lg border border-border bg-surface p-4">
          <h2 className="text-lg font-semibold">{g.database}</h2>
          {weak && (
            <p className="mt-1 text-sm text-danger">
              Weak evidence: every match here is below {DEFAULT_MIN_PCT}% identity. The highest identity is marked, but
              it ignores coverage and the match type.
            </p>
          )}
          <ul className="mt-2 space-y-2">
            {g.matches.map((m) => (
              <li key={m.entry.id}>
                <span className="font-medium">{m.entry.id.slice(g.database.length + 1)}</span> ({m.entry.name}){" "}
                identity {pct(m.identity)}, coverage {pct(m.coverage)}, {m.type}
                {m.best && (
                  <strong
                    className={
                      weak
                        ? "ml-2 rounded border border-border px-1.5 py-0.5 text-xs text-muted"
                        : "ml-2 rounded bg-accent px-1.5 py-0.5 text-xs text-accent-fg"
                    }
                  >
                    {weak ? "Highest identity shown" : "Best"}
                  </strong>
                )}
              </li>
            ))}
          </ul>
        </section>
        );
      })}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
