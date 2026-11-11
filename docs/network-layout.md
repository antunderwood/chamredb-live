# Network layout (tickets #9 and #10)

Geometry for the interactive network. `src/networkLayout.ts` is separate from `src/layout.ts` (the small picture of ticket #11, documented in `network-view.md`), which stays until #9 replaces its use. Nothing here touches the DOM; the model it draws is `src/networkModel.ts` (`docs/data-contract.md`, "Network model and expansion").

## One position function

`pixel(column, row, count, rows)` is the only place a slot becomes a pixel. Node centres, edge ends, label anchors, tooltip anchors and hit regions all derive from it (through `layoutNetwork`). It takes slot numbers only: column 0 is the query, 1 the matches, 2 the step-2 nodes (matches of an expanded match); `count` is the number of nodes in that column and `rows` the number in the tallest column (at least 1).

```
x = MARGIN_X + COL_GAP * column
y = PAD + ROW * ((rows - count) / 2 + row) + ROW / 2
```

A shorter column is centred on the tallest one. The query is on the middle row of the tallest column. Nodes within a column keep the model order (step-1 in list order, step-2 by via).

## Constants (viewBox units)

| Constant | Value | Meaning |
| --- | --- | --- |
| ROW | 56 | vertical space per node: the 48 hit target plus 8 |
| PAD | 16 | space above the first and below the last row |
| MARGIN_X | 96 | column 0 centre, and the margin right of the last column's centre (half of a 24 character label at about 7 units per character, rounded up) |
| COL_GAP | 192 | distance between column centres (wider than a 24 character label, so labels of two columns do not meet) |
| CLEARANCE | 20 | an edge stops this far from a node centre (node radius 16 plus the arrowhead) |
| LABEL_RISE | 24 | label baseline above the node centre, text-anchor middle |
| HIT | 48 | side of the square click target |
| BOW | 42 | a same-column edge bows this far to the right (quadratic curve) |

Size from content: height = 2 * PAD + ROW * rows; width = x of the last used column + MARGIN_X (query only 192, with matches 384, with step-2 nodes 576). Zero nodes gives 192 by 88. At the cap (1 query, 6 matches, 18 step-2 nodes) rows = 18 and the height is 1040.

## Hit regions

`hitRegions(layout)` returns one 48 by 48 square per node, centred on its centre, never overlapping (ROW is 56). The UI places an invisible, focusable target on each. 48 viewBox units are 48 CSS pixels only when the picture is drawn at its own width: below that the target shrinks (44 pixels is reached at 92% of the width). The UI should keep the figure at least as wide as the viewBox and scroll it sideways on a narrow screen (decision for #9).

## Hand-worked pixels

Fixture A: query, 3 matches, 3 step-2 nodes (rows = 3). Height 2 * 16 + 56 * 3 = 200, width 480 + 96 = 576.

| Case | Arithmetic | Result |
| --- | --- | --- |
| Query | count 1, offset (3 - 1) / 2 = 1: y = 16 + 56 * 1 + 28 | (96, 100) |
| First match | x = 96 + 192 = 288; y = 16 + 0 + 28 | (288, 44) |
| Last match | y = 16 + 56 * 2 + 28 | (288, 156) |
| Step-2 slots | x = 96 + 2 * 192 = 480; same rows | (480, 44), (480, 100), (480, 156) |
| Last match, label | 156 - 24 | (288, 132) |
| Last match, tooltip anchor | 156 + 48 / 2 | (288, 180) |
| Last match, hit region | 288 - 24, 156 - 24, 48 by 48 | x 264, y 132 |
| Edge, query to last match | vector (192, 56), length sqrt(36864 + 3136) = 200, unit (0.96, 0.28), times 20 = (19.2, 5.6) | from (115.2, 105.6) to (268.8, 150.4) |
| Step-2 edge, last match to middle step-2 node | vector (192, -56), same triangle | from (307.2, 150.4) to (460.8, 105.6) |
| Same-column edge, first to last match | control (288 + 42, (44 + 156) / 2) = (330, 100); from the first: vector (42, 56), length 70, unit (0.6, 0.8), times 20 = (12, 16) | from (300, 60) to (300, 140) |
| Centring, 2 matches beside 3 step-2 nodes | offset (3 - 2) / 2 = 0.5: y = 16 + 56 * 0.5 + 28, and + 56 | match rows 72 and 128 |
| Query only | width 2 * 96, height 2 * 16 + 56 | 192 by 88 |

The expected values in `src/networkLayout.test.ts` are these numbers, not computed by the code under test. There is no mirrored (right to left) orientation here: the old `layout.ts` keeps its own tests.
