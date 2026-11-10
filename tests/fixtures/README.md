# Fixtures

## graph.json

Hand-written, kind: hand-written minimal (level 1 oracle). Same schema as a ChamRedB release `graph.json` (node-link, directed). Not derived from a release; names are invented. Generator: none (edit by hand). Data contract: `docs/data-contract.md`.

Exercises: a native id shared by two databases (`ARO:1000` is in card and resfinder, so a bare search is ambiguous), an identity exactly at the default threshold (0.9) that is not the best match, a tie in best identity (two NCBI hits at 0.97), a match below the default threshold 0.9 (resfinder:blaXlow 0.85, card:ARO:2000 to resfinder:tetM 0.88), coverage above 1 (1.05), a renamed-looking CARD name (`tet(M)` vs ResFinder `tetM`), alternative and duplicate allele ids, an entry with no matches (resfinder:orphan), which is also an entry without a phenotype (shown as "not recorded"; resfinder:blaXlow has none either, so a match row without a phenotype is covered), and an entry with both a phenotype and an additional phenotype (card:ARO:2000).

Counts worked by hand: 10 entries (card 2, ncbi 3, resfinder 5), 10 directed matches. The coverage 1.05 is invented to exercise rendering above 100%; it is not evidence about the real graph.

Deferred, on purpose: the independent Python networkx oracle for match groups on the real graph (ticket #7). Lookup (ticket #6) has hand-worked expectations below and a networkx oracle on the real graph in `tests/oracle/` (networkx 3.7, pinned in `tests/oracle/requirements.txt`). Display: identity and coverage are shown as percentages to 1 decimal (0.97 shows 97.0%). Identity ties and the threshold are compared at 3 decimals of the fraction, which is the displayed precision.

### Expected values (worked by hand from the edge list)

Matches are the outgoing edges of the query. A match is shown if identity >= threshold; the best match per database is the highest identity, all ties flagged best.

| Query | Threshold | Database | Shown matches (identity) | Best |
| --- | --- | --- | --- | --- |
| card:ARO:1000 | 0.9 | ncbi | WP_1.1 (0.97, RBH), WP_3.1 (0.97, OWH), WP_4.1 (0.9, OWH, exactly at the threshold) | WP_1.1 and WP_3.1 (tie); WP_4.1 shown, not best |
| card:ARO:1000 | 0.9 | resfinder | blaX (1.0, RBH); blaXlow (0.85) hidden | blaX |
| card:ARO:1000 | 0 | resfinder | blaX (1.0), blaXlow (0.85) | blaX |
| card:ARO:2000 | 0.9 | ncbi | WP_4.1 (0.92, coverage 1.05) | WP_4.1 |
| card:ARO:2000 | 0.9 | resfinder | none (tetM 0.88 hidden), so no group | n/a |
| card:ARO:2000 | 0.8 | resfinder | tetM (0.88, OWH) | tetM |
| resfinder:orphan | any | n/a | no groups | n/a |
| ARO:1000 (bare) | any | n/a | two candidates, card:ARO:1000 and resfinder:ARO:1000, user must choose | n/a |

Sign-off: signed off by the repo owner on 2026-11-10 after reviewing the edge list and the expected results (exactly 0.9 is shown, ties are all best, below 0.9 is hidden).

### Lookup (exact, case-sensitive; best way listed: id, then name, then alternative id, then duplicate allele id)

| Text | Database | Candidates (matched on) |
| --- | --- | --- |
| card:ARO:1000 | any | card:ARO:1000 (id) |
| ARO:1000 | any | card:ARO:1000 (id), resfinder:ARO:1000 (id) |
| blaX | any | card:ARO:1000 (name), resfinder:blaX (id, since its native id is blaX) |
| blaX | card | card:ARO:1000 (name) |
| blaX | ncbi | none |
| tet(M) | any | card:ARO:2000 (name) |
| NG_1.1 | any | ncbi:WP_1.1 (alternative id) |
| WP_2.1, NG_2.1 | any | ncbi:WP_1.1 (duplicate allele id) |
| blax, ARO:9999, empty | any | none |

### Phenotype (shown verbatim from the node; `not recorded` when absent)

| Entry | Phenotype shown | Additional phenotype shown |
| --- | --- | --- |
| card:ARO:1000 | confers resistance to antibiotic: cephalosporin | none (field not shown) |
| card:ARO:2000 | confers resistance to drug class: tetracycline antibiotic | confers resistance to antibiotic: tetracycline |
| resfinder:orphan | not recorded | none |
| resfinder:blaXlow (as a match) | not recorded | none |
| every other entry | its `phenotype` string in `graph.json` | none |
