# 0001. Data policy is open

- Status: accepted
- Date: 2026-11-10
- Deciders: repo owner
- Kind: data-policy

## Context

The repo is the ChamRedB live site. Its only data (`utils/chamredb.json`, derived from the public ChamRedB graph release) is already served publicly by the site. No patient, sample or confidential data is in scope.

## Options considered

1. restricted: safe default, but blocks the agent from reading the public database it must work on
2. open: matches the data's actual public status

## Decision

`data_policy: open`. All data in this repo is public.

## Consequences

Agents may read, print and commit records from `utils/chamredb.json`. If any non-public data is ever added, revert to `restricted` and record a new ADR.
