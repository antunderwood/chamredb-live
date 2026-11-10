# Accessibility and theming

Target: WCAG 2.2 AA for what this app uses (text contrast 1.4.3, non-text contrast 1.4.11, keyboard 2.1.1, focus visible 2.4.7, labels 3.3.2, status messages 4.1.3, use of colour 1.4.1). This is a target checked by the tests below, not a conformance claim or a certified audit. Not checked: reflow at 400% zoom (1.4.10), text spacing (1.4.12), target size (2.5.8; the smallest controls, the candidate buttons, are about 30 px high), forced-colours mode, and any screen reader. The picture is an `img` with a title and description, and the list below it carries the same data in text. Placeholder text uses `--muted` (`::placeholder` in `src/app.css`), so it is covered by the muted on surface rows. The weak-evidence warning uses `--danger` for visibility; its meaning is in the words, and a weak match is a caution, not an error.

## How to restyle

Edit `public/theme.css` only. It is the one tokens file, linked from `index.html` (same origin, so the CSP and the egress test are unaffected). Every colour and the font stack are custom properties; `src/app.css` and the SVG marks read them with `var(--name)` and hold no literal colours (`src/theme.test.ts` fails if one appears in `src/*.tsx` or `src/app.css`).

| Token | Used for |
| --- | --- |
| `--bg`, `--fg` | page background, main text, picture lines and query node |
| `--muted` | secondary text (needs 4.5:1 on `--bg` and `--surface`) |
| `--surface` | cards, notices, inputs, unfilled marks |
| `--border` | decorative outlines and dividers only (cards, notices, footer rule) |
| `--control-border` | outlines of inputs, select and candidate buttons (3:1 on `--bg` and `--surface`) |
| `--accent`, `--accent-fg` | Search button, best badge and mark, slider, keyboard focus ring; `--accent-fg` is the text on `--accent` |
| `--danger` | error and weak-evidence text (4.5:1) |
| `--font-body` | font stack |

The dark theme is the same tokens inside `@media (prefers-color-scheme: dark)`: it follows the system setting. A dark block must define every colour token, or the light value leaks into dark (the contrast test requires all of them).

A different brand is a different tokens file. `public/theme.bsb.css` is an **example** override with the Broken String Biosciences palette; nothing links to it and it is not the default. To adopt it, replace the content of `public/theme.css` with it. The font stays the system stack: DM Sans is not loaded from a font CDN and is not bundled; to use it, bundle the font file with `@font-face` and name it first in `--font-body`.

Choices in the example, each recorded in the file: Orange `#E2643A` is a mark colour (Pearl text on Orange is 3.03:1 and white on Orange 2.44:1, both below 4.5:1), so `--accent-fg` is Midnight; Fog `#CDCBD8` is 1.41:1 on Pearl, too pale to outline a control, so it is the decorative `--border` and Steel is `--control-border`; Purple `#87338B` is not mapped because no component needs a third accent (it is 2.53:1 on Midnight, so it would be marks only in dark); in dark, Magenta `#BA335C` is 3.27:1 on Midnight, so `--danger` uses a lighter `#F08AA8`; `--surface` and the dark `--surface`, `--border` and `--control-border` values are derived neutrals, not brand colours.

## Contrast

`src/contrast.test.ts` reads the token pairs from every `public/theme*.css`, light from `:root` and dark from the `@media (prefers-color-scheme: dark)` block, and computes the WCAG 2.x ratio from relative luminance. The formula is first checked against worked values it did not produce: black on white is 21:1, white on white 1:1, `#777777` on white is 4.48:1 (just failing) and `#767676` on white passes 4.5:1. Thresholds: 4.5:1 for text pairs, 3:1 for marks, focus indicators and control boundaries. The test also fails if this table drifts from the files (it looks for each row verbatim), so the ratios below are the computed ones.

Change made to reach the thresholds: the default `--border` (`#d0d0d0` light, `#3a3a3a` dark) was 1.54:1 on `--bg` and 1.41:1 on `--surface` in light, and 1.65:1 in dark, too faint to show where an input is. Those values are kept for decorative outlines, and a new token `--control-border` (`#8a8a8a` light, `#767676` dark) outlines controls. No other default token needed changing; the Okabe-Ito accents (`#0072b2`, `#56b4e9`) are unchanged. Thresholds were not weakened. Disabled controls (50% opacity) are exempt under WCAG for inactive components.

