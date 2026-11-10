# Fixtures

## graph.json

Hand-written, kind: hand-written minimal (level 1 oracle). Same schema as a ChamRedB release `graph.json` (node-link, directed). Not derived from a release; names are invented. Generator: none (edit by hand). Data contract: `docs/data-contract.md`.

Exercises: a native id shared by two databases (`ARO:1000` is in card and resfinder, so a bare search is ambiguous), an identity exactly at the default threshold (0.9) that is not the best match, a tie in best identity (two NCBI hits at 0.97), a match below the default threshold 0.9 (resfinder:blaXlow 0.85, card:ARO:2000 to resfinder:tetM 0.88), coverage above 1 (1.05), a renamed-looking CARD name (`tet(M)` vs ResFinder `tetM`), alternative and duplicate allele ids, and an entry with no matches (resfinder:orphan).

Counts worked by hand: 10 entries (card 2, ncbi 3, resfinder 5), 10 directed matches. The coverage 1.05 is invented to exercise rendering above 100%; it is not evidence about the real graph.

Deferred, on purpose: lookup by name, alternative id and duplicate allele id, and the renamed-id case (ticket #6); the independent Python networkx oracle on the real graph (tickets #6 and #7). Display: identity and coverage are shown as percentages to 1 decimal (0.97 shows 97.0%). Identity ties and the threshold are compared at 3 decimals of the fraction, which is the displayed precision.

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

Sign-off: not yet signed by a human (oracle unsigned).
