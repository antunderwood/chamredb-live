# Accessibility and theming

Target: WCAG 2.2 AA for what this app uses (text contrast 1.4.3, non-text contrast 1.4.11, keyboard 2.1.1, focus visible 2.4.7, labels 3.3.2, status messages 4.1.3, use of colour 1.4.1). This is a target checked by the tests below, not a conformance claim or a certified audit. Not checked: a skip link (WCAG 2.4.1; the header adds four Tab stops before the form), reflow at 400% zoom (1.4.10), text spacing (1.4.12), target size (2.5.8; the smallest controls, the candidate buttons, are about 30 px high), forced-colours mode, and any screen reader. The picture is a labelled group of focusable buttons (every chip, and the expand pills), and the list below it carries the same data in text; see "Network picture" below. Placeholder text uses `--muted` (`::placeholder` in `src/app.css`), so it is covered by the muted on surface rows. The weak-evidence warning uses `--danger` for visibility; its meaning is in the words, and a weak match is a caution, not an error.

## How to restyle

Edit `public/theme.css` only. It is the one tokens file, linked from `index.html` (same origin, so the CSP and the egress test are unaffected). Every colour and the font stack are custom properties; `src/app.css` and the SVG marks read them with `var(--name)` and hold no literal colours (`src/theme.test.ts` fails if one appears in `src/*.tsx` or `src/app.css`).

