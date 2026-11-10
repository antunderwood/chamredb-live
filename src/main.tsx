import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import "./app.css";
import { Footer } from "./Footer";
import { formatHash, MAX_QUERY, parseHash, type HashState } from "./hash";
import { EntryHeader, MatchPhenotype } from "./Phenotype";
import { findEntries, matchGroups, suggest } from "./query";
import { DATABASES, type Candidate, type Database, type Index } from "./types";

const WEAK_PCT = 90; // below this identity the top match is weak evidence of equivalence (ADR 0004)
const LABELS: Record<Database, string> = { card: "CARD", ncbi: "NCBI AMRFinderPlus", resfinder: "ResFinder" };

// Records the search in the address bar. Skips a no-op and survives the browser rate limit on replaceState.
function syncUrl(state: HashState) {
  const next = window.location.pathname + window.location.search + formatHash(state);
  if (next === window.location.pathname + window.location.search + window.location.hash) return;
  try {
    window.history.replaceState(null, "", next);
  } catch {
    // throttled by the browser: the URL lags one change behind, the app keeps working
  }
}
const pct = (fraction: number) => `${(fraction * 100).toFixed(1)}%`;

function App() {
  const [index, setIndex] = useState<Index | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initial] = useState(() => parseHash(window.location.hash)); // a shared link restores the search
  const [text, setText] = useState(initial.q);
  const [searched, setSearched] = useState<string | null>(initial.q || null);
  const [db, setDb] = useState<Database | undefined>(initial.db);
  const [minPct, setMinPct] = useState(initial.min); // whole percent from the slider; identity is a 0 to 1 fraction
  const [linkRel, setLinkRel] = useState(initial.rel); // release the opened link was made with, until a new search
  const minIdentity = minPct / 100;

  // The address bar records the submitted search, database filter, slider and release (replaceState: no history).
  // Until a new search, a link keeps the release it was made with, so a stale link stays visibly stale.
  useEffect(() => {
    syncUrl({ q: (searched ?? "").trim(), db, min: minPct, rel: linkRel ?? index?.release });
  }, [searched, db, minPct, linkRel, index]);

  // A link pasted or edited while the page is open applies at once.
  useEffect(() => {
    const apply = () => {
      const s = parseHash(window.location.hash);
      setText(s.q);
      setSearched(s.q || null);
      setDb(s.db);
      setMinPct(s.min);
      setLinkRel(s.rel);
    };
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

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
    () => (index && searched !== null ? findEntries(index, searched, db) : []),
    [index, searched, db],
  );
  const groups = useMemo(
    () => (index && found.length === 1 ? matchGroups(index, found[0].id, minIdentity) : []),
    [index, found, minIdentity],
  );

  const shown = (searched ?? "").trim();
  const suggestions = useMemo(() => (index ? suggest(index, text, db) : []), [index, text, db]);
  // With a database filter: entries with the same text in other databases that the filter hides.
  const hidden = useMemo(
    () => (index && db && searched !== null && found.length === 1 ? findEntries(index, searched).filter((c) => c.id !== found[0].id) : []),
    [index, db, searched, found],
  );
  const staleLink = index?.release && linkRel && linkRel !== index.release ? linkRel : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSearched(text);
    setLinkRel(undefined); // a new search belongs to the release in use
  };
  const choose = (id: string) => {
    setText(id);
    setSearched(id);
    setLinkRel(undefined);
  };

  return (
    <>
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
        The address of this page records your search after the # sign, so you can share it; your browser does not send
        that part to this site, but anyone you give the link to can read it.
      </p>

      <form onSubmit={submit} className="mt-6 flex flex-wrap gap-2">
        <label>
          <span className="block text-sm font-medium">Search in database</span>
          <select
            value={db ?? ""}
            disabled={!index}
            onChange={(e) => setDb((e.target.value || undefined) as Database | undefined)}
            className="mt-1 rounded-md border border-border bg-surface px-3 py-2 disabled:opacity-50"
          >
            <option value="">All databases</option>
            {DATABASES.map((d) => (
              <option key={d} value={d}>{LABELS[d]}</option>
            ))}
          </select>
        </label>
        <label className="min-w-48 flex-1">
          <span className="block text-sm font-medium">Entry id or name</span>
          <input
            value={text}
            disabled={!index}
            onChange={(e) => setText(e.target.value)}
            list="suggestions"
            maxLength={MAX_QUERY}
            autoComplete="off"
            placeholder="card:ARO:1000"
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 disabled:opacity-50"
          />
          <datalist id="suggestions">
            {suggestions.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
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
      {index && searched !== null && found.length === 0 && (
        <p role="alert" className="mt-6 text-danger">
          No entry has the id, name, alternative id or duplicate allele id exactly {shown}{db ? ` in ${LABELS[db]}` : ""}. Matching is
          exact and case-sensitive, including brackets and version suffixes (tet(M), not tetM; WP_012695489.1, not
          WP_012695489).{db ? ` The database filter is set to ${LABELS[db]}; choose All databases to search the others.` : ""}
        </p>
      )}
      {staleLink && searched !== null && (
        <p role="status" className="mt-6 rounded-md border border-border bg-surface px-3 py-2 text-sm">
          This link was made with release {staleLink}; this page uses {index?.release}. Ids and names may have been
          retired or reassigned between releases, so check that the entry shown is the one you meant.
        </p>
      )}
      {hidden.length > 0 && (
        <p role="status" className="mt-6 rounded-md border border-border bg-surface px-3 py-2 text-sm">
          Database filter: {LABELS[db!]}. {hidden.length} other {hidden.length === 1 ? "entry has" : "entries have"} this
          text in other databases ({hidden.slice(0, 5).map((c) => c.id).join(", ")}
          {hidden.length > 5 ? ", ..." : ""}). Choose All databases to see {hidden.length === 1 ? "it" : "them"}.
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
      {found.length === 1 && <EntryHeader entry={index!.entries[found[0].id]} />}
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
        const weak = Math.max(...g.matches.map((m) => m.identity)) < WEAK_PCT / 100;
        return (
        <section key={g.database} aria-label={`Matches in ${g.database}`} className="mt-6 rounded-lg border border-border bg-surface p-4">
          <h2 className="text-lg font-semibold">{g.database}</h2>
          {weak && (
            <p className="mt-1 text-sm text-danger">
              Weak evidence: every match here is below {WEAK_PCT}% identity. The highest identity is marked, but
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
                <MatchPhenotype entry={m.entry} />
              </li>
            ))}
          </ul>
        </section>
        );
      })}
    </main>
    <Footer release={index?.release} />
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
