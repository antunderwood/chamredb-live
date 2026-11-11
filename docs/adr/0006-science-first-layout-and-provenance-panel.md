# 0006. Science-first layout: at-a-glance comparison, explicit no-match rows, provenance in an About and data panel

- Status: proposed
- Date: 2026-11-11
- Deciders: repo owner
- Kind: engineering

## Context

After the #4 redesign (ADR 0005) the content is complete but the page is a single 768 px column. A search for `card:ARO:3000230` renders 2721 px tall at 1280 px wide; on a 390 px phone the first result starts about 1150 px down. Identity, coverage and type are read from label bars, one panel per match. A source database with no match at or above the minimum identity is not shown at all; the 2021 site showed a "No Match" panel for it. The network legend is a paragraph of about 90 words. The release footer (about 130 words and two sha256 strings) ends every page. Spec: #18.

## Options considered

1. Keep the single column and only trim text: least work, but the comparison is still done by the reader.
2. Add an at-a-glance comparison strip and a two-column layout on wide screens, with provenance in an About and data panel (chosen).
3. A separate About page through a router: the URL hash already holds the search state, so a router adds a second state source.

## Decision

- Under the search, one comparison row per other source database: best match (or "Highest identity shown" when weak), identity and coverage bars with the minimum identity and 90% weak lines, RBH or OWH with text, and the match count. A database with no match at or above the minimum identity gets an explicit "No match at or above N% identity" row with no bar.
- One pure function maps values to bar lengths; coverage above 100% is clamped for length only and marked, with the exact number printed.
- From 1024 px: a sticky left column (comparison and network) and the cards on the right; below that, one column in the order comparison, network, cards.
- Phenotypes are shown side by side verbatim; nothing is harmonised across databases.
- The footer becomes one line that always shows the release id. The full provenance, unchanged, moves with the About text into one native `<dialog>` panel opened from the header and the footer. Opening it does not change the URL. A provenance load error stays visible in the footer.

## Consequences

Absence of a match is stated rather than implied. The release id stays visible while the checksums move one click away. Tests enforce: comparison rows equal the cards (Vitest at minimum identities 0, 80% and 90% on the fixture, and the networkx oracle cases on the release; Playwright at three minimum identities); the network is built from the same groups but is not compared with the strip directly; one no-match row per empty database; hand-worked bar pixels; every provenance field present in the panel and equal to `provenance.json`; contrast and keyboard paths for the panel and the bars. #11 (visual QA, screenshots, docs) runs after this work so it is done once.
