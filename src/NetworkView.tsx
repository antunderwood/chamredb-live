import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { pct, TYPE_LABEL } from "./cardModel";
import {
  DB_SHAPE,
  ID_MAX,
  DETAIL_MAX,
  NAME_MAX,
  PILL,
  QUERY_NAME_MAX,
  SWATCH,
  chipPath,
  ellipsize,
  layoutNetwork,
  pillRect,
  ribbonRect,
  RIBBON_H,
  RIBBON_W,
  EXPAND_H,
  type Cubic,
  type NodeSlot,
} from "./networkLayout";
import { MAX_NODES, buildNetwork, ownMatchCount, visibleEdges, type NetNode } from "./networkModel";
import { tooltip } from "./networkTooltip";
import type { Database, Entry, Index } from "./types";

// The interactive network picture (tickets #9 and #10). It draws what networkModel.ts decided (nodes, edges, flags)
// at the positions networkLayout.ts computed, and adds nothing of its own: every number below is a constant or a
// field of the layout. The list under it stays the accessible equivalent: both are built from the same matches.
//
// Each node is a focusable button (SVG group, role=button): click or Enter makes it the new query (the parent
// pushes a history entry), hover or focus shows a tooltip and highlights the node, its edges and its card. A step-1
// node has a second, separate button (the "+n" pill) that adds that entry's own matches as step-2 nodes, drawn
// lighter with a dashed outline in a third column: a match of a match, never a match of the query. Expansion is
// React state here: it is not in the address and it resets when the query changes. Colours are tokens (app.css).

const BADGE: Record<Database, string> = { card: "CARD", ncbi: "NCBI", resfinder: "ResFinder" };
const HEAD = ["Query", "Matches of the query", "Matches of a match"] as const;
type RibbonKind = keyof typeof RIBBON_W;
// The words on a ribbon. Best and Highest identity shown are the group's top match only (the list's words); a match under 90%
// that is not the top of its group gets the plain Below 90% mark.
const RIBBON_TEXT: Record<RibbonKind, string> = { best: "Best", weak: "Highest identity shown", below: "Below 90%" };
const SWATCH_NAME: Record<RibbonKind, string> = { best: "best", weak: "highest", below: "below" };
const MINUS = "−";
export const HOVER_GRACE_MS = 250; // the time the pointer has to cross from a node to its tooltip (and back)
const native = (n: NetNode) => n.id.slice(n.database.length + 1);
const curve = (c: Cubic) => `M${c.from.x},${c.from.y} C${c.c1.x},${c.c1.y} ${c.c2.x},${c.c2.y} ${c.to.x},${c.to.y}`;
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const activate = (e: KeyboardEvent, act: () => void) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    act();
  }
};

