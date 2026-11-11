# Network view (ticket #11)

A small SVG picture of the query and the matches the list currently shows (same groups, same minimum identity). The list stays the accessible equivalent; the SVG has `role="img"` with a title and a description naming every match.

## One position function

`src/layout.ts` `pixel(column, row, orientation)` is the only place a slot becomes a pixel. Node centres, edge endpoints and label anchors all call it. There is no hit test, because the picture is not interactive (deferred).

Constants (viewBox units): width 360, row 40, vertical padding 12, query column x 60, neighbour column x 156, edge clearance 13, label gap 14, query label 16 above its centre. Neighbours are listed in the order of the list (database, then identity descending), one row each; the query is centred on the rows at row (n - 1) / 2. Height is 2 * 12 + 40 * n.

`ltr` puts the query on the left. `rtl` is the mirror: x becomes 360 - x, y is unchanged, label anchors flip to the other side. The app uses `ltr`; `rtl` exists so the flipped case is tested.

## Hand-worked pixels (n = 3)

Row centre y = 12 + 40 * row + 20. Query row 1 gives (60, 72). Neighbour rows 0, 1, 2 give y 32, 72, 112 at x 156.

| Case | Result |
| --- | --- |
| First neighbour, ltr | centre (156, 32); label (156 + 14, 32) = (170, 32), start |
| Last neighbour, ltr | centre (156, 112); label (170, 112) |
| Last edge, ltr | vector from query (96, 40), length sqrt(9216 + 1600) = 104, unit (12/13, 5/13), clearance 13 gives offset (12, 5); from (72, 77) to (144, 107) |
| First neighbour, rtl (mirror) | centre (360 - 156, 32) = (204, 32); label (204 - 14, 32) = (190, 32), end; query (300, 72) |
| Last edge, rtl | from (288, 77) to (216, 107) |

The expected values in `src/layout.test.ts` are these numbers, not computed by the code under test.

## Encodings

- Edges run from the query (arrowhead at the match). RBH: solid line with arrowheads at both ends (a reciprocal pair). OWH: dashed line, one arrowhead (a one-way hit; the reverse is not implied).
- Best: square node and the text "best" in the label. In a group whose top identity is below 90% (same rule as the list) the text reads "highest" and the square has no accent fill, never "best". Ties are all best, as in the list.
- Identity is text in the label (one decimal, the same formatting as the list). Edge width does not encode identity (not used, so nothing to map).
- Colours are `var(--fg)`, `var(--muted)`, `var(--surface)`, `var(--accent)` only. Colour never carries a category.
- Labels: database and native id, cut to 24 characters with an ellipsis; the full id and name are in the node tooltip (`<title>`) and the list. The longest native id in graph-2026.11.09 is 23 characters and the database prefix takes up to 10, so long ids are cut and two ids sharing a long prefix can look alike (deferred; the list shows them in full); checked visually on the six-match entry card:ARO:3002546 (the maximum out-degree).
- The query node is filled with the text colour, so the accent fill means best only.
- Zero matches: nothing is drawn; the list says so.

The interactive network (tickets #9 and #10) has its own geometry in `src/networkLayout.ts`, described in `network-layout.md`; this file's `layout.ts` is retired when the UI tickets wire it in.

## Comparison strip bars (#20, ADR 0006)

The bars in the at-a-glance strip have their own single mapping, `scale(value, width)` in `src/bars.ts`, with a bar width W of 200 px: `length = min(max(value, 0), 1) x W`, and `overflow` is true when the value is above 1 (a coverage over 100% is drawn full length with a chevron, and its exact percentage is printed). The weak-evidence line is drawn at `scale(0.90)` = 180 px and the minimum identity line at `scale(slider / 100)`, so 180 px at 90% and 160 px at 80%. The minimum identity line is drawn first and the dashed weak line on top, so both stay visible when they coincide. Hand-worked values: `tests/fixtures/README.md`, "Bar scale"; tests: `src/bars.test.ts` and `tests/comparison.spec.ts`.
