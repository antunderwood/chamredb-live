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

Option 2. Default view matches the old rule except that ties are all shown.

## Consequences

Results differ from the live site only where there are ties or the user lowers the threshold. The oracle test (Python networkx on the real graph) checks the default view equals the old rule with ties expanded.
