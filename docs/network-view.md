# Network view (tickets #9 and #10)

The picture of the query and its matches is the interactive SVG in `src/NetworkView.tsx`. Its geometry, the hand-worked pixels and the limits are in [network-layout.md](network-layout.md); the model it draws is in [data-contract.md](data-contract.md) ("Network model and expansion"). The small picture of ticket #11 and its `src/layout.ts` are retired.

## What the picture shows

- Three columns: the query, its shown matches (the same matches, order, identity, type and Best flags as the list below, at the same minimum identity), and, after an expand, the matches of those matches.
- A chip per entry: a database badge with the database name as text, then name, native id and identity with type. The outline shape also carries the database (CARD rounded, NCBI cut corners, ResFinder pill). The query is a larger chip.
- Best is a ribbon reading "Best"; in a group whose top identity is below 90% it reads "Highest identity shown" (the same rule as the list: the model's weak flag, `isWeakGroup`). Step-2 chips carry no ribbon: their flags are relative to the entry they are a match of, not to the query.
- Edges are directed from the query. RBH: solid, arrowheads at both ends (a reciprocal pair). OWH: dashed, one arrowhead (the reverse direction is not implied). The identity is in a pill on every step-1 edge.
- Long names and ids are cut with an ellipsis (19 characters for a name, 24 for an id, 16 for the query name); the full text is in the tooltip and the card.

## Interaction

- Every chip is a focusable button (`role="button"`, `tabindex="0"`, an accessible name with entry, database, identity, type and Best). Click or Enter makes it the query: the parent pushes one history entry, so Back and Forward step through the explored entries (the slider and the database filter keep `replaceState`). Focus moves to the new query chip. A database filter that would hide the clicked entry is cleared.
- Hover or focus shows a tooltip (`role="tooltip"`, `aria-describedby`; lines from `src/networkTooltip.ts`), highlights the node, its edges and its card in the list; hovering or focusing a card highlights its node. Escape dismisses the tooltip. It sits below the node, above it, or beside it, and stays inside the figure. L on a node moves focus to its card; "Show in network" on a card focuses its node.
- A "+n" pill on a match is a separate button ("Expand matches of X (n)", `aria-expanded`); it adds that entry's own matches in a third column ("Matches of a match"), dashed and lighter, each labelled "match of X" on its chip. The caption says a match of a match is not a match of the query. A step-2 hit that is also a match of the query is not a new node: a lighter link between the two existing nodes is drawn and labelled "match of a match". Step-2 edges carry no identity label. The reverse hit from an RBH match back to the query (expected from reciprocity) is hidden and counted in the caption. Expansion is React state: not in the address, reset when the query changes. The 25 node cap shows one line of text (`network-cap`).
- The figure keeps its design width inside its own box (`overflow-x: auto`, `tabindex="0"`, labelled) so a node stays at least 44 CSS pixels at any width; the page itself does not scroll sideways. On a wide screen the section widens past the text column so the three column picture fits. A second, portrait layout for narrow screens is a follow-up.
- `prefers-reduced-motion: reduce`: no entrance animation or transition.

## Comparison strip bars (#20, ADR 0006)

The bars in the at-a-glance strip have their own single mapping, `scale(value, width = 200)` in `src/bars.ts`: `length = min(max(value, 0), 1) x W` with W = 200 px, and `overflow` when the value is above 1 at the displayed precision (`round(value x 1000) > 1000`), so a coverage printed as 100.0% never gets the mark. A coverage over 100% is drawn full length with a chevron, and its exact percentage is printed beside it.

| Value | Arithmetic | Length (px) | Overflow |
| --- | --- | --- | --- |
| 0 | 0 x 200 | 0 | no |
| 0.5 | 0.5 x 200 | 100 | no |
| 0.9 (weak line) | 0.9 x 200 | 180 | no |
| 1.0 | 1.0 x 200 | 200 | no |
| 1.3 (a coverage) | min(1.3, 1) x 200 | 200 | yes |

The weak-evidence mark is a dashed `--danger` line at `scale(0.90)` = 180 px, labelled "90%" above the bar, on the identity bar only. It is an interpretation, not a filter. The minimum identity is not drawn on the bars: every shown bar is at or above it by definition, so a line for it repeated the slider and was read as a second threshold (owner decision, 2026-11-11). The line sits on a 5 px `--surface` halo, so it is read against `--surface` (4.5:1 for `--danger`) where it crosses the bar fill. Hand-worked values: `tests/fixtures/README.md`, "Bar scale"; tests: `src/bars.test.ts` and `tests/comparison.spec.ts`.
