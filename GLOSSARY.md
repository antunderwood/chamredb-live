# GLOSSARY

## Project

- **Project goal:** Static web front end for looking up an antimicrobial resistance (AMR) gene in one source database and finding its matches in the others.
- **Reference:** see `.bio-skills.yaml` (ChamRedB release graph-2026.11.09).

## ChamRedB

| Term | Meaning in this project | Not to be confused with |
| --- | --- | --- |
| Release | One tagged build of the graph (for example `graph-2026.11.09`) with `graph.json`, `data_manifest.json`, `diff_report.md` | Source database version |
| Source database | One of CARD, NCBI AMRFinderPlus, ResFinder, at the version listed in the release's manifest | ChamRedB itself |
| Entry (graph node) | One record of a source database, id `<database>:<native id>` (for example `card:ARO:3000230`) | Gene, allele |
| Match (graph edge) | A directed link from one entry to an entry in another database, with identity, coverage and type | Best match |
| RBH | Reciprocal best hit: edge type `RBH`, found with MMseqs2 `easy-rbh -s 7.5` | OWH |
| OWH | One-way hit: edge type `OWH`, found with MMseqs2 `search -s 7.0 --max-accept 3` (directed, no reciprocal best hit) | RBH |
| Identity | Fraction of identical residues in the match, 0 to 1 (not percent) | Coverage | Alignment length / query length, a fraction that can exceed 1 (shown as a percentage that may exceed 100%) | Identity |
| Coverage | Alignment length / query length, a fraction that can exceed 1 (shown as a percentage that may exceed 100%) | Identity |
| Best match | The match with the highest identity to one other database among the matches shown (those at or above the minimum identity); ties are all best. By identity only: it ignores coverage and RBH/OWH. Below 90% identity the UI says "Highest identity shown" instead | Single arbitrary first hit; the right equivalent gene |
| Query | The entry the user looked up (by id, name, alternative id or duplicate allele id) | Search text |
| Database filter | Optional restriction of which entry a search finds to one database; the matches shown still cover the other databases | Which database the matches come from |
| Phenotype | Text the source database gives for what an entry confers (for example "confers resistance to ..."), shown verbatim; "not recorded" when the entry has none (a gap in that record, not evidence of no resistance). The additional phenotype is a second, separate source field | Resistance profile inferred by this app (it infers nothing) |
