# 0005. Redesign: the old look modernised, richer result cards, and an interactive network picture

- Status: proposed
- Date: 2026-11-10
- Deciders: repo owner
- Kind: engineering

## Context

The first release (tickets #4 to #15 on GitLab) is correct and accessible but plain: no header, no example buttons, about 200 words of caveats above the first result, phenotype as a run-on string, no PMID or product metadata, and a small non-interactive network picture. The owner compared it with the 2021 site and wants that site's character back (purple header, colour chips, labelled cards, example buttons, dark toggle) with the newer content.

## Options considered

1. Keep the current look and polish spacing
2. Old look modernised on the existing token system (chosen)
3. BSB brand look or a new identity
4. Network picture: interactive SVG (chosen) versus HTML Canvas

## Decision

- Visual direction: the 2021 look modernised, on the one tokens file (`public/theme.css`): purple header with the wordmark chAMR😍Db (accessible name chAMReDB), nav (Query, About, Code), light and dark with a toggle (system default, choice kept in localStorage as a per-viewer convenience), colour chips (Query, database, name), labelled cards, example buttons. Contrast tests and the no-literal-colours test stay.
- Results become cards: a query panel and one panel per match, each with Phenotype, Other metadata (PMID links to PubMed, is_a, product) and Match details (identity, coverage, type, Best or weak label). The long caveats move into a collapsible "How to read this"; one short line stays above the results. The weak-evidence warning and "not recorded" notes stay visible where they apply.
- Phenotype is shown as a label plus bullets (CARD and ResFinder split on commas; NCBI subclass kept as one item because a slash can belong to a combination name). The shown pieces must recompose to the stored text exactly, tested on every entry of the release; an unknown shape falls back to the verbatim string.
- The network picture becomes an interactive SVG (supersedes the #11 decision that the picture is not focusable): nodes are focusable buttons; click makes the entry the new query (history steps through entries); hover or focus shows a tooltip; hover or click highlights and scrolls to the matching card; a node can be expanded to add its own matches. Expanded (second-step) nodes and edges are visually distinct and labelled "match of <entry>" because a match of a match is not a match of the query. All positions still go through one pure layout function with hand-worked pixel tests. The match list stays an equivalent for keyboard and screen readers.
- Canvas was rejected: this graph has dozens of nodes, SVG gives per-node DOM, keyboard and screen-reader access, tokens-only colours and dark mode for free.

## Consequences

Much of `src/main.tsx` is reorganised (new components, new tokens, new tests). The accessibility checks in `docs/accessibility.md` must pass for the new palette, including every colour chip pair. Expansion adds a "match of a match" concept that needs its own wording and tests. Old shareable links keep working (the hash format is unchanged); a pushed history entry is added per clicked node.
