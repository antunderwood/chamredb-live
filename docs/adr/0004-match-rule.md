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
