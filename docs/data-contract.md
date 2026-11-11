# Data contract: match list

One view: the matches of one query entry.

- **Input:** a ChamRedB release `graph.json` (node-link, directed). Entry id is `<database>:<native id>`; databases are `card`, `ncbi`, `resfinder`.
- **Rows:** one per outgoing edge of the query entry, to an entry in another database.
- **Columns:** target native id and name; identity (fraction of identical residues, 0 to 1, shown as a percentage to 1 decimal); coverage (alignment length / query length, may exceed 1, shown as a percentage to 1 decimal); type (`RBH` or `OWH`); best (boolean).
- **Filter:** identity >= minimum identity (default 0.9), compared at 3 decimals of the fraction (the displayed precision), so 0.8996 counts as 0.900.
- **Grouping:** by target database. A database with no row after filtering has no group.
- **Best:** per group, all rows whose identity equals the group's maximum (ties all best, compared at the same 3 decimals). Best is relative to the rows shown: lowering the minimum identity can show a group whose top identity is below 0.9, and that top row is still flagged. The UI labels such a group "Highest identity shown" with a weak-evidence warning, not "Best" (ADR 0004); the page says 90% is a working default taken from the earlier site, not a validated cut-off.
- **n:** matches shown per group; entries counted from the release, not the filter.
- **Integrity:** the build fails on a duplicate entry id, a duplicate edge, or an edge whose source or target is not an entry.
- **Index:** built at build time from the release (`src/parse.ts`) into `index.json` served from the app's own origin: `entries` by id, `edges` by source id.

Definitions: GLOSSARY.md.

## Lookup

