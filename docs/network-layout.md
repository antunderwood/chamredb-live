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

Size from content: height = HEADER + 2 * PAD + ROW * rows; width = x of the last used column + half its chip + SIDE (query only 256, with matches 644, with step-2 nodes 1020). Zero nodes gives 256 by 128. At the cap (1 query, 6 matches, 18 step-2 nodes) rows = 18 and the height is 1216.

## Edges

All edges are cubic curves that leave and enter horizontally (`from`, two controls half the horizontal distance out, `to`).

- Step 1 (`query`): from the query chip's right edge, fanned (FAN) around its centre, to the match chip's left edge at its centre; the identity pill is at t = 0.7.
- Step 2 to a new node (`expand`): from 20 right of the match chip (clear of the pill) to the step-2 chip's left edge; no label.
- Step 2 to an existing match (`link`): a curve on the right of the column, from 16 below (or above) the chip centre to 16 above (or below) the other, bowing 84; label at t = 0.5.
- Step 2 back to the query (`back`): from the match chip's left edge, 16 below its centre, to the query chip's right edge 30 below its centre; label at t = 0.5. Hidden by default when it is the reverse of an RBH match (`visibleEdges` in the model); drawn for a one-way match, where it is a separate hit.

## Label placement

Identity pills sit at t = 0.7 of their edge. A "match of a match" label (a `link` or `back` edge) is placed by `placeLabel`: for each t in LABEL_TS in order, the pill (12 + 6 * 16 = 108 wide, 18 high) is put on the curve; it is charged 1 for every sample (t = k / 32) of every other edge inside it grown by 2, and 10 for every identity pill or earlier label it overlaps. The first t with no charge wins; if none is clear, the cheapest, the earlier in the list on a tie.

Worked case (fixture D: matches at y 80, 144, 208, a horizontal expand edge at y = 144 from x 648 to 756, the link from (628, 96) to (628, 192) with controls at x = 712). y(t) = 96 + 96 * (3ut^2 + t^3), x(t) = 628 * (u^3 + t^3) + 712 * 3ut. At t = 0.5: (691, 144), pill y 135 to 153, grown 133 to 155: the line y = 144 is inside, so it is charged. At t = 0.4 (u = 0.6): 3ut^2 = 0.288, t^3 = 0.064, y = 96 + 0.352 * 96 = 129.792, x = 628 * 0.28 + 712 * 0.72 = 688.48; pill y 120.792 to 138.792, grown to 140.792: clear. So the label is at (688.48, 129.792). Fixture A (the step-2 edges from the last match cross t = 0.5 and 0.4) has no clear place; t = 0.4 touches least (4 samples), see the tests. Fixture A's back link: t = 0.2 (2 samples) beats t = 0.5. An independent Python re-implementation (not shared with the app) gave the same three results.

Limits: a crowded picture (four links in the same strip, `card:ARO:3002546`) still has some contact (7, 2, 0 and 7 samples, against 7, 10, 24 and 8 at t = 0.5). Chips are not obstacles. When no step-2 column exists the viewBox width (644) does not include the bow of a link or its label, which are drawn past it (visible, since the figure allows overflow).

## Click targets

`hitRegions` returns the chip rectangles (each at least 44 by 44, never overlapping: ROW 64 is more than the 52 chip). `expandRegions` returns the 44 by 44 square of each "+n" pill, centred on the chip's right edge; it overlaps only its own chip. 44 viewBox units are 44 CSS pixels only when the figure is drawn at its own width, so the UI never scales the SVG down: on a narrow screen the figure scrolls sideways inside its own box.

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

## Limits

- All numbers are viewBox units. The chip texts use fixed character limits, not measured widths: they were checked on the real release (longest native id in a shown match 23 characters, longest name 61; `tests/network-release.spec.ts` fails if a text leaves its chip). A font with much wider letters could overflow them.
- Edges are smooth curves between fixed anchors, not routed around nodes: a cross-column edge can pass near a chip in between, and links between matches of one family (up to four in the real data) can cross.
- The tallest picture (the 25 node cap) is 1216 units high; it is not scaled.
