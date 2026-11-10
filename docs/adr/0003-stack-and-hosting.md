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

Option 1 for the stack. Hosting is GitHub Pages, as chosen by the owner. This needs the repo mirrored to or moved to GitHub; the migration (and what happens to the GitLab remote, `.gitlab-ci.yml` and the Render URL) is an open question in the scoping note.

## Consequences

`.gitlab-ci.yml` and `Dockerfile` are removed or replaced by a Pages workflow. `.bio-skills.yaml` tracker stays gitlab until the repo moves.