- Input: text typed by the user, trimmed. Output: every entry the text identifies, sorted by id (code-point order), each with how it matched.
- The text must equal exactly (case-sensitive, including brackets and version suffixes, no fuzzy or versionless matching) one of: the composite id (`card:ARO:3000230`), the native id (`ARO:3000230`), the name, an alternative id value, or a duplicate allele id.
- An entry matched in several ways is listed once with the best way, in this order: id, name, alternative id, duplicate allele id.
- Several entries can match (a name shared across databases is common: 2506 of the strings in graph-2026.11.09). All are listed with their database; the app never picks one.
- A prefixed accession such as `ncbi:NG_050598.1` is not an id and finds nothing; the bare accession `NG_050598.1` finds the entry listing it as a duplicate allele id (owner decision, ticket #6).
- Oracle: `tests/oracle/` (networkx 3.7): 22 fixed cases and every searchable string in the release (51913) by hash.
- Oracle (matches): `tests/oracle/matches.py` with 8 fixed cases and every entry at 0.9, 0.5 and 0 by hash (47577).
- The minimum identity is a user slider (whole percent, 0 to 100, default 90) and persists across searches.

## Shareable link and suggestions

- The address records the search: `#q=<text>&db=<card|ncbi|resfinder>&min=<0 to 100>&rel=<release>`, defaults omitted (no database filter, minimum identity 90), values encoded as application/x-www-form-urlencoded. `q` is the submitted text (it changes on Search or Enter); the database filter and minimum identity apply immediately. `rel` is the ChamRedB release in use and is written only with a search. The address is updated in place (no history entries: Back leaves the page).
- The hash is not sent to a server by the browser, but anyone given the link can read the search. Invalid or missing values fall back to the defaults; the first of a repeated key wins; the query is trimmed and limited to 200 characters (the search box has the same limit). A link pasted into an open page applies at once and the address is normalised.
- A link keeps the release it was made with until a new search is submitted. If it differs from the release in use the page says so: ids and names can be retired or reassigned between releases (88 absent and 131 reassigned between the two most recent releases).
- The database filter narrows which entry is found (and which completions are offered); the matches shown for the found entry always cover the other databases. With a filter that hides entries with the same text in other databases, the page lists them.
- Completions (native `<datalist>`): searchable strings that start with the typed text (at least two characters, case-insensitive), ranked id, name, alternative id, duplicate allele id (ranked within the chosen database when one is set), then shorter, then code-unit order; at most 10. Browsers may filter the offered list further. Choosing a completion fills the box; the search runs on Search or Enter, and the exact lookup rule above still applies (case-sensitive). Measured on the real index: 60 ms for the first completion, 1 to 3 ms after.

## Phenotype

- Shown for the entry looked up (the query panel: chips Query, database and name with composite id, then a Phenotype card) and for each match (its own panel; Phenotype card labelled "Phenotype of this match": it is the matched entry's phenotype, which can differ from the query's even at high identity). Source: the entry's `phenotype` and `additional_phenotype` in `graph.json`.
- Side by side (#24, `src/SideBySide.tsx`, `src/sideBySideModel.ts`): below the query panel, one column per source database, the query's first, each entry's phenotype as stored, in the same pieces as its own card (`PhenotypeBody`). A database column holds that database's best matches (every one of a tie), labelled "Best match", or "Highest identity shown" when the group is below 90% identity; a database with no match at the current minimum identity says so, with how many matches the minimum hides. Nothing is merged, normalised or mapped between the databases, and shared terms are not highlighted (owner decision on #18). The view is not shown when no other database has a match. Tests: `src/sideBySideModel.test.ts` (recomposition from the raw graph, database labels, "not recorded") and `tests/phenotype.spec.ts`.
- The text is shown exactly as stored (capitalisation, punctuation, commas), as plain text, never rephrased, shortened, inferred or merged: the phenotype and the additional phenotype are separate labelled fields. The additional phenotype is shown only when present.
- An entry with no phenotype shows `not recorded` (with "in this database"); the header and each match row add: "This is a gap in the source record, not a statement that the gene confers no resistance." Wording such as "no phenotype" or "susceptible" is never used.
- Other metadata (ticket #8), shown in an Other metadata card on the query panel and on every match panel, each field only when present and as stored: `PMID` values (a link to `https://pubmed.ncbi.nlm.nih.gov/<id>/`, opening in a new tab with `rel="noopener noreferrer"`, only when the value is digits; the release has one value, on card:ARO:3001313, of the form `DOI:10.1039/C2MD20038D`, which is shown as plain text because it is not a PubMed id), `is_a` and `product`. An entry with none shows "No other metadata recorded in this database". Counts: 2262 entries with a PMID, 5971 with is_a, 7299 with a product (asserted in `src/cardModel.test.ts`).
- Counts in graph-2026.11.09: 15734 of 15859 entries have a phenotype (125 CARD entries have none), 1260 have an additional phenotype (counts asserted in `src/release.test.ts`).
- Oracle: `src/phenotype.test.ts` compares the shown text of every entry to the raw `data/graph.json` value, with fixed entries copied from a plain Python read (no phenotype: `card:ARO:3000124`; both fields: `card:ARO:3000118`); `tests/phenotype.spec.ts` compares the page text to the raw fixture.

## Network model and expansion

Pure model in `src/networkModel.ts` (`buildNetwork`), geometry in `src/networkLayout.ts`, tooltip text in `src/networkTooltip.ts` (tickets #9 and #10).

- Step 1 is exactly `matchGroups` for the query: the same nodes, order, identities, coverages, types and best flags as the list. A group whose top identity is below 90% (compared at 3 decimals) is weak: its best node is "highest identity shown", never "best".
- Expanding a step-1 node adds that entry's own matches, from `matchGroups` for that entry at the same minimum identity (one rule, not two). Such a node is a step-2 node: a match of a match, never a match of the query, and it always carries `via` (the expanded entry) so it is always labelled "match of <via>". Its best and weak flags are those of its group among the matches of `via`, not of the query. Only step-1 nodes can be expanded (no third step); other ids are ignored.
- A step-2 hit on the query or on a step-1 node is not a new node: an extra edge between the existing nodes is added and marked step 2, and that node keeps its step-1 role and flags. Every expanded RBH match therefore adds its reverse edge to the query; it is expected from reciprocity, not independent evidence, so the UI should hide it by default or label it as the reverse of the match; step-2 edges must always be visibly distinct from step-1 edges and never merged into them. Identity, coverage and best of a step-2 node are between its via and the node, never inferable for the query.
- A step-2 node reachable from several expanded entries appears once, with the first-ranking hit as `via` and flags (highest identity at 3 decimals, then the smaller via id); every edge is kept.
- Cap: at most 25 drawn nodes in total, the query included (`MAX_NODES`). Step-1 nodes are never dropped (the list shows them all; the maximum out-degree in graph-2026.11.09 is 6 over all edges, so step 1 is at most 6 nodes at any minimum identity, and a release with a larger hub would exceed the cap by design), so only step-2 nodes count against the cap. When it would be exceeded, new step-2 nodes are kept by identity (descending, at 3 decimals) then id (code-unit order) until the cap, edges to dropped nodes are not returned and `truncated: { dropped: n }` is set. The UI must show the message.
- Determinism: nodes are the query, step-1 nodes in list order, then step-2 nodes by via order and the via's list order; edges likewise. The result does not depend on the order or repeats in `expandedIds`.
- Oracle: `tests/oracle/expand.py` (10 fixed entries at 0.9 and 0.5, and every entry at 0.9 with all step-1 nodes expanded, 15859 by hash) plus hand-worked fixture cases.
- Known difference: the list and the old picture decide weak with an unrounded comparison (`identity < 0.9`); the model rounds to 3 decimals like `matchGroups`. They agree on every identity in this release (3 decimals).
- `visibleEdges` (used by the picture): a step-2 edge from a step-1 node back to the query is hidden when the query's own edge to that node is an RBH (the reverse is expected from reciprocity); it is kept for a one-way match, where it is a separate hit. The number hidden is reported and shown in the caption. `ownMatchCount` is the number on an expand control: the node's matches at the same minimum identity, not counting the query (it counts new nodes and links to shown nodes alike); a node with none gets no control.
- Expansion state is not in the shareable link (conservative default for ticket #10: the link records the search, and a link that opens expanded would hide the one-step picture; owner may reverse).
- An unknown query id throws (a programmer error): callers must check the id exists, and a stale hash must be handled by the caller before calling `buildNetwork`.
