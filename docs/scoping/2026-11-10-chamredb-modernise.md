# Scoping: modernise chamredb-live and adopt release graph-2026.11.09

- Date: 2026-11-10
- Workflow: Web app (full). Runner-up considered: Maintenance (data swap only)
- Next command: /bio-spec

## Request

Replace the Next.js server app with a static, client-side Web app on a modern stack and polished UI, serving ChamRedB release graph-2026.11.09, to look up an entry and see its matches in the other source databases.

## Why this workflow

New static client app with new UI, so Web app; the data refresh is its first slice. Light path does not apply to a new Web app. Data policy: `open` (public data, ADR 0001).

## Prior art

Recorded from memory, not looked up: CARD RGI, AMRFinderPlus and ResFinder each have their own site, none cross-reference the three; hAMRonization harmonises tool outputs, not databases. Registries (bio.tools, npm) not searched, as this is the owner's own tool being rebuilt.

## Findings

### Facts

- New release schema is identical to the one in the repo: same node keys (database, id, name, phenotype, alternative_id, duplicate_allele_ids, product, is_a, PMID, additional_phenotype), same edge keys (source, target, identity, coverage, type) (source: both graph files inspected).
- Size: entries 11718 to 15859, matches 33632 to 51971; 13.7 MB raw, 0.6 MB gzip (source: graph.json).
- Built from CARD 4.0.2, AMRFinderPlus 4.2 (2026-10-29.1), ResFinder commit eecf0aa (source: release notes, data_manifest.json).
- ID continuity: 11499 old ids kept, 88 absent, 131 reassigned to a different name, mostly CARD renames such as tetM to tet(M) (source: diff_report.md). `name` lookups by old names (for example `tetM`) will no longer hit.
- Of the four homepage examples, `ncbi:NG_050598.1` is not in the new graph; the other three are (source: id check).
- Repo's current data is the 2021-10-20 snapshot.

### Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Hardcoded 0.9 cut-off and arbitrary tie break hide matches | High | Wrong or incomplete cross-database mapping | ADR 0004, show all matches, oracle on real graph |
| Old ids and names removed or reassigned break bookmarks and examples | Medium | Silent wrong entry or not found | "Not found" message names the release; replace stale example; consider a retired-id note |
| Lookup by name or alternative id is ambiguous (names can repeat across databases) | Medium | Wrong entry shown | Typeahead lists candidates with database; never auto-pick silently |
| Moving hosting to GitHub Pages breaks the live URL | Medium | Dead links | Decide redirect plan (open question) |
| Identity and coverage definitions unconfirmed | Medium | Misleading labels | Confirm from the chamredb build code before writing UI text |

### Open questions

| Question | Owner | Blocking? |
| --- | --- | --- |
| Exact definitions of identity and coverage, and RBH/OWH, in the chamredb build | repo owner | Resolved 2026-11-10 (ticket #2), see GLOSSARY.md |
| GitHub Pages: does this repo move to GitHub, or mirror from GitLab; what about the Render URL | repo owner | Resolved 2026-11-10 (ticket #3): move to GitHub, archive GitLab; Render becomes a redirect page (ADR 0003) |
| Ship graph.json as is, or a build-time compact index; where the release is pinned (committed file or fetched in CI by tag) | /bio-spec | No |
| Network graph view scope and library (custom SVG preferred, no runtime libraries from CDNs) | /bio-spec | No |
| Name for the new retired-id handling (none, or a list from the release) | repo owner | No |

## Cost of being wrong

A wrong cross-database mapping misleads researchers choosing AMR determinants, but nothing clinical is decided by the site. Needs a real-data oracle (Python networkx differential test); no scientific reviewer is named (`science_reviewer: none`).

## Pre-mortem

1. Matches silently differ from the old site (threshold, ties, renamed ids): oracle test plus ADR 0004.
2. Client performance or memory on mobile with the 13.7 MB graph: build-time compact index, measure parse time; gzip is served by Pages.
3. Host move leaves the old URL dead: settle redirect before deploy.

## Decisions

- ADR 0002: static client-side app (proposed)
- ADR 0003: Vite, React, TypeScript, GitHub Pages (proposed)
- ADR 0004: show all matches, flag best (proposed)

## Scope of first version

Typeahead search by id, name, alternative id; shareable URL hash; release provenance in footer; match list with identity, coverage, type; adjustable identity threshold (default 0.9); network graph view (custom SVG); neutral light and dark theme from `public/theme.css`; About page content kept.

## Out of scope

Backend, accounts, analytics, BSB branding, genome coordinate views, uploads of user data.
