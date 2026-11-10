# Data contract: match list

One view: the matches of one query entry.

- **Input:** a ChamRedB release `graph.json` (node-link, directed). Entry id is `<database>:<native id>`; databases are `card`, `ncbi`, `resfinder`.
- **Rows:** one per outgoing edge of the query entry, to an entry in another database.
- **Columns:** target native id and name; identity (fraction of identical residues, 0 to 1, shown as a percentage to 1 decimal); coverage (alignment length / query length, may exceed 1, shown as a percentage to 1 decimal); type (`RBH` or `OWH`); best (boolean).
- **Filter:** identity >= minimum identity (default 0.9), compared at 3 decimals of the fraction (the displayed precision), so 0.8996 counts as 0.900.
- **Grouping:** by target database. A database with no row after filtering has no group.
- **Best:** per group, all rows whose identity equals the group's maximum (ties all best, compared at the same 3 decimals). Best is relative to the rows shown: lowering the minimum identity can show a group whose top identity is below 0.9, and that top row is still flagged. The UI labels such a group "Highest identity shown" with a weak-evidence warning, not "Best" (ADR 0004).
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

- Shown for the entry looked up (a header block with its composite id, name and database) and for each match row (labelled "Phenotype of this match": it is the matched entry's phenotype, which can differ from the query's even at high identity). Source: the entry's `phenotype` and `additional_phenotype` in `graph.json`.
- The text is shown exactly as stored (capitalisation, punctuation, commas), as plain text, never rephrased, shortened, inferred or merged: the phenotype and the additional phenotype are separate labelled fields. The additional phenotype is shown only when present.
- An entry with no phenotype shows `not recorded` (with "in this database"); the header and each match row add: "This is a gap in the source record, not a statement that the gene confers no resistance." Wording such as "no phenotype" or "susceptible" is never used.
- Counts in graph-2026.11.09: 15734 of 15859 entries have a phenotype (125 CARD entries have none), 1260 have an additional phenotype (counts asserted in `src/release.test.ts`).
- Oracle: `src/phenotype.test.ts` compares the shown text of every entry to the raw `data/graph.json` value, with fixed entries copied from a plain Python read (no phenotype: `card:ARO:3000124`; both fields: `card:ARO:3000118`); `tests/phenotype.spec.ts` compares the page text to the raw fixture.