| Token | Used for |
| --- | --- |
| `--bg`, `--fg` | page background, main text, picture lines and query node |
| `--muted` | secondary text (needs 4.5:1 on `--bg`, `--surface` and `--panel`) |
| `--surface` | cards, notices, inputs, unfilled marks |
| `--panel` | the tinted panel behind the network picture and the match cards (the 2021 slate panel, modernised) |
| `--border` | decorative outlines and dividers only (cards, notices, footer rule) |
| `--control-border` | outlines of inputs, select and candidate buttons (3:1 on `--bg` and `--surface`) |
| `--accent`, `--accent-fg` | Search button (the bright blue), best badge and mark, slider, keyboard focus ring, notice edge; `--accent-fg` is the text on `--accent` |
| `--danger` | error and weak-evidence text (4.5:1) |
| `--brand`, `--brand-fg` | header bar and its text, its toggle outline and its focus ring (the 2021 purple, `#633f8d`) |
| `--nav-active-bg`, `--nav-active-fg` | the pill on the current nav item (Query) |
| `--chip-query`, `--chip-db`, `--chip-name`, `--chip-match`, `--chip-fg` | colour chips (blue Query, orange database, red name, purple Match) with `--chip-fg` as their text; every chip also carries its label as text. The red name chip must never be used to signal an error or weakness (that is `--danger` text with words). Used by the result panels (#8): Query, database and name chips on the query panel, Match, database and name chips on each match panel, and the database chip as each group heading. Chips sit on `--panel` as well as `--surface` (both pairs are tested) |
| `--label`, `--label-fg` | the green label bars ("Minimum identity", the card fields and the phenotype headings); `--label` also colours the list bullets |
| `--db-card`, `--db-ncbi`, `--db-resfinder` and their `-fg` | the network picture: database badge fill and chip outline, with the text on the badge (the database is also carried by the badge text and the outline shape) |
| `--best`, `--best-fg` | the Best ribbon of the picture (a deep gold in light; the weak ribbon is outlined in `--muted`) |
| `--font-body` | font stack |

Dark is the same tokens written twice with identical values: inside `@media (prefers-color-scheme: dark)` as `:root:not([data-theme="light"])` (the system setting, unless the toggle chose light) and as `:root[data-theme="dark"]` (the toggle chose dark). A dark block must define every colour token, or the light value leaks into dark (the contrast test requires all of them), and `src/contrast.test.ts` fails if the two dark blocks differ.

## Theme toggle

The header has a round button named "Dark mode" with `aria-pressed` (true when dark is showing; the icon is also filled when pressed, so state is not colour alone). With nothing saved, the page follows `prefers-color-scheme`, including when the system setting changes while the page is open. A click saves `light` or `dark` under the `chamredb-theme` key in `localStorage` and sets `data-theme` on `<html>` (before paint, so a saved choice does not flash the other theme); an explicit choice beats the system setting in both directions. localStorage is a per-viewer convenience: every read and write is in try/catch, so with storage blocked the toggle still works for the visit and the choice is simply not kept. Nothing is sent anywhere. `tests/header.spec.ts` covers the default, the switch, reload, an explicit dark choice on a light system, and blocked storage.

A different brand is a different tokens file. `public/theme.bsb.css` is an **example** override with the Broken String Biosciences palette; nothing links to it and it is not the default. To adopt it, replace the content of `public/theme.css` with it. The font stays the system stack: DM Sans is not loaded from a font CDN and is not bundled; to use it, bundle the font file with `@font-face` and name it first in `--font-body`.

Choices in the example, each recorded in the file: Orange `#E2643A` is a mark colour (Pearl text on Orange is 3.03:1 and white on Orange 2.44:1, both below 4.5:1), so `--accent-fg` is Midnight; Fog `#CDCBD8` is 1.41:1 on Pearl, too pale to outline a control, so it is the decorative `--border` and Steel is `--control-border`; Purple `#87338B` is the header bar in light and a darker `#5e2262` in dark (white text on both passes; Purple itself is 2.53:1 on Midnight, so it is never used as a mark in dark); in dark, Magenta `#BA335C` is 3.27:1 on Midnight, so `--danger` uses a lighter `#F08AA8`; `--surface` and the dark `--surface`, `--border` and `--control-border` values are derived neutrals, not brand colours.

## Contrast

`src/contrast.test.ts` reads the token pairs from every `public/theme*.css`, light from `:root` and dark from the `@media (prefers-color-scheme: dark)` block, and computes the WCAG 2.x ratio from relative luminance. The formula is first checked against worked values it did not produce: black on white is 21:1, white on white 1:1, `#777777` on white is 4.48:1 (just failing) and `#767676` on white passes 4.5:1. Thresholds: 4.5:1 for text pairs, 3:1 for marks, focus indicators and control boundaries. The test also fails if this table drifts from the files (it looks for each row verbatim), so the ratios below are the computed ones.

Palette change (ticket #5): the default theme was rebuilt from the 2021 colours (purple header, blue Search, orange, red and purple chips, green label bars). The values were picked, then checked by the test; thresholds were not touched. White on the header purple `#633f8d` is 8.00:1, white chip text needs the deeper orange `#a8400c` (6.17:1; the 2021 orange is too light). In dark the chips are lighter tints with near-black text. In the BSB example the light `--panel` is Pearl itself, because any darker tint drops Orange below 3:1 on the panel, and the chips use deeper or lighter variants of the brand colours where white or Midnight text would otherwise fail.

Earlier change to reach the thresholds: the default `--border` (`#d0d0d0` light, `#3a3a3a` dark) was 1.54:1 on `--bg` and 1.41:1 on `--surface` in light, and 1.65:1 in dark, too faint to show where an input is. Those values are kept for decorative outlines, and a new token `--control-border` (`#8a8a8a` light, `#767676` dark) outlines controls. (That fix predates ticket #5; the Okabe-Ito blue accents it mentions were replaced by the brighter blue Search colour.) Thresholds were not weakened. Disabled controls (50% opacity) are exempt under WCAG for inactive components.

| File | Theme | Pair | Ratio | Minimum | Result |
| --- | --- | --- | --- | --- | --- |
| theme.css | light | --fg on --bg | 15.85 | 4.5:1 | pass |
| theme.css | light | --fg on --surface | 17.29 | 4.5:1 | pass |
| theme.css | light | --muted on --bg | 6.93 | 4.5:1 | pass |
| theme.css | light | --muted on --surface | 7.56 | 4.5:1 | pass |
| theme.css | light | --danger on --bg | 6.21 | 4.5:1 | pass |
| theme.css | light | --danger on --surface | 6.77 | 4.5:1 | pass |
| theme.css | light | --accent-fg on --accent | 6.78 | 4.5:1 | pass |
| theme.css | light | --accent on --bg | 6.21 | 3:1 | pass |
| theme.css | light | --accent on --surface | 6.78 | 3:1 | pass |
| theme.css | light | --control-border on --bg | 4.34 | 3:1 | pass |
| theme.css | light | --control-border on --surface | 4.74 | 3:1 | pass |
| theme.css | light | --fg on --panel | 13.85 | 4.5:1 | pass |
| theme.css | light | --muted on --panel | 6.06 | 4.5:1 | pass |
| theme.css | light | --danger on --panel | 5.42 | 4.5:1 | pass |
| theme.css | light | --accent on --panel | 5.43 | 3:1 | pass |
| theme.css | light | --brand-fg on --brand | 8.00 | 4.5:1 | pass |
| theme.css | light | --nav-active-fg on --nav-active-bg | 11.20 | 4.5:1 | pass |
| theme.css | light | --nav-active-bg on --brand | 8.00 | 3:1 | pass |
| theme.css | light | --chip-fg on --chip-query | 6.78 | 4.5:1 | pass |
| theme.css | light | --chip-fg on --chip-db | 6.17 | 4.5:1 | pass |
| theme.css | light | --chip-fg on --chip-name | 6.77 | 4.5:1 | pass |
| theme.css | light | --chip-fg on --chip-match | 7.74 | 4.5:1 | pass |
| theme.css | light | --chip-query on --surface | 6.78 | 3:1 | pass |
| theme.css | light | --chip-db on --surface | 6.17 | 3:1 | pass |
| theme.css | light | --chip-name on --surface | 6.77 | 3:1 | pass |
| theme.css | light | --chip-match on --surface | 7.74 | 3:1 | pass |
| theme.css | light | --label-fg on --label | 6.08 | 4.5:1 | pass |
| theme.css | light | --label on --surface | 6.08 | 3:1 | pass |
| theme.css | light | --chip-query on --panel | 5.43 | 3:1 | pass |
| theme.css | light | --chip-db on --panel | 4.94 | 3:1 | pass |
| theme.css | light | --chip-name on --panel | 5.42 | 3:1 | pass |
| theme.css | light | --chip-match on --panel | 6.20 | 3:1 | pass |
| theme.css | light | --db-card-fg on --db-card | 5.38 | 4.5:1 | pass |
| theme.css | light | --db-ncbi-fg on --db-ncbi | 6.44 | 4.5:1 | pass |
| theme.css | light | --db-resfinder-fg on --db-resfinder | 6.67 | 4.5:1 | pass |
| theme.css | light | --db-card on --surface | 5.38 | 3:1 | pass |
| theme.css | light | --db-ncbi on --surface | 6.44 | 3:1 | pass |
| theme.css | light | --db-resfinder on --surface | 6.67 | 3:1 | pass |
| theme.css | light | --db-card on --panel | 4.31 | 3:1 | pass |
| theme.css | light | --db-ncbi on --panel | 5.16 | 3:1 | pass |
| theme.css | light | --db-resfinder on --panel | 5.35 | 3:1 | pass |
| theme.css | light | --best-fg on --best | 5.54 | 4.5:1 | pass |
| theme.css | light | --best on --surface | 5.54 | 3:1 | pass |
| theme.css | light | --best on --panel | 4.44 | 3:1 | pass |
| theme.css | light | --control-border on --panel | 3.79 | 3:1 | pass |
| theme.css | light | --label on --panel | 4.87 | 3:1 | pass |
| theme.css | dark | --fg on --bg | 15.16 | 4.5:1 | pass |
| theme.css | dark | --fg on --surface | 11.50 | 4.5:1 | pass |
| theme.css | dark | --muted on --bg | 8.79 | 4.5:1 | pass |
| theme.css | dark | --muted on --surface | 6.67 | 4.5:1 | pass |
| theme.css | dark | --danger on --bg | 9.16 | 4.5:1 | pass |
| theme.css | dark | --danger on --surface | 6.95 | 4.5:1 | pass |
| theme.css | dark | --accent-fg on --accent | 8.00 | 4.5:1 | pass |
| theme.css | dark | --accent on --bg | 7.69 | 3:1 | pass |
| theme.css | dark | --accent on --surface | 5.84 | 3:1 | pass |
| theme.css | dark | --control-border on --bg | 5.27 | 3:1 | pass |
| theme.css | dark | --control-border on --surface | 4.00 | 3:1 | pass |
| theme.css | dark | --fg on --panel | 13.68 | 4.5:1 | pass |
| theme.css | dark | --muted on --panel | 7.93 | 4.5:1 | pass |
| theme.css | dark | --danger on --panel | 8.27 | 4.5:1 | pass |
| theme.css | dark | --accent on --panel | 6.94 | 3:1 | pass |
| theme.css | dark | --brand-fg on --brand | 12.58 | 4.5:1 | pass |
| theme.css | dark | --nav-active-fg on --nav-active-bg | 12.07 | 4.5:1 | pass |
| theme.css | dark | --nav-active-bg on --brand | 10.19 | 3:1 | pass |
| theme.css | dark | --chip-fg on --chip-query | 8.63 | 4.5:1 | pass |
| theme.css | dark | --chip-fg on --chip-db | 9.60 | 4.5:1 | pass |
| theme.css | dark | --chip-fg on --chip-name | 8.92 | 4.5:1 | pass |
| theme.css | dark | --chip-fg on --chip-match | 9.69 | 4.5:1 | pass |
| theme.css | dark | --chip-query on --surface | 6.28 | 3:1 | pass |
| theme.css | dark | --chip-db on --surface | 6.99 | 3:1 | pass |
| theme.css | dark | --chip-name on --surface | 6.49 | 3:1 | pass |
| theme.css | dark | --chip-match on --surface | 7.05 | 3:1 | pass |
| theme.css | dark | --label-fg on --label | 9.28 | 4.5:1 | pass |
| theme.css | dark | --label on --surface | 7.37 | 3:1 | pass |
| theme.css | dark | --chip-query on --panel | 7.47 | 3:1 | pass |
| theme.css | dark | --chip-db on --panel | 8.31 | 3:1 | pass |
| theme.css | dark | --chip-name on --panel | 7.72 | 3:1 | pass |
| theme.css | dark | --chip-match on --panel | 8.39 | 3:1 | pass |
| theme.css | dark | --db-card-fg on --db-card | 8.97 | 4.5:1 | pass |
| theme.css | dark | --db-ncbi-fg on --db-ncbi | 7.56 | 4.5:1 | pass |
| theme.css | dark | --db-resfinder-fg on --db-resfinder | 7.30 | 4.5:1 | pass |
| theme.css | dark | --db-card on --surface | 6.60 | 3:1 | pass |
| theme.css | dark | --db-ncbi on --surface | 5.84 | 3:1 | pass |
| theme.css | dark | --db-resfinder on --surface | 6.06 | 3:1 | pass |
| theme.css | dark | --db-card on --panel | 7.85 | 3:1 | pass |
| theme.css | dark | --db-ncbi on --panel | 6.94 | 3:1 | pass |
| theme.css | dark | --db-resfinder on --panel | 7.21 | 3:1 | pass |
| theme.css | dark | --best-fg on --best | 11.30 | 4.5:1 | pass |
| theme.css | dark | --best on --surface | 8.46 | 3:1 | pass |
| theme.css | dark | --best on --panel | 10.06 | 3:1 | pass |
| theme.css | dark | --control-border on --panel | 4.76 | 3:1 | pass |
| theme.css | dark | --label on --panel | 8.76 | 3:1 | pass |
| theme.bsb.css | light | --fg on --bg | 16.29 | 4.5:1 | pass |
| theme.bsb.css | light | --fg on --surface | 18.48 | 4.5:1 | pass |
| theme.bsb.css | light | --muted on --bg | 5.07 | 4.5:1 | pass |
| theme.bsb.css | light | --muted on --surface | 5.75 | 4.5:1 | pass |
| theme.bsb.css | light | --danger on --bg | 4.98 | 4.5:1 | pass |
| theme.bsb.css | light | --danger on --surface | 5.65 | 4.5:1 | pass |
| theme.bsb.css | light | --accent-fg on --accent | 5.38 | 4.5:1 | pass |
| theme.bsb.css | light | --accent on --bg | 3.03 | 3:1 | pass |
| theme.bsb.css | light | --accent on --surface | 3.43 | 3:1 | pass |
| theme.bsb.css | light | --control-border on --bg | 5.07 | 3:1 | pass |
| theme.bsb.css | light | --control-border on --surface | 5.75 | 3:1 | pass |
| theme.bsb.css | light | --fg on --panel | 16.29 | 4.5:1 | pass |
| theme.bsb.css | light | --muted on --panel | 5.07 | 4.5:1 | pass |
| theme.bsb.css | light | --danger on --panel | 4.98 | 4.5:1 | pass |
| theme.bsb.css | light | --accent on --panel | 3.03 | 3:1 | pass |
| theme.bsb.css | light | --brand-fg on --brand | 7.30 | 4.5:1 | pass |
| theme.bsb.css | light | --nav-active-fg on --nav-active-bg | 16.29 | 4.5:1 | pass |
| theme.bsb.css | light | --nav-active-bg on --brand | 6.44 | 3:1 | pass |
| theme.bsb.css | light | --chip-fg on --chip-query | 7.30 | 4.5:1 | pass |
| theme.bsb.css | light | --chip-fg on --chip-db | 6.17 | 4.5:1 | pass |
| theme.bsb.css | light | --chip-fg on --chip-name | 5.65 | 4.5:1 | pass |
| theme.bsb.css | light | --chip-fg on --chip-match | 5.75 | 4.5:1 | pass |
| theme.bsb.css | light | --chip-query on --surface | 7.30 | 3:1 | pass |
| theme.bsb.css | light | --chip-db on --surface | 6.17 | 3:1 | pass |
| theme.bsb.css | light | --chip-name on --surface | 5.65 | 3:1 | pass |
| theme.bsb.css | light | --chip-match on --surface | 5.75 | 3:1 | pass |
| theme.bsb.css | light | --label-fg on --label | 5.75 | 4.5:1 | pass |
| theme.bsb.css | light | --label on --surface | 5.75 | 3:1 | pass |
| theme.bsb.css | light | --chip-query on --panel | 6.44 | 3:1 | pass |
| theme.bsb.css | light | --chip-db on --panel | 5.44 | 3:1 | pass |
| theme.bsb.css | light | --chip-name on --panel | 4.98 | 3:1 | pass |
| theme.bsb.css | light | --chip-match on --panel | 5.07 | 3:1 | pass |
| theme.bsb.css | light | --db-card-fg on --db-card | 5.38 | 4.5:1 | pass |
| theme.bsb.css | light | --db-ncbi-fg on --db-ncbi | 7.30 | 4.5:1 | pass |
| theme.bsb.css | light | --db-resfinder-fg on --db-resfinder | 5.65 | 4.5:1 | pass |
| theme.bsb.css | light | --db-card on --surface | 3.43 | 3:1 | pass |
| theme.bsb.css | light | --db-ncbi on --surface | 7.30 | 3:1 | pass |
| theme.bsb.css | light | --db-resfinder on --surface | 5.65 | 3:1 | pass |
| theme.bsb.css | light | --db-card on --panel | 3.03 | 3:1 | pass |
| theme.bsb.css | light | --db-ncbi on --panel | 6.44 | 3:1 | pass |
| theme.bsb.css | light | --db-resfinder on --panel | 4.98 | 3:1 | pass |
| theme.bsb.css | light | --best-fg on --best | 5.54 | 4.5:1 | pass |
| theme.bsb.css | light | --best on --surface | 5.54 | 3:1 | pass |
| theme.bsb.css | light | --best on --panel | 4.88 | 3:1 | pass |
| theme.bsb.css | light | --control-border on --panel | 5.07 | 3:1 | pass |
| theme.bsb.css | light | --label on --panel | 5.07 | 3:1 | pass |
| theme.bsb.css | dark | --fg on --bg | 16.29 | 4.5:1 | pass |
| theme.bsb.css | dark | --fg on --surface | 14.36 | 4.5:1 | pass |
| theme.bsb.css | dark | --muted on --bg | 11.56 | 4.5:1 | pass |
| theme.bsb.css | dark | --muted on --surface | 10.18 | 4.5:1 | pass |
| theme.bsb.css | dark | --danger on --bg | 7.84 | 4.5:1 | pass |
| theme.bsb.css | dark | --danger on --surface | 6.91 | 4.5:1 | pass |
| theme.bsb.css | dark | --accent-fg on --accent | 5.38 | 4.5:1 | pass |
| theme.bsb.css | dark | --accent on --bg | 5.38 | 3:1 | pass |
| theme.bsb.css | dark | --accent on --surface | 4.74 | 3:1 | pass |
| theme.bsb.css | dark | --control-border on --bg | 5.52 | 3:1 | pass |
| theme.bsb.css | dark | --control-border on --surface | 4.87 | 3:1 | pass |
| theme.bsb.css | dark | --fg on --panel | 15.44 | 4.5:1 | pass |
| theme.bsb.css | dark | --muted on --panel | 10.95 | 4.5:1 | pass |
| theme.bsb.css | dark | --danger on --panel | 7.43 | 4.5:1 | pass |
| theme.bsb.css | dark | --accent on --panel | 5.10 | 3:1 | pass |
| theme.bsb.css | dark | --brand-fg on --brand | 11.16 | 4.5:1 | pass |
| theme.bsb.css | dark | --nav-active-fg on --nav-active-bg | 16.29 | 4.5:1 | pass |
| theme.bsb.css | dark | --nav-active-bg on --brand | 9.84 | 3:1 | pass |
| theme.bsb.css | dark | --chip-fg on --chip-query | 8.57 | 4.5:1 | pass |
| theme.bsb.css | dark | --chip-fg on --chip-db | 5.38 | 4.5:1 | pass |
| theme.bsb.css | dark | --chip-fg on --chip-name | 7.84 | 4.5:1 | pass |
| theme.bsb.css | dark | --chip-fg on --chip-match | 11.56 | 4.5:1 | pass |
| theme.bsb.css | dark | --chip-query on --surface | 7.55 | 3:1 | pass |
| theme.bsb.css | dark | --chip-db on --surface | 4.74 | 3:1 | pass |
| theme.bsb.css | dark | --chip-name on --surface | 6.91 | 3:1 | pass |
| theme.bsb.css | dark | --chip-match on --surface | 10.18 | 3:1 | pass |
| theme.bsb.css | dark | --label-fg on --label | 11.56 | 4.5:1 | pass |
| theme.bsb.css | dark | --label on --surface | 10.18 | 3:1 | pass |
| theme.bsb.css | dark | --chip-query on --panel | 8.12 | 3:1 | pass |
| theme.bsb.css | dark | --chip-db on --panel | 5.10 | 3:1 | pass |
| theme.bsb.css | dark | --chip-name on --panel | 7.43 | 3:1 | pass |
| theme.bsb.css | dark | --chip-match on --panel | 10.95 | 3:1 | pass |
| theme.bsb.css | dark | --db-card-fg on --db-card | 5.38 | 4.5:1 | pass |
| theme.bsb.css | dark | --db-ncbi-fg on --db-ncbi | 8.57 | 4.5:1 | pass |
| theme.bsb.css | dark | --db-resfinder-fg on --db-resfinder | 7.84 | 4.5:1 | pass |
| theme.bsb.css | dark | --db-card on --surface | 4.74 | 3:1 | pass |
| theme.bsb.css | dark | --db-ncbi on --surface | 7.55 | 3:1 | pass |
| theme.bsb.css | dark | --db-resfinder on --surface | 6.91 | 3:1 | pass |
| theme.bsb.css | dark | --db-card on --panel | 5.10 | 3:1 | pass |
| theme.bsb.css | dark | --db-ncbi on --panel | 8.12 | 3:1 | pass |
| theme.bsb.css | dark | --db-resfinder on --panel | 7.43 | 3:1 | pass |
| theme.bsb.css | dark | --best-fg on --best | 11.30 | 4.5:1 | pass |
| theme.bsb.css | dark | --best on --surface | 10.01 | 3:1 | pass |
| theme.bsb.css | dark | --best on --panel | 10.77 | 3:1 | pass |
| theme.bsb.css | dark | --control-border on --panel | 5.23 | 3:1 | pass |
| theme.bsb.css | dark | --label on --panel | 10.95 | 3:1 | pass |

Limits: the pairs are the ones the components use today, plus the reserved chip and label tokens; a new component that pairs tokens differently needs a new row in `PAIRS` (`src/contrast.ts`). Text drawn at the page default size is assumed (no large-text relaxation is used). The BSB light accent on Pearl is 3.03:1, a thin margin over 3:1.

## Keyboard path

All controls are native elements, so Tab order is reading order. The header comes first: Query (a button that focuses the search box; it carries the active pill as a visual cue only, no `aria-current`), About (opens the About section and moves focus to it), Code (a link to this repository) and the Dark mode toggle, each with a 2 px outline in `--brand-fg` (the accent would not show on the purple bar); `tests/header.spec.ts` asserts the order and the ring. The wordmark is text, not a link; its accessible name is "chAMReDB" (the emoji is hidden from the accessibility tree and a visually hidden "chAMReDB" is exposed instead (checked in Chromium's accessibility tree, not with a screen reader; the page heading "chAMReDB" follows, so the name may be announced twice)). The nav buttons do not change the URL hash, which holds the search. `tests/a11y.spec.ts` then drives the page with the keyboard only, starting after the toggle:

1. Tab: database select (type-ahead or arrows pick a database).
2. Tab: search box (the datalist suggestions are the native ones). Type an id or name and press Enter to search; Search is disabled until there is text.
3. Tab: Search button.
4. If the text matches more than one entry: the candidate buttons, in order; Enter chooses one.
5. When one entry is shown: Tab to the Minimum identity slider; Left and Right change it by 1, Home sets 0, End sets 100.
6. The results, in reading order at every width (DOM order is the Tab order; CSS never reorders it, #25): the comparison strip's top-match buttons, then the network's scroll box, nodes and pills, then each card's "Show in network" button and links. The query panel has no Tab stop of its own. From 1152 px the strip and the network are in a sticky left rail that scrolls by itself when taller than the window, and the wheel passes on to the page at its ends; it is not a Tab stop itself because it holds focusable controls (the rail is sticky only when the network is shown, so a rail of no-match rows alone never becomes a scroll box without a Tab stop). `tests/layout.spec.ts` asserts the order at 1280 and 390 px.
7. Tab: the "About chAMReDB" summary; Enter or Space opens it, and its links follow in order.

Every `input` and `select` has a visible label (checked through `labels`). A 2 px outline with a 2 px offset shows keyboard focus on every control, in both themes (`--accent` everywhere except the purple header, which uses `--brand-fg`) (`:focus-visible` in `src/app.css`; the tests assert the computed outline, so an `outline: none` rule turns them red).

## Not colour alone

Best match: the word "Best" (or "Highest identity shown" under 90%) in the list and on a ribbon on the chip. Database: the badge text and the outline shape (rounded, cut corners, pill) as well as colour. A match of a match: a dashed outline, the text "match of X" on the chip, and a column heading. RBH versus OWH: solid versus dashed line, arrowheads at both ends versus one, and the type written in each label and list row. Weak evidence: a sentence. Links in the page are underlined; the header Code link is a nav pill, underlined on hover only. Tests assert text, shapes and computed styles, not colours.

## Messages

Not found and data-load failures are single paragraphs with `role="alert"`, so they are announced at once. Explanatory notices (alternative id, stale release, hidden matches in other databases, no matches at this identity) use `role="status"`; the demo-data notice uses `role="note"`. Tested in `tests/a11y.spec.ts`.

## About

The old site's About text is kept as a collapsible "About chAMReDB" section at the end of the page (no router: the URL hash holds the search). The wording is lightly edited: spelling corrected (dilemma, hAMRonization, aggregate, descriptive), the last list item split into clauses, "Resfinder" written "ResFinder", the emoji dropped from the project link text, and the project link moved from the old GitLab address to https://github.com/antunderwood/chamredb (the repository exists). The three database URLs are unchanged (CARD, NCBI AMRFinderPlus, ResFinder), and all three resolved when checked on 2026-11-10 (the NCBI page answers 405 to a HEAD request and 200 to GET). They are plain links the reader clicks; the page makes no request to those sites when it loads.

Example buttons (ticket #7) use a 10% mix of `--accent` into `--surface` as their fill (no new token): `--muted` on that fill is 6.49:1 in light and 5.57:1 in dark and `--fg` 14.84:1 and 9.61:1, computed with the same formula as the contrast test. The "How to read this" section is a native `details` placed after the results and before About, so the keyboard order of the form, slider and candidate buttons is unchanged; it adds one Tab stop before the About summary. On the real-release build the four example buttons are also Tab stops, between the search form and the results; the fixture build offers none. The example buttons carry the accessible name "Example: <query>" (their visible text starts with the query, so the visible label is contained in the name) and the one-line note as their description.

## Network picture (tickets #9 and #10)

- Keyboard: every chip is a `role="button"` group with `tabindex="0"` and an accessible name (name, database, id, identity, type, Best); Enter or Space makes it the query (the query chip is `aria-disabled`). Each "+n" pill is a separate button with `aria-expanded` and a name such as "Expand matches of X (n)". Tab order: query, then each match followed by its pill, then the step-2 nodes. L on a node moves focus to its card; "Show in network" on a card focuses its node. After Enter, focus goes to the new query chip.
- Tooltip: `role="tooltip"`, referenced by `aria-describedby` on the node while shown; opens on hover and on focus, Escape dismisses it (1.4.13 dismissible), and it stays inside the figure; it follows its node when the box scrolls sideways and is hidden while the node is out of the box. It is not hoverable (the pointer cannot move onto it) and has no interactive content; the same text is in the card.
- Focus is visible: the global 2 px accent outline (tested on every stop by `tests/a11y.spec.ts`) plus a glow.
- Target size (2.5.8): a chip is 248 by 52 and a pill target 44 by 44 viewBox units. The figure is never scaled down (it scrolls sideways inside a keyboard-scrollable, labelled box), so these are CSS pixels. The text on a chip is 10 to 15 px; the 10 px ribbon and badge text is small and is repeated in the tooltip and the card.
- `prefers-reduced-motion: reduce` removes the entrance animation and the outline transition (`tests/network.spec.ts`).
- Contrast: `tests/network.spec.ts` computes, in light and dark, the contrast of every chip text on its fill (4.5:1) and of chip outlines, edges, pills and the expand pill on the panel (3:1), from the browser's computed colours. The token pairs are in the table above.
- Not checked: a screen reader on the SVG buttons, forced-colours mode, a portrait layout for narrow screens (follow-up).

## Comparison strip (#20)

The at-a-glance strip carries every value as text beside its bar: identity and coverage as percentages, the type written out next to its arrow glyph (solid two-headed for RBH, dashed one-headed for OWH), the label Best or Highest identity shown, and the match count. The bars repeat the numbers. The bar fill is `--label` on a `--panel` track (4.87:1 light, 8.76:1 dark), and the track is outlined in `--control-border` (3:1 on `--surface`, already a tested pair), so the 100% end can be judged. The weak-evidence mark (`--danger`, dashed) sits on a 5 px `--surface` halo, so it is read against `--surface` (a tested pair at 4.5:1) where it crosses the fill, and its "90%" label is `--danger` text on `--surface`; the dash, the label and the key identify it without colour. The minimum identity is not drawn on the bars. The SVGs are `aria-hidden`; the values they draw are in the text.

A top match's name is a button that scrolls its card into view and moves focus to it; each match card is therefore a focus target (`tabindex="-1"`, not a Tab stop) and shows the global focus ring. The value cells use `dd` with `display: contents` for the grid layout; this keeps `dd` semantics in current Chrome, Firefox and Safari 17 or later, which is the browser floor for this layout.
