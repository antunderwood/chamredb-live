# 0002. The app is static and queries the graph in the browser

- Status: proposed
- Date: 2026-11-10
- Deciders: repo owner
- Kind: engineering

## Context

The current app is Next.js 11 with an API route that loads `utils/chamredb.json` (9 MB) into jsnetworkx on a server (Docker image, Render). Release graph-2026.11.09 is 13.7 MB raw, 0.6 MB gzipped, 15859 entries and 51971 matches, public data.

## Options considered

1. Static client-side app: no backend, graph shipped as a static file and queried in the browser
2. Keep a Node server: runtime cost and an API to maintain for public data of this size

## Decision

Static, client-side only. No backend, no analytics, no third-party origins at runtime. Queries never leave the browser. Verified by a Playwright network-egress test (bio-webapp).

## Consequences

Server, API route, jsnetworkx, Dockerfile and image build go away. A later proposal for a backend must supersede this ADR. The graph is transformed to a compact index at build time.
