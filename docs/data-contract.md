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
