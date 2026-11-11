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

### Other metadata (ticket #8; shown only when present, verbatim)

| Entry | PMID (links to `https://pubmed.ncbi.nlm.nih.gov/<id>/`) | is_a | product |
| --- | --- | --- | --- |
| card:ARO:2000 (every field) | 10000002, 10000003 linked; `DOI:10.0000/hand-written` shown as text, not linked (it is not a PubMed id; the real graph has one such value, `card:ARO:3001313`) | ARO:0000002:ribosomal protection protein | hand-written product of tet(M) |
| card:ARO:1000 | 10000001 | ARO:0000001:beta-lactamase | none |
| ncbi:WP_1.1 | none | none | class A beta-lactamase BlaX-1 |
| resfinder:orphan (no field at all) | none | none | none |

The invented `is_a`, `product` and PMIDs on card:ARO:2000 exist to cover an entry with every field; a real CARD entry never has a product.

### Comparison strip (ticket #20; worked by hand from the match table above)

One row per source database other than the query's, in the order card, ncbi, resfinder, from the query's own matches (out-edges) only. A row lists every match flagged best (ties all listed), its identity, coverage and type, and the number of matches shown in that database. A database with no match at or above the minimum identity has one "No match at or above N% identity" row and no bar, with the number of matches the minimum hides (0: none at any identity). Below 90% the label is "Highest identity shown", not "Best".

| Query | Min | Database | Row |
| --- | --- | --- | --- |
| card:ARO:1000 | 90% | ncbi | Best: WP_1.1 (97.0%, 100.0%, RBH) and WP_3.1 (97.0%, 100.0%, OWH); 3 matches shown |
| card:ARO:1000 | 90% | resfinder | Best: blaX (100.0%, 100.0%, RBH); 1 match shown |
| card:ARO:1000 | 80% | resfinder | Best: blaX (100.0%, 100.0%, RBH); 2 matches shown (blaXlow 0.85 counted, not best) |
| card:ARO:2000 | 90% | ncbi | Best: WP_4.1 (92.0%, 105.0% with the overflow mark, RBH); 1 match shown |
| card:ARO:2000 | 90% | resfinder | No match at or above 90% identity; 1 match below 90% (tetM 0.88) |
| card:ARO:2000 | 80% | resfinder | Highest identity shown: tetM (88.0%, 100.0%, OWH); 1 match shown |
| resfinder:orphan | 90% | card, ncbi | No match at or above 90% identity (both); no match at any identity |

### Bar scale (src/bars.ts; worked by hand, bar width W = 200 px)

`length = min(max(value, 0), 1) x W`; `overflow` when the value is above 1 at the displayed precision (`round(value x 1000) > 1000`), so 1.0004 (printed 100.0%) has no mark.

| Value | Length (px) | Overflow |
| --- | --- | --- |
| 0 | 0 | no |
| 0.5 | 100 | no |
| 0.9 (the weak line) | 180 | no |
| 1.0 | 200 | no |
| 1.3 (a coverage) | 200 | yes |

So in the strip the dashed weak-evidence mark, labelled "90%", is drawn at x = 180 on every identity bar. The minimum identity is a filter and is not drawn on the bars (owner decision, 2026-11-11). tetM at 80% has a 176 px fill, ending just short of the mark.

Sign-off: worked by the implementer from the signed match table above, re-derived by an independent reviewer, and signed off by the repo owner on 2026-11-11 (comparison strip rows 1 to 7 and the bar scale, with the single labelled 90% mark and no minimum identity line on the bars).