// The card of an entry in the list (the query panel or a match panel), if it has one: step-2 entries do not.
function cardOf(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-match="${CSS.escape(id)}"], [data-query="${CSS.escape(id)}"]`);
}
export function showCard(id: string) {
  const card = cardOf(id);
  if (!card) return;
  card.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "center" });
  card.focus({ preventScroll: true });
}

// The reverse pairing: from a card, focus its node (which also shows its tooltip and highlights the card).
export function showInNetwork(id: string) {
  const node = document.querySelector<SVGGElement>(`[data-testid="network"] [data-node="${CSS.escape(id)}"]`);
  if (!node) return;
  const section = node.closest("details");
  if (section) section.open = true;
  node.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "center", inline: "center" });
  asked = true; // an explicit request from a card: show the tooltip even when the pointer made it
  node.focus({ preventScroll: true });
  asked = false;
}
// A pointer click focuses the chip, but that must not pin the tooltip: only keyboard focus (or showInNetwork) drives it.
let asked = false;

function ariaLabel(n: NetNode, via?: NetNode): string {
  const head = `${n.name}, ${n.database}, ${n.id}`;
  if (n.role === "query") return `${head}. The query.`;
  const hit = `identity ${pct(n.hit!.identity)}, ${TYPE_LABEL[n.hit!.type].toLowerCase()}`;
  if (n.role === "step2") return `${head}. Match of ${via?.name ?? n.via} (${n.via}), not a match of the query; ${hit} between them. Press Enter to make it the query.`;
  const flag = n.best ? (n.weak ? ", highest identity shown (weak evidence)" : ", best") : n.below ? ", below 90% identity, weak evidence of equivalence" : "";
  return `${head}. ${hit}${flag}. Press Enter to make it the query.`;
}

export function NetworkView({
  index,
  query,
  minIdentity,
  onNavigate,
  highlight,
  onHighlight,
}: {
  index: Index;
  query: Entry;
  minIdentity: number;
  onNavigate: (id: string) => void; // the parent pushes a history entry and searches for it
  highlight: string | null; // entry id highlighted from the picture or from its card
  onHighlight: (id: string | null) => void;
}) {
  // Expansion belongs to one query: a state for another query counts as empty, so it resets without an effect.
  const [exp, setExp] = useState<{ for: string; ids: string[] }>({ for: query.id, ids: [] });
  const expanded = exp.for === query.id ? exp.ids : [];
  useEffect(() => {
    if (exp.for !== query.id) setExp({ for: query.id, ids: [] }); // forget it for good: coming back to an entry starts collapsed
  }, [exp.for, query.id]);
  // The node the tooltip and the highlight follow: the most recent of the pointer and the keyboard focus (a pointer
  // resting on a node must not override Tab). Leaving with the pointer falls back to the focused node, if any.
  const [active, setActive] = useState<string | null>(null);
  const focused = useRef<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const navigated = useRef<string | null>(null); // the id a click or Enter asked for
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  const network = useMemo(() => buildNetwork(index, query.id, minIdentity, expanded), [index, query.id, minIdentity, expanded.join("\n")]);
  const vis = useMemo(() => visibleEdges(network), [network]);
  const layout = useMemo(() => layoutNetwork({ nodes: network.nodes, edges: vis.edges }), [network, vis]);
  const counts = useMemo(
    () => new Map(network.nodes.filter((n) => n.role === "match").map((n) => [n.id, ownMatchCount(index, n.id, minIdentity, query.id)])),
    [index, network, minIdentity, query.id],
  );
  const nodeById = new Map(network.nodes.map((n) => [n.id, n]));
  // A focused or hovered node can disappear (collapse, slider) without a blur event: forget it.
  useEffect(() => {
    if (active && !nodeById.has(active)) {
      if (focused.current === active) focused.current = null;
      setActive(null);
    }
  });

  const shown = dismissed ? null : active;
  useEffect(() => onHighlight(active), [active]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onHighlight(null), []); // eslint-disable-line react-hooks/exhaustive-deps
  // Escape dismisses the tooltip wherever the focus is (WCAG 1.4.13): the pointer may be the one that opened it.
  useEffect(() => {
    if (!shown) return;
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && setDismissed(true);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown]);
  // WCAG 1.4.13 (hoverable): the pointer can travel from the node to the tooltip, across the gap between them, without
  // it vanishing. Leaving the node (or the tooltip) starts a short delay; entering either cancels it.
  const leave = useRef<ReturnType<typeof setTimeout>>(undefined);
  const stopLeave = () => clearTimeout(leave.current);
  useEffect(() => stopLeave, []);
  const hoverNode = (id: string, on: boolean) => {
    stopLeave();
    if (on) {
      setDismissed(false);
      setActive(id);
    } else leave.current = setTimeout(() => setActive(focused.current), HOVER_GRACE_MS);
  };
  const focusNode = (id: string, on: boolean) => {
    setDismissed(false);
    focused.current = on ? id : null;
    setActive((cur) => (on ? id : cur === id ? null : cur));
  };

  // After a click or Enter on a node the clicked chip is gone: keep keyboard focus in the picture, on the new query.
  useEffect(() => {
    const wanted = navigated.current;
    navigated.current = null;
    if (wanted !== query.id) return; // the parent did not move to the clicked entry: do not steal focus later
    svgRef.current?.querySelector<SVGGElement>('[data-role="query"]')?.focus();
  }, [query.id]);

  const shownNode = shown ? nodeById.get(shown) : undefined;
  const tip = useMemo(() => (shownNode ? tooltip(shownNode, index.entries[shownNode.id]!) : null), [shownNode, index]);
  // The tooltip sits under the node, or above it when there is no room, and is clamped into the figure. It follows its
  // node when the box scrolls sideways (from #25 the expanded picture is wider than the left rail, and Tab to a node off
  // to the side scrolls the box first), and is hidden while its node is outside the visible box. The tooltip lives in
  // the wrap, so a window resize or a scroll of the rail moves it with the figure and needs no call.
  const place = () => {
    const t = tipRef.current;
    const wrap = wrapRef.current;
    const chip = shown && svgRef.current?.querySelector(`[data-node="${CSS.escape(shown)}"] .net-hit`);
    if (!t || !wrap || !chip) return;
    const view = scrollRef.current?.getBoundingClientRect();
    const c = chip.getBoundingClientRect();
    t.style.visibility = view && (c.right <= view.left || c.left >= view.right) ? "hidden" : "";
    t.style.left = "0px"; // measure at the left edge, where the box has its widest room (its final width)
    t.style.top = "0px";
    const [w, r] = [wrap.getBoundingClientRect(), chip.getBoundingClientRect()];
    const [tw, th, gap] = [t.offsetWidth, t.offsetHeight, 8];
    const clamp = (v: number, max: number) => Math.max(0, Math.min(v, max));
    const centred = clamp(r.left - w.left + r.width / 2 - tw / 2, w.width - tw);
    const middle = clamp(r.top - w.top + r.height / 2 - th / 2, w.height - th);
    // Below the node, else above it, else beside it (right, then left): never over the node, always inside the figure.
    const [below, above] = [r.bottom - w.top + gap, r.top - w.top - th - gap];
    const [right, left] = [r.right - w.left + gap, r.left - w.left - tw - gap];
    const at = below + th <= w.height ? { x: centred, y: below } : above >= 0 ? { x: centred, y: above } : right + tw <= w.width ? { x: right, y: middle } : left >= 0 ? { x: left, y: middle } : { x: centred, y: middle };
    t.style.left = `${at.x}px`;
    t.style.top = `${at.y}px`;
  };
  useLayoutEffect(place, [shown, tip, layout]); // eslint-disable-line react-hooks/exhaustive-deps

  // An expand adds a column to the right, which in the rail is outside the box: bring it into view so the new matches
  // of matches are seen rather than missed (#25). Only when a column was added, never on collapse or slider moves.
  const lastExpanded = useRef(0);
  useEffect(() => {
    const box = scrollRef.current;
    if (box && expanded.length > lastExpanded.current && box.scrollWidth > box.clientWidth) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      box.scrollTo({ left: box.scrollWidth, behavior: reduce ? "auto" : "smooth" });
    }
    lastExpanded.current = expanded.length;
  }, [expanded.length]);

  const toggle = (id: string) => setExp({ for: query.id, ids: expanded.includes(id) ? expanded.filter((x) => x !== id) : [...expanded, id] });
  const go = (id: string) => {
    if (id === query.id) return;
    navigated.current = id;
    onNavigate(id);
  };

  const step2 = network.nodes.filter((n) => n.role === "step2").length;
  const matches = network.nodes.filter((n) => n.role === "match").length;
  const label = `Network of ${query.id} and its ${matches} shown ${matches === 1 ? "match" : "matches"}${step2 ? `, with ${step2} ${step2 === 1 ? "match" : "matches"} of matches` : ""}. The list of cards has the same matches in text.`;
  const hl = (id: string) => (highlight === id ? " is-hl" : "");

  return (
    <figure className="mt-2" data-testid="network-figure">
      {/* Notes that qualify the picture sit above it, so they are seen with it even when the rail scrolls (#25). */}
      {step2 > 0 || expanded.length > 0 ? (
        <p className="mb-2 text-sm text-muted" data-testid="network-step2-note">
          A match of a match is not a match of the query. On a dashed chip, identity, coverage and type are between that chip and the entry named on
          it, not the query.
          {vis.hidden > 0 ? ` ${vis.hidden} reverse ${vis.hidden === 1 ? "hit" : "hits"} back to the query (expected for a reciprocal pair) ${vis.hidden === 1 ? "is" : "are"} not drawn.` : ""}
          {vis.merged > 0 ? ` ${vis.merged} reciprocal ${vis.merged === 1 ? "link" : "links"} between matches ${vis.merged === 1 ? "is" : "are"} drawn once, as a line with two arrowheads.` : ""}
        </p>
      ) : null}
      {network.truncated && (
        <p className="mb-2 text-sm text-muted" data-testid="network-cap">
          Showing {network.nodes.length} of {network.nodes.length + network.truncated.dropped} nodes: the limit is {MAX_NODES}, so {network.truncated.dropped} lower-ranked (identity, then id) {network.truncated.dropped === 1 ? "match" : "matches"} of matches {network.truncated.dropped === 1 ? "is" : "are"} not drawn. Collapse one of the expanded matches to see others.
        </p>
      )}
      <div ref={wrapRef} className="net-wrap">
        <div ref={scrollRef} className="net-scroll" tabIndex={0} role="region" aria-label="Network picture, scrolls sideways when it is wider than its box" onScroll={place}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            width={layout.width}
            height={layout.height}
            role="group"
            aria-label={label}
            data-testid="network"
            className={`net-svg${highlight ? " net-dim" : ""}`}
          >
            <defs>
              {(["main", "soft", "hl"] as const).map((k) => (
                <marker key={k} id={`net-arrow-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 L2.5,5 z" className={`net-arrowhead net-arrowhead-${k}`} />
                </marker>
              ))}
              {layout.nodes.map((s, i) => (
                <clipPath key={s.id} id={`net-clip-${i}`}>
                  <path d={chipPath(s.rect, DB_SHAPE[nodeById.get(s.id)!.database])} />
                </clipPath>
              ))}
            </defs>
            {layout.heads.map((h) => (
              <text key={h.column} x={h.x} y={h.y} className="net-head">
                {HEAD[h.column]}
              </text>
            ))}
            <g>
              {layout.edges.map((e, i) => {
                const m = vis.edges[i]!;
                const on = highlight !== null && (e.source === highlight || e.target === highlight);
                const tone = on ? "hl" : e.step === 2 ? "soft" : "main";
                const text = e.kind === "query" ? pct(m.identity) : "match of a match";
                const pill = e.label && pillRect(e.label, text.length, PILL.labelH);
                return (
                  <g
                    key={`${e.source}>${e.target}`}
                    className={`net-edge${on ? " is-hl" : ""}`}
                    data-edge={`${e.source}>${e.target}`}
                    data-type={m.type}
                    data-step={e.step}
                    data-kind={e.kind}
                    aria-hidden="true"
                  >
                    <path d={curve(e.path)} markerEnd={`url(#net-arrow-${tone})`} markerStart={m.type === "RBH" ? `url(#net-arrow-${tone})` : undefined} />
                    {pill && (
                      <g className="net-pill">
                        <rect x={pill.x} y={pill.y} width={pill.width} height={pill.height} rx={pill.height / 2} />
                        <text x={e.label!.x} y={e.label!.y}>{text}</text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
            <g>
              {layout.nodes.map((s, i) => {
                const n = network.nodes[i]!;
                const via = n.via ? nodeById.get(n.via) : undefined;
                return (
                  <g key={n.id}>
                    <Chip
                      slot={s}
                      node={n}
                      via={via}
                      clip={`net-clip-${i}`}
                      cls={hl(n.id)}
                      describedby={shown === n.id}
                      onActivate={() => go(n.id)}
                      onShowCard={() => showCard(n.id)}
                      onHover={(on) => hoverNode(n.id, on)}
                      onFocus={(on) => focusNode(n.id, on)}
                    />
                    {s.expand && counts.get(n.id)! > 0 && (
                      <ExpandPill slot={s} node={n} count={counts.get(n.id)!} open={expanded.includes(n.id)} onToggle={() => toggle(n.id)} />
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
        {shown && tip && shownNode && (
          <div ref={tipRef} id="net-tip" role="tooltip" className="net-tip" data-testid="network-tooltip" onMouseEnter={stopLeave} onMouseLeave={() => hoverNode(shown, false)}>
            {tip.lines.map((l, i) => (
              <div key={i} data-line className={i === 0 ? "font-semibold" : undefined}>
                {l}
              </div>
            ))}
            <p className="net-tip-hint">
              Press Enter to make this the query.
              {cardOf(shownNode.id) ? " Press L to show its card in the list." : " It is not in the list: it is a match of a match."}
              {tip.truncated ? " The phenotype is cut here; the full text is in the list." : ""}
            </p>
          </div>
        )}
      </div>
      <figcaption className="mt-2 text-sm text-muted">
        <ul className="net-legend" aria-label="Legend">
          {(["card", "ncbi", "resfinder"] as const).map((d) => (
            <li key={d}>
              <svg width={SWATCH.width} height={SWATCH.height} viewBox={`0 0 ${SWATCH.width} ${SWATCH.height}`} aria-hidden="true">
                <path d={chipPath(SWATCH.chip, DB_SHAPE[d])} className="net-swatch" data-db={d} />
              </svg>
              {BADGE[d]} ({{ card: "rounded", ncbi: "cut corners", resfinder: "pill" }[d]})
            </li>
          ))}
          <li>
            <Swatch type="RBH" />
            RBH, reciprocal best hit
          </li>
          <li>
            <Swatch type="OWH" />
            OWH, one-way hit
          </li>
          <li>
            <svg width={SWATCH.width} height={SWATCH.height} viewBox={`0 0 ${SWATCH.width} ${SWATCH.height}`} aria-hidden="true">
              <path d={chipPath(SWATCH.chip, "round")} className="net-swatch net-swatch-step2" />
            </svg>
            Match of a match (dashed)
          </li>
          <li>
            <RibbonSwatch kind="best" />
            highest identity in its database
          </li>
          <li>
            <RibbonSwatch kind="weak" />
            the same, in a group below 90%
          </li>
          <li>
            <RibbonSwatch kind="below" />
            below 90% and not the highest: weak evidence
          </li>
        </ul>
        {/* One sentence (#22); the full wording, unchanged, is under How to read this, "Network picture". */}
        <p className="mt-2" data-testid="network-note">
          The same matches as the cards, with identity on each arrow; click a node or press Enter to make it the query (more under How to read this).
        </p>
        <p className="sr-only" role="status" data-testid="network-status">
          {step2 > 0 ? `${step2} ${step2 === 1 ? "match" : "matches"} of matches shown, not matches of the query.` : ""}
        </p>
      </figcaption>
    </figure>
  );
}

// The Best ribbon as drawn on a chip, at its real size and with the same classes, so the key cannot drift from the marks.
function RibbonSwatch({ kind }: { kind: RibbonKind }) {
  const w = RIBBON_W[kind];
  return (
    <svg width={w + 2} height={RIBBON_H + 2} viewBox={`-1 -1 ${w + 2} ${RIBBON_H + 2}`} aria-hidden="true" data-swatch={SWATCH_NAME[kind]}>
      <g className="net-ribbon" data-weak={kind !== "best" || undefined}>
        <rect x={0} y={0} width={w} height={RIBBON_H} rx={RIBBON_H / 2} />
        <text x={w / 2} y={RIBBON_H / 2}>{RIBBON_TEXT[kind]}</text>
      </g>
    </svg>
  );
}

function Swatch({ type }: { type: "RBH" | "OWH" }) {
  return (
    <svg width={SWATCH.width} height={SWATCH.height} viewBox={`0 0 ${SWATCH.width} ${SWATCH.height}`} aria-hidden="true">
      <g className="net-edge" data-type={type}>
        <path
          d={`M${SWATCH.line.from.x},${SWATCH.line.from.y} L${SWATCH.line.to.x},${SWATCH.line.to.y}`}
          markerEnd="url(#net-arrow-main)"
          markerStart={type === "RBH" ? "url(#net-arrow-main)" : undefined}
        />
      </g>
    </svg>
  );
}

// One chip: outline in the database's shape, a database badge with its name as text, up to three lines of text, the
// Best ribbon, and an invisible rectangle (the click target, the size of the chip) on top.
function Chip({
  slot,
  node: n,
  via,
  clip,
  cls,
  describedby,
  onActivate,
  onShowCard,
  onHover,
  onFocus,
}: {
  slot: NodeSlot;
  node: NetNode;
  via?: NetNode;
  clip: string;
  cls: string;
  describedby: boolean;
  onActivate: () => void;
  onShowCard: () => void;
  onHover: (on: boolean) => void;
  onFocus: (on: boolean) => void;
}) {
  const shape = DB_SHAPE[n.database];
  const query = n.role === "query";
  const [l1, l2, l3] = slot.lines;
  const detail = query ? "Query" : `${pct(n.hit!.identity)} · ${n.hit!.type}`;
  const second = n.role === "step2" ? ellipsize(`match of ${via?.name ?? n.via}`, DETAIL_MAX) : ellipsize(native(n), ID_MAX);
  const kind: RibbonKind | null = n.role !== "match" ? null : n.best ? (n.weak ? "weak" : "best") : n.below ? "below" : null;
  const ribbon = kind ? ribbonRect(slot, kind) : null;
  return (
    <g
      className={`net-node${cls}`}
      data-node={n.id}
      data-role={n.role}
      data-db={n.database}
      data-shape={shape}
      data-best={n.role === "match" && n.best ? (n.weak ? "highest" : "best") : undefined}
      data-below={n.below || undefined}
      data-via={n.via}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel(n, via)}
      aria-disabled={query || undefined}
      aria-describedby={describedby ? "net-tip" : undefined}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === "l" || e.key === "L") {
          if (!e.ctrlKey && !e.metaKey && !e.altKey) onShowCard();
        } else activate(e, onActivate);
      }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={(e) => (asked || e.currentTarget.matches(":focus-visible")) && onFocus(true)}
      onBlur={() => onFocus(false)}
    >
      <path className="net-shape" d={chipPath(slot.rect, shape)} />
      <rect className="net-badge" x={slot.badge.x} y={slot.badge.y} width={slot.badge.width} height={slot.badge.height} clipPath={`url(#${clip})`} />
      <text className="net-badge-text" x={slot.badgeText.x} y={slot.badgeText.y}>{BADGE[n.database]}</text>
      <text className="net-name" x={l1.x} y={l1.y}>{ellipsize(n.name, query ? QUERY_NAME_MAX : NAME_MAX)}</text>
      <text className="net-sub" x={l2.x} y={l2.y}>{query ? ellipsize(native(n), ID_MAX) : second}</text>
      <text className="net-detail" x={l3.x} y={l3.y}>{detail}</text>
      {ribbon && (
        <g className="net-ribbon" data-weak={kind !== "best" || undefined} data-cue={kind}>
          <rect x={ribbon.x} y={ribbon.y} width={ribbon.width} height={ribbon.height} rx={ribbon.height / 2} />
          <text x={ribbon.x + ribbon.width / 2} y={ribbon.y + ribbon.height / 2}>{RIBBON_TEXT[kind!]}</text>
        </g>
      )}
      <rect className="net-hit" x={slot.hit.x} y={slot.hit.y} width={slot.hit.width} height={slot.hit.height} />
    </g>
  );
}

// The "+n" pill on the right edge of a match: a button of its own (Tab reaches it after its chip) that adds or
// removes that entry's own matches. Its name says what it does and how many matches it promises.
function ExpandPill({ slot, node: n, count, open, onToggle }: { slot: NodeSlot; node: NetNode; count: number; open: boolean; onToggle: () => void }) {
  const text = open ? MINUS : `+${count}`;
  const p = pillRect(slot.expand!.centre, text.length, EXPAND_H);
  const hit = slot.expand!.hit;
  return (
    <g
      className={`net-expand${open ? " is-open" : ""}`}
      data-expand={n.id}
      role="button"
      tabIndex={0}
      aria-expanded={open}
      aria-label={`${open ? "Collapse" : "Expand"} matches of ${n.name} (${count})`}
      onClick={onToggle}
      onKeyDown={(e) => activate(e, onToggle)}
    >
      <rect className="net-expand-hit" x={hit.x} y={hit.y} width={hit.width} height={hit.height} />
      <rect className="net-expand-pill" x={p.x} y={p.y} width={p.width} height={p.height} rx={p.height / 2} />
      <text x={slot.expand!.centre.x} y={slot.expand!.centre.y}>{text}</text>
    </g>
  );
}
