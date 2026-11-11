# Network layout (tickets #9 and #10)

Geometry for the interactive network. `src/networkLayout.ts` is pure: nothing in it touches the DOM. The model it draws is `src/networkModel.ts` (`docs/data-contract.md`, "Network model and expansion"); the UI is `src/NetworkView.tsx` (`network-view.md`). The UI adds no coordinate of its own: every offset is a named constant here or a field of the layout it returns. (The tooltip is placed from the measured box of the node, which is browser layout, not diagram geometry.)

## One position function

`pixel(column, row, count, rows)` is the only place a slot becomes a pixel. Chip rectangles, text baselines, edge ends, the ribbon, the expand pill, tooltip anchors and click targets all derive from it (through `layoutNetwork`). Column 0 is the query, 1 the matches, 2 the step-2 nodes (matches of an expanded match); `count` is the number of nodes in that column and `rows` the number in the tallest column (at least 1).

```
x = MARGIN_X + COL_GAP * column
y = HEADER + PAD + ROW * ((rows - count) / 2 + row) + ROW / 2
```

A shorter column is centred on the tallest one. The query is on the middle row of the tallest column. Nodes within a column keep the model order (step 1 in list order, step 2 by via).

## Constants (viewBox units, not CSS pixels)

| Constant | Value | Meaning |
| --- | --- | --- |
| ROW | 64 | vertical space per node: a 52 chip plus a 12 gap (room for the ribbon overhang) |
| PAD, HEADER | 16, 32 | space above the first row and below the last, and the band for column headings (baseline 20) |
| SIDE | 16 | space left of the query chip and right of the last chip |
| QUERY_W, QUERY_H | 224, 72 | the query chip |
| CHIP_W, CHIP_H | 248, 52 | a match or step-2 chip; 52 is at least 44, so the chip is its own click target |
| MARGIN_X | 128 | column 0 centre: SIDE + QUERY_W / 2 |
| COL_GAP | 376 | distance between column centres (128 between a match chip and the next column, room for the edge and its pill) |
| BADGE_W, TEXT_PAD | 64, 10 | database badge width; text starts BADGE_W + TEXT_PAD from the chip's left edge |
| LINE, QUERY_LINE | 20, 34, 47 and 28, 45, 61 | baselines of the three text lines from the chip top |
| RIBBON | 14 high, 7 above the chip, 12 inset, 48 wide ("Best"), 136 ("Highest identity shown") or 80 ("Below 90%") | |
| LABEL_TS, LABEL_CLEAR, SAMPLES | 0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8; 2; 32 | places tried for a "match of a match" label, how far a pill is grown when testing, samples per other edge |
| EXPAND_HIT, EXPAND_H, EXPAND_R | 44, 20, 20 | click target of the "+n" pill (centred on the chip's right edge), drawn pill height, and how far right of the chip a step-2 edge starts |
| FAN | 8 | spacing of the points where step-1 edges leave the query chip, at most (QUERY_H - 16) / (edges - 1) |
| LINK_INSET, QUERY_LINK, BOW | 16, 30, 84 | a link between two matches leaves 16 from the chip centre and bows 84 right; a link back to the query enters 30 below its centre |
| LABEL_T, LINK_T | 0.7, 0.5 | position of the identity pill (step 1) and of the "match of a match" label on the curve |
| PILL | pad 12, 6 per character, label height 18 | width of a pill grows with its text |
| NAME_MAX, ID_MAX, DETAIL_MAX, QUERY_NAME_MAX | 19, 22, 24, 14 | characters per line before an ellipsis (`ellipsize`) |

Size from content: height = max(HEADER + 2 * PAD + ROW * rows, lowest edge sample or label + PAD); width = max(x of the last used column + half its chip + SIDE, furthest right any edge sample (t = k / 32) or "match of a match" pill reaches + SIDE) (query only 256, with matches 644, with step-2 nodes 1020). Zero nodes gives 256 by 128. At the cap (1 query, 6 matches, 18 step-2 nodes) rows = 18 and the height is 1216.

## Edges

All edges are cubic curves that leave and enter horizontally (`from`, two controls half the horizontal distance out, `to`).

- Step 1 (`query`): from the query chip's right edge, fanned (FAN) around its centre, to the match chip's left edge at its centre; the identity pill is at t = 0.7.
- Step 2 to a new node (`expand`): from 20 right of the match chip (clear of the pill) to the step-2 chip's left edge; no label.
- Step 2 to an existing match (`link`): a curve on the right of the column, from 16 below (or above) the chip centre to 16 above (or below) the other, bowing 84; label at t = 0.5.
- Step 2 back to the query (`back`): from the match chip's left edge, 16 below its centre, to the query chip's right edge 30 below its centre; label at t = 0.5. Hidden by default when it is the reverse of an RBH match (`visibleEdges` in the model); drawn for a one-way match, where it is a separate hit.

## Label placement

Identity pills sit at t = 0.7 of their edge. A "match of a match" label (a `link` or `back` edge) is placed by `placeLabel`: for each t in LABEL_TS in order, the pill (12 + 6 * 16 = 108 wide, 18 high) is put on the curve; it is charged 1 for every sample (t = k / 32) of every other edge inside it grown by 2, and 10 for every identity pill or earlier label it overlaps. The first t with no charge wins; if none is clear, the cheapest, the earlier in the list on a tie.

Worked case (fixture D: matches at y 80, 144, 208, a horizontal expand edge at y = 144 from x 648 to 756, the link from (628, 96) to (628, 192) with controls at x = 712). y(t) = 96 + 96 * (3ut^2 + t^3), x(t) = 628 * (u^3 + t^3) + 712 * 3ut. At t = 0.5: (691, 144), pill y 135 to 153, grown 133 to 155: the line y = 144 is inside, so it is charged. At t = 0.4 (u = 0.6): 3ut^2 = 0.288, t^3 = 0.064, y = 96 + 0.352 * 96 = 129.792, x = 628 * 0.28 + 712 * 0.72 = 688.48; pill y 120.792 to 138.792, grown to 140.792: clear. So the label is at (688.48, 129.792). Fixture A (the step-2 edges from the last match cross t = 0.5 and 0.4) has no clear place; t = 0.4 touches least (4 samples), see the tests. Fixture A's back link: t = 0.2 (2 samples) beats t = 0.5. An independent Python re-implementation (not shared with the app) gave the same three results.

Limits: a crowded picture (four links in the same strip, `card:ARO:3002546`) still has some contact (7, 2, 0 and 7 samples, against 7, 10, 24 and 8 at t = 0.5). Chips are not obstacles.

### Size with a link and no step-2 column (fixture E)

A link between two matches bows 63 right of the chip edge (x(0.5) = 628 + 0.75 * 84 = 691 at the chip edge 628) and its label is 108 wide, so a picture with no step-2 column was clipped (owner bug, card:ARO:3000230 at 90%, first expand pill). Fixture E: query, matches m0 and m1 (rows = 2, y 80 and 144), link m0 to m1 from (628, 96) to (628, 128), controls x 712. Label at t = 0.5: (691, 112), pill x 637 to 745. Width = max(644, 745 + 16) = 761; the curve itself reaches 691 only. Height = max(192, 121 + 16) = 192. Without the link the width is the plain 644. Tests: `src/networkLayout.test.ts` (fixture E and an every-sample-inside check) and `tests/network-release.spec.ts` (every drawn edge, pill and chip inside the svg's box at 390, 700 and 1000 px).

## Click targets

`hitRegions` returns the chip rectangles (each at least 44 by 44, never overlapping: ROW 64 is more than the 52 chip). `expandRegions` returns the 44 by 44 square of each "+n" pill, centred on the chip's right edge; it overlaps only its own chip. 44 viewBox units are 44 CSS pixels only when the figure is drawn at its own width, so the UI never scales the SVG down: a landscape figure wider than its box scrolls sideways inside it, and below 640 px the figure is drawn portrait at the box's width (see Portrait).

## Hand-worked pixels

Fixture A: query, 3 matches, 3 step-2 nodes (rows = 3). Height = 32 + 2 * 16 + 64 * 3 = 256; width = 880 + 124 + 16 = 1020. Column x: 128, 128 + 376 = 504, 128 + 752 = 880.

| Case | Arithmetic | Result |
| --- | --- | --- |
| Query centre | count 1, offset (3 - 1) / 2 = 1: y = 48 + 64 + 32 | (128, 144) |
| First, last match | y = 48 + 32; 48 + 128 + 32 | (504, 80), (504, 208) |
| Step-2 slots | x = 128 + 2 * 376 | (880, 80), (880, 144), (880, 208) |
| Query chip | 128 - 112, 144 - 36, 224 by 72 | x 16, y 108 |
| Last match chip | 504 - 124, 208 - 26, 248 by 52 | x 380, y 182 |
| Last match text | x = 380 + 64 + 10; y = 182 + 20, 34, 47 | x 454, y 202, 216, 229 |
| Tooltip anchor | (504, 182 + 52) | (504, 234) |
| Ribbon, best | x = 628 - 12 - 48, y = 182 - 7 | (568, 175), 48 by 14 |
| Expand pill | right edge 380 + 248; hit 44 by 44 | centre (628, 208), hit (606, 186) |
| Fan out of the query | right edge 128 + 112 = 240; pitch min(8, 56 / 2) = 8; y = 144 + (k - 1) * 8 | (240, 136), (240, 144), (240, 152) |
| Edge, query to last match | from (240, 152) to (380, 208); dx = 70 | controls (310, 152), (310, 208) |
| Identity pill, last | t = 0.7, weights 0.027, 0.189, 0.441, 0.343: x = 6.48 + 58.59 + 136.71 + 130.34; y = 0.216 * 152 + 0.784 * 208 | (332.12, 195.904) |
| Step-2 edge, last match to middle step-2 node | from (628 + 20, 208) to (880 - 124, 144) | (648, 208) to (756, 144) |
| Link, first to last match | from (628, 80 + 16) to (628, 208 - 16), controls x 628 + 84 | label would be (0.25 * 628 + 0.75 * 712, 144) = (691, 144) at t = 0.5; moved, see Label placement: t = 0.4, (688.48, 129.792) |
| Back link, last match to query | from (380, 224) to (240, 174); controls (310, 224), (310, 174) | label would be (310, 199) at t = 0.5; moved: t = 0.2, (345.28, 218.8) (0.512 * 380 + 0.384 * 310 + 0.096 * 310 + 0.008 * 240; 0.896 * 224 + 0.104 * 174) |
| Centring, 2 matches beside 3 step-2 nodes | offset (3 - 2) / 2 = 0.5: y = 48 + 32 + 32, and + 64 | match rows 112 and 176 |
| Query only | width 128 + 112 + 16, height 32 + 32 + 64 | 256 by 128 |
| Chip outlines for a 248 by 52 rect at (364, 182) | corner 10, pill radius 26 | see `chipPath` tests |

The expected values in `src/networkLayout.test.ts` are these numbers, not computed by the code under test.

## Portrait (a phone)

`layoutNetwork(network, { orientation: "portrait", width })` draws the same network as one column. The UI chooses it when the box the figure sits in (`.net-wrap`) is narrower than `PORTRAIT_BELOW` = 640 CSS pixels (`orientationFor`), and measures the box with a `ResizeObserver` (a window resize redraws, expansion and query are kept). Why 640: the one-step landscape picture is 644 units wide and its box adds 4 padding and 1 border each side, so it needs 654; the sticky rail at 1152 px or more is 656 wide (641 with a 15 px classic scrollbar). 640 keeps the desktop rail landscape and turns every narrower box portrait, where the landscape picture would scroll sideways. The box width does not depend on the figure (the box clips it), so drawing portrait cannot flip the choice back. A container query could not be used: the coordinates are computed in JavaScript, so the width has to be known there. Tested on both sides (`tests/network-portrait.spec.ts`: boxes of 639, 640 and 641 px) and with a live resize.

The width is the room inside the box (portrait removes the box's 4 px padding, `.net-portrait`), at most `PORTRAIT_MAX_W` = 420 (a wider box centres the picture), at least `PORTRAIT_MIN_W` = 260. It is never scaled, so 1 unit is 1 CSS pixel and a chip (52) and an expand target (44 by 44) keep their touch size. Nothing scrolls sideways and the box is not a Tab stop (no `tabindex`, no `role="region"`).

### Rows and the one portrait position function

From the top: the query chip across the width; then one row per match in list order, each followed by its own step-2 nodes (the ones whose `via` it is, in model order). `pixelPortrait(depth, row, frame)` is the only place a row becomes a rectangle (depth 0 query, 1 match, 2 step-2; row counts the rows under the query from 0); `portraitFrame(width, lanes, maxBow)` gives its x extents. Chip text lines, badges, tooltip anchors, edge ends, the expand target and the labels all derive from those rectangles.

```
query:   x = P_SIDE, y = P_TOP, width = xr - P_SIDE, height = 72
a row:   x = chipX + (depth - 1) * INDENT, y = P_TOP + 72 + GAP + PROW * row, width = xr - x, height = 52
xr       = width - max(P_RIGHT, ceil(0.75 * deepest bow) + BOW_ROOM)       (P_RIGHT when there is no link)
pitch    = min(LANE, LANE_SPAN / (lanes - 1))      lanes = step-1 edges
firstLane = LANE_LEFT + (lanes - 1) * pitch        chipX = firstLane + ELBOW
height   = lowest chip bottom + P_BOTTOM
```

| Constant | Value | Meaning |
| --- | --- | --- |
| P_SIDE, P_TOP, P_BOTTOM | 12, 12, 12 | space left of the query chip, above it and below the last chip |
| P_RIGHT | 24 | right margin: the 44 target of the expand pill is centred on the right edge, 22 of it outside the chip |
| GAP, PROW | 28, 80 | between two chips (room for an 18 high label clear of the 7 high ribbon overhang), and one row: 52 + 28 |
| LANE, LANE_SPAN, LANE_LEFT, ELBOW | 5, 25, 24, 20 | where the step-1 lines leave the query's bottom edge (5 apart, at most 25 in all: more than six matches squeeze), x of the last lane, first lane to chip |
| INDENT, EXPAND_FROM | 28, 20 | a step-2 chip is this far right of a match chip; its line leaves the match's bottom edge 20 from its left edge (clear of a ResFinder pill's rounded end) |
| BOW_BASE, BOW_STEP, BOW_LEVELS, BOW_ROOM | 24, 8, 3, 8 | a link bows 24 right of the chips, 8 more for each further row spanned, at most 3 rows (24, 32, 40), so nested links do not coincide; the margin holds its reach (0.75 of the bow) plus 8 |
| PILL_DX, PILL_RISE | 22, 14 | an identity pill's centre is 22 right of its line and 14 above its chip's top edge |
| LABEL_DX, LABEL_DY | 48, 11 | a link label's centre is 48 left of the curve, 11 below the upper chip of its gap |
| TEXT_RESERVE, TEXT_AREA, MIN_CHARS | 16, 174, 4 | see Text limits |

### Edges

- Step 1 (`query`): a straight line (a cubic with its controls at the thirds) from the query's bottom edge to the middle of the match chip's left edge. Edge k (list order) leaves at x = firstLane - k * pitch: the first match has the right-most lane, so a later line is always left of an earlier one and no two cross. Each line has its own start, so a reciprocal edge's arrowhead at the query end is its own.
- Identity pill: its centre is 14 above the chip's top edge (in the gap above the chip) and 22 right of the line at that height, so its left end sits on the line and the pill covers no other line (the lines of later matches are left of this one and the earlier ones have already ended).
- Step 2 to a new node (`expand`): straight from 20 right of the match chip's left edge on its bottom edge to the middle of the step-2 chip's left edge. Several children share the start and fan out, never crossing a chip (the line stays left of the chip's left edge).
- Step 2 to an existing match (`link`) and to the query (`back`): a curve in the right margin, from the chip's right edge 16 below (or above) its middle to 16 above (or below) the other (the query: 20 below its middle), controls at x = xr + bow. It lies right of every chip's right edge, so it crosses no chip.
- Labels of links and back links go in a gap between two rows the curve passes, right end 6 past the curve (so the label is left of it, over the chip column's gap, never over a chip). The gap nearest the middle of the curve's span is tried first; a gap is clear when no other edge sample and no taken rectangle (chips, ribbons, expand pills, identity pills, earlier labels) is inside the label grown by 2 (`touchCost`, the same cost as `placeLabel`); the first clear gap wins, else the cheapest.

### Text limits

`textLimits(chipWidth, query)` scales the landscape limits (name 19, id 22, detail 24, query name 14, calibrated for a 174 unit text area on the wider Linux CI font) by the room in the chip: area = chip width - 64 (badge) - 10 (gap) - 16 (the expand pill covers 15 of the right end); limit = max(4, min(landscape limit, floor(limit * area / 174))). So a portrait chip is never allowed more text than a landscape chip, and a narrower one is allowed proportionally less. The UI cuts with `slot.limits`, not with a constant. `tests/network-release.spec.ts` fails if any text leaves its chip at 390 and 360 px.

### Worked fixture P1 (width 360)

Query, three matches, one step-2 node under the last match, no link.

| Case | Arithmetic | Result |
| --- | --- | --- |
| Right edge | 360 - 24 | xr = 336 |
| Query chip | x 12, y 12, width 336 - 12, height 72 | (12, 12, 324, 72), centre (174, 48), bottom 84 |
| Lanes | 3 edges: pitch min(5, 25 / 2) = 5; first lane 24 + 2 * 5 | x = 34, 29, 24 |
| Chip left edge | 34 + 20; width 336 - 54 | 54; 282 |
| Row centres | 84 + 28 + 26 = 138, then + 80 | 138, 218, 298, and 378 for the step-2 row |
| Chips | y = centre - 26 | (54, 112), (54, 192), (54, 272), 282 by 52 |
| Step-2 chip | x = 54 + 28 = 82, width 336 - 82 = 254, y = 378 - 26 | (82, 352, 254, 52) |
| Size | height 378 + 26 + 12 | 360 by 416 |
| Line, query to last match | from (24, 84) to (54, 298); controls at the thirds | (34, 155.33), (44, 226.67) |
| Identity pill, last | y = 272 - 14 = 258; t = (258 - 84) / 214 = 0.813084; line x = 24 + 30 * 0.813084 = 48.3925; centre x + 22 | (70.3925, 258) |
| Identity pill, first | t = 14 / 54 = 0.259259; line x = 34 + 20 * t = 39.1852 | (61.1852, 98) |
| Identity pill, middle | from (29, 84) to (54, 218): t = 94 / 134 = 0.701493; x = 29 + 25 * t = 46.5373 | (68.5373, 178) |
| Step-2 edge | from (54 + 20, 272 + 52) to (82, 378) | (74, 324) to (82, 378) |
| Expand pill, last match | centre on the right edge; hit 44 by 44 | (336, 298), hit (314, 276) |
| Text lines, last match | x = 54 + 64 + 10; y = 272 + 20, 34, 47 | x 128; 292, 306, 319 |
| Text limits, step-2 chip | area 254 - 90 = 164: floor(19 * 164 / 174) = 17, floor(22 * 164 / 174) = 20, floor(24 * 164 / 174) = 22 | 17, 20, 22 |

Fixture P2 (width 360): query, two matches and a link between them, one row long. Bow 24, reach 0.75 * 24 = 18, margin max(24, 18 + 8) = 26, xr = 334. Lanes: pitch 5, first lane 24 + 5 = 29, chip left 49, width 285. Rows 138 and 218. The link runs from (334, 138 + 16) to (334, 218 - 16) with controls at x = 358. The gap between the chips is y 164 to 192 and the label's centre y = 164 + 11 = 175; y(t) = 154 + 48 (3t^2 - 2t^3) = 175 gives 3t^2 - 2t^3 = 0.4375, t = 0.45832 (Newton from 0.45: f = 0.42525, f' = 6t(1 - t) = 1.4850, step 0.00841; once more: f = 0.43745, step 0.00005). x(t) = 334 + 3 * 24 * t * (1 - t) = 334 + 72 * 0.45832 * 0.54168 = 351.8749, so the label's centre is (303.8749, 175): its box is y 166 to 184, above the 185 where the next chip's ribbon starts. A link two rows long bows 32 and one of three rows or more 40 (margin 40 * 0.75 + 8 = 38).

The expected values in `src/networkLayoutPortrait.test.ts` are these numbers. It also checks, for picture widths 310, 350, 380, 590 and 629 and nine pictures (none, one, six, twenty matches, expansions, adjacent and far links, back links, a crowd of seven links): chips never overlap and lie inside the picture, no edge sample lies inside a chip, every label lies inside the picture and touches no chip, ribbon or other label, targets are at least 44, the visual order is top to bottom with each step-2 node under its own match, and the text limits are never above the landscape ones.

### Portrait limits

- More than six matches squeeze the lanes into the same 25 units (the real data has at most six); the reciprocal arrowheads at the query end then overlap.
- Links nested on three or more rows of span share a bow; the labels are still apart (tested), but the curves can lie on one another.
- On a 360 px phone a step-2 chip's second line is cut early ("match of tet..."): the full text is in the tooltip, the accessible name and the card of its parent.
- A box under 260 px wide is drawn 260 wide and scrolls.

## Limits

- All numbers are viewBox units. The chip texts use fixed character limits, not measured widths: they were checked on the real release (longest native id in a shown match 23 characters, longest name 61; `tests/network-release.spec.ts` fails if a text leaves its chip). A font with much wider letters could overflow them.
- Edges are smooth curves between fixed anchors, not routed around nodes: a cross-column edge can pass near a chip in between, and links between matches of one family (up to four in the real data) can cross.
- The tallest picture (the 25 node cap) is 1216 units high; it is not scaled.
