# Data contract: match list

One view: the matches of one query entry.

- **Input:** a ChamRedB release `graph.json` (node-link, directed). Entry id is `<database>:<native id>`; databases are `card`, `ncbi`, `resfinder`.
- **Rows:** one per outgoing edge of the query entry, to an entry in another database.
- **Columns:** target native id and name; identity (fraction of identical residues, 0 to 1, shown as a percentage to 1 decimal); coverage (alignment length / query length, may exceed 1, shown as a percentage to 1 decimal); type (`RBH` or `OWH`); best (boolean).
- **Filter:** identity >= minimum identity (default 0.9), compared at 3 decimals of the fraction (the displayed precision), so 0.8996 counts as 0.900.
- **Grouping:** by target database. A database with no row after filtering has no group.
- **Best:** per group, all rows whose identity equals the group's maximum (ties all best, compared at the same 3 decimals).
- **n:** matches shown per group; entries counted from the release, not the filter.
- **Integrity:** the build fails on a duplicate entry id, a duplicate edge, or an edge whose source or target is not an entry.
- **Index:** built at build time from the release (`src/parse.ts`) into `index.json` served from the app's own origin: `entries` by id, `edges` by source id.

Definitions: GLOSSARY.md.
