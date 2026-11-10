import { layout, truncate, type Orientation } from "./layout";
import type { Entry, MatchGroup } from "./types";

const pct = (fraction: number) => `${(fraction * 100).toFixed(1)}%`;
const LABEL_MAX = 24; // characters; the full id and name are in the node title and the list
const NODE_R = 9;
const BEST_HALF = 8; // best match is a square of side 2 * BEST_HALF, the others are circles

// Tiny picture of the query and its shown matches (ticket #11). Same groups as the list, so the same rows, the
// same identity text and the same best flag; the list stays the accessible equivalent. All geometry comes from
// layout.ts, all colours from the tokens in public/theme.css. Edges are directed from the query: RBH is a
// reciprocal pair (solid, arrowhead at both ends), OWH is a one-way hit (dashed, arrowhead at the match only).
export function NetworkView({
  query,
  groups,
  weakBelow,
  orientation = "ltr",
}: {
  query: Entry;
  groups: MatchGroup[];
  weakBelow: number; // fraction: a group whose top identity is under this has no "best", as in the list
  orientation?: Orientation;
}) {
  const rows = groups.flatMap((g) => {
    const weak = Math.max(...g.matches.map((m) => m.identity)) < weakBelow;
    return g.matches.map((m) => ({ m, weak, native: m.entry.id.slice(g.database.length + 1), db: g.database }));
  });
  if (rows.length === 0) return null; // the list says there are no matches
  const l = layout(rows.length, orientation);
  const summary = `${query.id} and its ${rows.length} shown ${rows.length === 1 ? "match" : "matches"}, drawn from the query to each match`;
  const description = rows
    .map(
      ({ m, weak }) =>
        `${m.entry.id}, identity ${pct(m.identity)}, ${m.type === "RBH" ? "reciprocal best hit" : "one-way hit"}${
          m.best ? (weak ? ", highest identity shown" : ", best") : ""
        }`,
    )
    .join("; ");
  return (
    <figure className="mt-6">
      <svg
        viewBox={`0 0 ${l.width} ${l.height}`}
        width="100%"
        role="img"
        aria-labelledby="nv-title nv-desc"
        style={{ maxWidth: l.width * 1.5, height: "auto" }}
        data-testid="network"
      >
        <title id="nv-title">{summary}</title>
        <desc id="nv-desc">{description}. The list below has the same matches in text.</desc>
        <defs>
          <marker id="nv-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" style={{ fill: "var(--fg)" }} />
          </marker>
        </defs>
        {rows.map(({ m }, i) => {
          const { from, to } = l.neighbours[i]!.edge;
          const rbh = m.type === "RBH";
          return (
            <line
              key={m.entry.id}
              data-edge={m.entry.id}
              data-type={m.type}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              strokeWidth={1.5}
              strokeDasharray={rbh ? undefined : "5 4"}
              style={{ stroke: "var(--fg)" }}
              markerEnd="url(#nv-arrow)"
              markerStart={rbh ? "url(#nv-arrow)" : undefined}
            />
          );
        })}
        <g data-node={query.id}>
          <title>{`${query.id} (${query.name}), the query`}</title>
          <circle cx={l.query.centre.x} cy={l.query.centre.y} r={NODE_R} style={{ fill: "var(--fg)", stroke: "var(--fg)" }} strokeWidth={1.5} />
          <text x={l.query.label.x} y={l.query.label.y} textAnchor="middle" fontSize={11} fontWeight={600} style={{ fill: "var(--fg)" }}>
            {truncate(query.id, 18)}
          </text>
        </g>
        {rows.map(({ m, weak, native, db }, i) => {
          const s = l.neighbours[i]!;
          const note = m.best ? (weak ? ", highest" : ", best") : "";
          const shape = { fill: m.best && !weak ? "var(--accent)" : "var(--surface)", stroke: "var(--fg)" };
          return (
            <g key={m.entry.id} data-node={m.entry.id}>
              <title>{`${m.entry.id} (${m.entry.name}), identity ${pct(m.identity)}, ${m.type}`}</title>
              {m.best ? (
                <rect x={s.centre.x - BEST_HALF} y={s.centre.y - BEST_HALF} width={2 * BEST_HALF} height={2 * BEST_HALF} style={shape} strokeWidth={1.5} />
              ) : (
                <circle cx={s.centre.x} cy={s.centre.y} r={NODE_R} style={shape} strokeWidth={1.5} />
              )}
              <text x={s.label.x} y={s.label.y - 3} textAnchor={s.anchor} fontSize={11} style={{ fill: "var(--fg)" }}>
                {truncate(`${db} ${native}`, LABEL_MAX)}
              </text>
              <text x={s.label.x} y={s.label.y + 11} textAnchor={s.anchor} fontSize={11} style={{ fill: "var(--muted)" }}>
                {`${pct(m.identity)} ${m.type}${note}`}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 text-sm text-muted">
        Network of the query and its shown matches (the same matches as the list below). Arrows run from the query.
        Solid line with an arrowhead at both ends: RBH, a reciprocal pair. Dashed line with one arrowhead: OWH, a
        one-way hit (the reverse direction is not implied). Square: best match (filled), or the highest identity shown when
        the group is below {pct(weakBelow)} (unfilled, weak evidence); circle: other match. Best is one per database
        (ties all best), by identity only: it ignores coverage and the match type. The order of the rows is not a
        ranking across databases.
      </figcaption>
    </figure>
  );
}
