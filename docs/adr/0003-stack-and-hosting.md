# 0003. Vite, React, TypeScript, Vitest, Playwright, hosted on GitHub Pages

- Status: proposed
- Date: 2026-11-10
- Deciders: repo owner
- Kind: engineering

## Context

Next 11, React 17 and Tailwind 2 are end of life, and Next adds nothing once the API route is gone (ADR 0002). Today the repo is on GitLab (CI builds a Docker image) and is served from Render.

## Options considered

1. Vite + React + TypeScript (strict), Vitest, Playwright, Tailwind 4
2. Next.js 15 static export
3. GitHub Pages, GitLab Pages or Render static as host

## Decision

Option 1 for the stack. Hosting is GitHub Pages, as chosen by the owner. The repo moves to GitHub and the GitLab project is archived (decided 2026-11-10, ticket #3). The old chamredb.onrender.com is replaced by a one-page static site that links to the new URL. Moving issues and labels from GitLab to GitHub, and updating `.bio-skills.yaml` `tracker`, is a follow-up done at the time of the move.

## Consequences

`.gitlab-ci.yml` and `Dockerfile` are removed or replaced by a Pages workflow. `.bio-skills.yaml` tracker stays gitlab until the repo moves.

## Update (2026-11-10, ticket #13)

The repository moved to GitHub (`antunderwood/chamredb-live`, private until launch). `.bio-skills.yaml` `tracker` is now `github`; the 14 earlier issues and merge requests stay on GitLab, which is archived at launch. CI is `.github/workflows/pages.yml` (tests, oracle regeneration, publish to GitHub Pages). The data repository `antunderwood/chamredb` must be public before the site launches, because the footer and About links point to its release page.
