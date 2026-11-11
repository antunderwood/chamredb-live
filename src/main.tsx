import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import "./app.css";
import { Footer } from "./Footer";
import { Examples } from "./Examples";
import { Header } from "./Header";
import { HowToRead } from "./HowToRead";
import { formatHash, MAX_QUERY, parseHash, type HashState } from "./hash";
import { ResultPanels } from "./ResultPanels";
import { About } from "./About";
import { findEntries, matchGroups, prime, suggest } from "./query";
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

  // Build the lookup table in slices right after the index arrives, so the first keystroke does not pay for it.
  useEffect(() => {
    if (index) prime(index).catch(() => {}); // optional: findEntries and suggest build on demand if it fails
  }, [index]);

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

  const pickExample = (query: string) => {
    setDb(undefined); // a database filter could hide some of the example's candidates
    setText(query);
    setSearched(query);
    setLinkRel(undefined);
  };

  return (
    <>
    <Header />
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">chAMReDB</h1>
      <p className="mt-2 text-muted">
        Find the equivalent of an antimicrobial resistance gene in CARD, NCBI AMRFinderPlus and ResFinder.
      </p>
      {index && !index.release && (
        <p role="note" className="mt-4 rounded-lg border border-border border-l-4 border-l-accent bg-surface px-3 py-2 text-sm">
          Demo data: a hand-written test graph, not a ChamRedB release. Do not use these results.
        </p>
      )}

      <form onSubmit={submit} className="mt-6 flex flex-wrap gap-3 rounded-xl border border-border bg-surface p-4 shadow-card">
        <label>
          <span className="block text-sm font-medium">Search in database</span>
          <select
            value={db ?? ""}
            disabled={!index}
            onChange={(e) => setDb((e.target.value || undefined) as Database | undefined)}
            className="mt-1 rounded-md border border-control-border bg-surface px-3 py-2 disabled:opacity-50"
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
            id="entry-query"
            list="suggestions"
            maxLength={MAX_QUERY}
            autoComplete="off"
            placeholder="card:ARO:3000230 or a gene name, for example tet(M)"
            className="mt-1 w-full rounded-md border border-control-border bg-surface px-3 py-2 disabled:opacity-50"
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
          className="self-end rounded-md bg-accent px-5 py-2 font-semibold text-accent-fg disabled:opacity-50"
        >
          Search
        </button>
      </form>
      <p className="mt-2 text-sm text-muted">
        Privacy: your searches never leave your browser, and this site loads no third-party scripts, fonts or
        analytics. The web host keeps ordinary access logs, and anyone you give a link to can read the search in it.
        More under How to read this, below.
      </p>
      <Examples index={index} onPick={pickExample} />

      {error && <p role="alert" className="mt-6 text-danger">{error}</p>}
      {index && searched !== null && found.length === 0 && (
        <p role="alert" className="mt-6 text-danger">
          No entry has the id, name, alternative id or duplicate allele id exactly {shown}{db ? ` in ${LABELS[db]}` : ""}. Matching is
          exact and case-sensitive, including brackets and version suffixes (tet(M), not tetM; WP_012695489.1, not
          WP_012695489).{db ? ` The database filter is set to ${LABELS[db]}; choose All databases to search the others.` : ""}
        </p>
      )}
      {staleLink && searched !== null && (
        <p role="status" className="mt-6 rounded-lg border border-border border-l-4 border-l-accent bg-surface px-3 py-2 text-sm">
          This link was made with release {staleLink}; this page uses {index?.release}. Ids and names may have been
          retired or reassigned between releases, so check that the entry shown is the one you meant.
        </p>
      )}
      {hidden.length > 0 && (
        <p role="status" className="mt-6 rounded-lg border border-border border-l-4 border-l-accent bg-surface px-3 py-2 text-sm">
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
                <button type="button" onClick={() => choose(c.id)} className="rounded-md border border-control-border bg-surface px-3 py-1 hover:border-fg">
                  {c.id} ({c.name}), matched on {c.matchedOn}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {found.length === 1 && found[0].matchedOn !== "id" && (
        <p role="status" className="mt-6 rounded-lg border border-border border-l-4 border-l-accent bg-surface px-3 py-2 text-sm">
          {shown} is the {found[0].matchedOn} of {found[0].id}
          {found[0].matchedOn === "duplicate allele id" ? ", not an entry of its own" : ""}. The matches below are for
          this entry only
          {found[0].matchedOn === "name" ? "; other databases may list entries with the same name" : ""}.
        </p>
      )}
      {found.length === 1 && (
        <div className="mt-6 rounded-xl border border-border bg-surface p-4 shadow-card">
          <label htmlFor="min-identity" className="block rounded-md bg-label px-3 py-1 text-sm font-medium text-label-fg">Minimum identity</label>
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
          {groups.length} {groups.length === 1 ? "database" : "databases"} with matches at or above {minPct}% identity.
          Best marks the highest identity shown in each database, by identity only (below {WEAK_PCT}% the label is
          Highest identity shown). RBH: reciprocal best hit; OWH: one-way hit. More under How to read this.
        </p>
      )}
      {index && found.length === 1 && index.entries[found[0].id] && (
        <ResultPanels query={index.entries[found[0].id]!} groups={groups} weakBelow={WEAK_PCT / 100} />
      )}
      <HowToRead weakPct={WEAK_PCT} />
      <About />
    </main>
    <Footer release={index?.release} />
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