| File | Theme | Pair | Ratio | Minimum | Result |
| --- | --- | --- | --- | --- | --- |
| theme.css | light | --fg on --bg | 17.40 | 4.5:1 | pass |
| theme.css | light | --fg on --surface | 15.96 | 4.5:1 | pass |
| theme.css | light | --muted on --bg | 7.00 | 4.5:1 | pass |
| theme.css | light | --muted on --surface | 6.42 | 4.5:1 | pass |
| theme.css | light | --danger on --bg | 6.64 | 4.5:1 | pass |
| theme.css | light | --danger on --surface | 6.09 | 4.5:1 | pass |
| theme.css | light | --accent-fg on --accent | 5.19 | 4.5:1 | pass |
| theme.css | light | --accent on --bg | 5.19 | 3:1 | pass |
| theme.css | light | --accent on --surface | 4.76 | 3:1 | pass |
| theme.css | light | --control-border on --bg | 3.45 | 3:1 | pass |
| theme.css | light | --control-border on --surface | 3.17 | 3:1 | pass |
| theme.css | dark | --fg on --bg | 15.57 | 4.5:1 | pass |
| theme.css | dark | --fg on --surface | 14.17 | 4.5:1 | pass |
| theme.css | dark | --muted on --bg | 7.88 | 4.5:1 | pass |
| theme.css | dark | --muted on --surface | 7.17 | 4.5:1 | pass |
| theme.css | dark | --danger on --bg | 9.35 | 4.5:1 | pass |
| theme.css | dark | --danger on --surface | 8.51 | 4.5:1 | pass |
| theme.css | dark | --accent-fg on --accent | 8.25 | 4.5:1 | pass |
| theme.css | dark | --accent on --bg | 8.12 | 3:1 | pass |
| theme.css | dark | --accent on --surface | 7.39 | 3:1 | pass |
| theme.css | dark | --control-border on --bg | 4.12 | 3:1 | pass |
| theme.css | dark | --control-border on --surface | 3.75 | 3:1 | pass |
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

Limits: the pairs are the ones the components use today; a new component that pairs tokens differently needs a new row in `PAIRS` (`src/contrast.ts`). Text drawn at the page default size is assumed (no large-text relaxation is used). The BSB light accent on Pearl is 3.03:1, a thin margin over 3:1.

## Keyboard path

All controls are native elements, so Tab order is reading order. `tests/a11y.spec.ts` drives this with the keyboard only:

1. Tab: database select (type-ahead or arrows pick a database).
2. Tab: search box (the datalist suggestions are the native ones). Type an id or name and press Enter to search; Search is disabled until there is text.
3. Tab: Search button.
4. If the text matches more than one entry: the candidate buttons, in order; Enter chooses one.
5. When one entry is shown: Tab to the Minimum identity slider; Left and Right change it by 1, Home sets 0, End sets 100.
6. Tab: the "About chAMReDB" summary; Enter or Space opens it, and its links follow in order.

Every `input` and `select` has a visible label (checked through `labels`). A 2 px outline in `--accent` with a 2 px offset shows keyboard focus on every control, in both themes (`:focus-visible` in `src/app.css`; the tests assert the computed outline, so an `outline: none` rule turns them red).

## Not colour alone

Best match: the word "Best" (or "Highest identity shown" under 90%), a square mark instead of a circle, and "best" in the picture label. RBH versus OWH: solid versus dashed line, arrowheads at both ends versus one, and the type written in each label and list row. Weak evidence: a sentence. Links are underlined. Tests assert text, shapes and computed styles, not colours.

## Messages

Not found and data-load failures are single paragraphs with `role="alert"`, so they are announced at once. Explanatory notices (alternative id, stale release, hidden matches in other databases, no matches at this identity) use `role="status"`; the demo-data notice uses `role="note"`. Tested in `tests/a11y.spec.ts`.

## About

The old site's About text is kept as a collapsible "About chAMReDB" section at the end of the page (no router: the URL hash holds the search). The wording is lightly edited: spelling corrected (dilemma, hAMRonization, aggregate, descriptive), the last list item split into clauses, "Resfinder" written "ResFinder", the emoji dropped from the project link text, and the project link moved from the old GitLab address to https://github.com/antunderwood/chamredb (the repository exists). The three database URLs are unchanged (CARD, NCBI AMRFinderPlus, ResFinder), and all three resolved when checked on 2026-11-10 (the NCBI page answers 405 to a HEAD request and 200 to GET). They are plain links the reader clicks; the page makes no request to those sites when it loads.
