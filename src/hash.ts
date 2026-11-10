import { DATABASES, type Database } from "./types";

// The shareable search lives in the URL hash (`#q=tet%28M%29&db=card&min=80&rel=graph-2026.11.09`): your browser
// does not send it to this site. Repeated keys: the first wins.
export const DEFAULT_MIN_PCT = 90; // default minimum identity in whole percent, ADR 0004
export const MAX_QUERY = 200; // also the length limit of the search box, so a long search never round-trips truncated

export interface HashState {
  q: string; // submitted search text
  db: Database | undefined; // optional database filter
  min: number; // minimum identity, whole percent 0 to 100
  rel: string | undefined; // ChamRedB release the link was made with
}

// Invalid or missing values fall back to the defaults; the app never fails on a hand-edited link.
export function parseHash(hash: string): HashState {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const min = params.get("min");
  const rel = params.get("rel");
  return {
    q: (params.get("q") ?? "").trim().slice(0, MAX_QUERY),
    db: DATABASES.find((d) => d === params.get("db")),
    min: min !== null && /^\d{1,3}$/.test(min) && Number(min) <= 100 ? Number(min) : DEFAULT_MIN_PCT,
    rel: rel !== null && /^[\w.-]{1,64}$/.test(rel) ? rel : undefined,
  };
}

// Empty string (no hash at all) when everything is the default. The release is written only with a search.
export function formatHash({ q, db, min, rel }: HashState): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (db) params.set("db", db);
  if (min !== DEFAULT_MIN_PCT) params.set("min", String(min));
  if (q && rel) params.set("rel", rel);
  const out = params.toString();
  return out ? `#${out}` : "";
}
