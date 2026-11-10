# 0004. Show all matches per database, flag the best by identity

- Status: proposed
- Date: 2026-11-10
- Deciders: repo owner
- Kind: scientific

## Context

The old API keeps one match per other database: the highest identity, only if identity >= 0.9 (hardcoded), taking the first edge on ties. The cut-off and tie break are undocumented, so users cannot see lower-identity or tied candidates.

## Options considered

1. Port the rule exactly (ties arbitrary)
2. Show all matches with identity, coverage and RBH/OWH type; flag all tied best matches; identity threshold adjustable, default 0.9

## Decision

Option 2. The default view shows every match at or above 0.9 with the best flagged, a superset of the old output: the old best-per-database match is always shown and flagged. Ties and the threshold are compared at 3 decimals of the identity fraction (the displayed precision).

## Consequences

The default view lists more rows than the live site where a database has several matches at or above 0.9. The oracle test (Python networkx on the real graph) checks that the best-flagged rows equal the old rule with ties expanded, and that every other row is an edge at or above the threshold.

## Addendum: lookup rule (ticket #6)

Entries are found by exact, case-sensitive match on id, name, alternative id or duplicate allele id (`docs/data-contract.md`), listing every candidate when more than one entry matches. Why exact: a gene name that differs by case or brackets (`tetM` vs `tet(M)`) can be a different entry, and silently normalising could show the wrong gene. The cost is that a researcher using an old or mistyped name gets no result; the not-found message says what was tried and gives the `tet(M)` and version-suffix examples. Retired-id messages are deferred (no list of retired ids is published).

## Addendum: evidence (ticket #7)

On release graph-2026.11.09 the old rule hid a tie in 961 entry-and-database pairs by picking one match arbitrarily; the new default view lists all tied matches, each flagged best. The default view is checked for every one of the 15859 entries against an independent networkx implementation of the old rule (best-flagged rows equal the old rule with ties expanded; every row at or above 0.9; threshold 0 keeps every out-edge). The user can lower the minimum identity (slider, 0 to 100% in 1% steps, default 90%); rows below 90% are never flagged best unless no match in that database reaches 90%, in which case the best among the shown matches is flagged (best is relative to the matches shown).

Weak matches (owner decision, ticket #7): on this release 2041 of 31501 entry-and-database groups have a top identity below 0.9, and 659 below 0.5 (1891 of their 1899 edges are one-way hits). Best is by identity only; measured on graph-2026.11.09, no group has a one-way best match while a reciprocal best hit exists at lower identity (asserted by the oracle on every release update), and best rows with coverage below 0.5 are rare (2 at the default). Below 90% the badge reads "Highest identity shown" with a weak-evidence warning instead of "Best"; every match stays visible. The slider position persists across searches.
