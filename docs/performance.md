# Performance measurement (issue #12)

Spec trigger (issue #1, Performance): index parsed and search ready in under 2 s on a mid-range laptop (median of 5 runs
after one warm-up, in the browser); no main-thread block over 200 ms; Rust/WASM only if this is missed. Timing is a
measurement, not a test: nothing here runs in `npm test` or `npm run e2e`.

Reproduce: `npm run build && npm run measure` (about 20 minutes, almost all of it the raw 9 MB transfer at 1.6 Mbit/s;
`--profiles default-gzip,cpu6-gzip --runs 5` for a quick look, `--list` for profile names, `--json out.json` for every run).

## Verdict

| Threshold (spec) | Default (this laptop) | CPU 4x | CPU 6x | 1.6 Mbit/s network |
|---|---|---|---|---|
| Search ready, median under 2 s | PASS (66 ms) | PASS (257 ms) | PASS (388 ms) | MISS (4.1 s gzip, 48 s raw) |
| No main-thread block over 200 ms, load to ready | PASS (0 ms: no task over 50 ms) | PASS (max 112 ms) | PASS (max 184 ms) | PASS (max 62 ms at 1x CPU) |
| No main-thread block over 200 ms, typing and searching | PASS (0 ms) | PASS (max 127 ms) | MISS at the margin (see below) | PASS at 1x CPU |
| Combined 6x CPU and 1.6 Mbit/s | not applicable | not applicable | ready MISS (4.4 s), block MISS (max 282 ms) | |

**Rust/WASM is not triggered.** The only misses are (a) transfer time on a slow network, which WASM cannot reduce, and
(b) a block of about 180 to 270 ms at 6x CPU in the lookup-table build (first suggestions), that is 6 times slower than
this machine, where a chunked TypeScript build removes the block (see "Cheap TypeScript options"). Parse itself is 26 to
33 ms here (160 to 169 ms at 6x), far from the 2 s limit. The spec's own rule applies: try Web Worker and a faster
algorithm in TypeScript first. No app code was changed in this ticket.

Reading of the 6x row: the first completion after two keystrokes builds the lookup table (about 170 ms at 6x). Across two
full replicates its longest task was 178 to 207 ms (gzip) and 190 to 197 ms (raw): on the line, so it is recorded as a
MISS at the margin and not as a PASS. Replicate 1 (the same script, earlier the same day) had 207 ms for `cpu6-gzip`
and a startup maximum of 185 ms; the numbers below are replicate 2.

## What "search ready" covers

The timer starts at navigation start (`performance.timeOrigin`) and stops when the search box stops being `disabled`
(a MutationObserver sees the attribute removed after React commits the state holding the index), and a second figure
(see `--json`: `readyPainted`) adds two animation frames. Everything the user waits for is inside it: HTML, JS bundle,
React start, the `index.json` request, body download, `JSON.parse`, `setIndex`, render. Not inside it: browser launch,
the lookup-table build (first completion, measured separately), and the match rendering for a search.

Breakdown (medians, from the Resource Timing entry for `index.json` and a wrapper around `Response.prototype.json`
injected with `addInitScript`; the app is untouched):

- pre-fetch: navigation start to the `index.json` request (HTML, scripts, React start);
- fetch: request start to response end (the transfer);
- parse: `Response.json()` after the body has arrived (`JSON.parse` of the 9 MB text);
- render: end of parse to the box enabled (setState, React render and commit).

Long tasks come from a `PerformanceObserver` for `longtask` (main-thread tasks over 50 ms). They are reported for the
startup (task start before ready) and separately after ready (typing and searching). Verdict: a threshold is PASS only
if the longest task in every run is at most 200 ms (a stricter test than the median).

## Method

- Real release build: `npm run build` (the pinned `data/graph.json`, shipped as `dist/index.json`: 15859 entries, 9.28
  MB raw, 0.64 MB gzipped at level 6). The script refuses a build with fewer than 1000 entries (the test fixture).
- Chromium via Playwright, headless. One warm-up run per profile, discarded, then 5 measured runs. Every run uses a
  fresh browser context (empty HTTP cache and code cache); the browser process is kept, so launch cost is excluded.
- Server: a small `node:http` static server over `dist/` on port 4473, identical for both cases except that the gzip
  case sends `Content-Encoding: gzip` (compressed once at start, level 6, as GitHub Pages does) and the raw case sends
  the bytes as stored. `vite preview` was checked and sends no `Content-Encoding` for `index.json` (9,277,198 bytes), so
  the raw case is the same as the `vite preview` transfer. Gzip on the real host is an assumption: check it once on
  the deployed site with `curl -sI -H 'Accept-Encoding: gzip' <url>/index.json`.
- CPU throttling: CDP `Emulation.setCPUThrottlingRate` 4 and 6. Network throttling: CDP
  `Network.emulateNetworkConditions`, 1.6 Mbit/s down, 0.75 Mbit/s up, 150 ms RTT (the Lighthouse "slow 4G" figures;
  DevTools "Fast 3G" uses a longer RTT).
- After ready: type `ca` (the second keystroke gives the first suggestions and builds the lookup table), set the box
  to `card:ARO:3000230`, click Search, wait for the match sections to be painted.

## Machine

Darwin 27.0.0 arm64, Apple M2 (8 cores), 24 GiB, Node v26.4.0, Chromium 158.0.8127.18, 2026-11-10. Other work ran on the
machine during the measurement (load average about 4.6 of 8 at the start): numbers are slightly pessimistic and noisy.
This is a fast laptop; it is not a mid-range laptop and not a phone. No device other than this one was measured.

## Numbers (replicate 2, milliseconds, 5 runs each)

| Profile | Ready min / median / max | Longest task, load to ready, min / median / max | Pre-fetch | Fetch | Parse | Render | Wire (MB) | First completion | Search `card:ARO:3000230` | Longest task after ready |
|---|---|---|---|---|---|---|---|---|---|---|
| default, gzip | 64 / 66 / 71 | 0 / 0 / 0 | 32 | 6 | 26 | 1 | 0.64 | 31 | 31 | 0 |
| default, raw | 63 / 66 / 69 | 0 / 0 / 0 | 28 | 5 | 33 | 1 | 9.28 | 32 | 31 | 0 |
| CPU 4x, gzip | 253 / 257 / 279 | 100 / 103 / 112 | 93 | 49 | 109 | 5 | 0.64 | 114 | 50 | 119 |
| CPU 4x, raw | 253 / 255 / 267 | 101 / 104 / 108 | 93 | 47 | 110 | 5 | 9.28 | 117 | 49 | 127 |
| CPU 6x, gzip | 367 / 388 / 411 | 144 / 152 / 184 | 195 | 23 | 160 | 6 | 0.64 | 168 | 71 | 178 |
| CPU 6x, raw | 375 / 392 / 413 | 152 / 159 / 174 | 188 | 27 | 169 | 7 | 9.28 | 182 | 66 | 197 |
| 1.6 Mbit/s, gzip | 4090 / 4107 / 4117 | 0 / 51 / 57 | 722 | 3332 | 52 | 1 | 0.64 | 36 | 31 | 0 |
| 1.6 Mbit/s, raw | 48152 / 48163 / 48192 | 0 / 56 / 62 | 1571 | 46542 | 57 | 2 | 9.28 | 34 | 34 | 0 |
| CPU 4x and network, gzip | 4269 / 4286 / 4309 | 132 / 146 / 162 | 797 | 3332 | 148 | 5 | 0.64 | 114 | 48 | 137 |
| CPU 6x and network, gzip | 4341 / 4383 / 4417 | 182 / 190 / 282 | 819 | 3330 | 193 | 7 | 0.64 | 178 | 68 | 270 |

Notes on reading the table:

- The default rows have no long task at all (nothing over 50 ms), hence 0. The 6x JSON parse is a single task of 144 to
  184 ms, close to the 200 ms limit: the longest block at startup is the parse itself.
- Median parts do not add up exactly to the median ready time (medians of different columns).
- Under network throttling the 51 to 62 ms long task is the parse running once the last bytes arrive.
- The throttled transfer matches the arithmetic (0.64 MB / 200 kB/s = 3.2 s; 9.28 MB / 200 kB/s = 46 s), so the
  network emulation acts on the bytes on the wire as intended.
- Search for `card:ARO:3000230` includes React rendering the match list; it is 31 ms here and 71 ms at 6x.
- Replicate 1 (same script, not the numbers above): default 68 ms, 4x 263 ms, 6x 395 ms, 1.6 Mbit/s 4101 ms gzip and
  48172 ms raw; the 6x gzip longest task after ready was 207 ms, and 6x with network had 220 ms at startup.

## Cheap TypeScript options (measured, nothing committed)

Not needed for the 2 s threshold on any CPU profile, but the 6x block and the slow network are the open risks, so the
spec's "try TypeScript first" step was measured with a throwaway harness (not in the repo; the real `query.ts` for the
first suggestion, replicas for the others), 5 runs after a warm-up, medians, gzip, no network throttle:

| Option | Raw / gzip size | 6x parse | 6x first completion longest task | 6x ready | Verdict |
|---|---|---|---|---|---|
| Baseline (current index) | 9.28 MB / 636 kB | 196 ms | 178 ms (max 245) | 202 ms | |
| Drop fields the UI never shows (phenotype, product, is_a, PMIDs) | 7.04 MB / 530 kB (-24% / -17%) | 166 ms (1.2x) | 175 ms | 171 ms | small gain, below the 2x rule |
| Compact format (also no empty maps, no repeated id or database, edges as tuples) | 3.38 MB / 428 kB (-64% / -33%) | 99 ms (2.0x) | n/a | 105 ms | 2x on parse, needs `query.ts` and `parse.ts` to read the format |
| Parse in a Web Worker, post the object back | n/a | worker 35 ms | 173 ms | 298 ms (slower) | rejected: the structured clone back onto the main thread costs more than the parse and makes the longest task 225 ms |
| Build the lookup table in slices of 1500 entries with a yield | n/a | n/a | 0 ms (no task over 50 ms; table ready after 134 ms) | n/a | removes the block |

Recommendation for one follow-up ticket: build the lookup table in yielded slices (or in idle time right after ready)
so no first keystroke blocks the main thread. It is the only option that removes a measured over-200 ms task and it
changes one function. A worker only pays off if the whole lookup lives in it (search by message), which is a larger
design. The compact format is a second, independent follow-up for slow connections: it cuts gzip transfer by a third
(3.2 s to about 2.1 s of transfer at 1.6 Mbit/s) but no TypeScript option brings the slow-network case under 2 s
because the 0.43 MB floor alone takes more than 2 s plus latency there.

## What the numbers mean for users

- On this laptop the search box is usable about 66 ms after navigation starts, and a search shows matches within about
  100 ms of the box being ready. On a CPU 4 to 6 times slower, the box is usable after 0.26 to 0.39 s and the first
  suggestions appear about 0.12 to 0.18 s after the second keystroke. The spec asks for under 2 s from file chosen
  to result shown (the app has no file step; the equivalent is page load to result shown, 0.4 to 0.5 s at 6x CPU on a
  fast connection). That passes with a factor of about 4 to spare at 6x.
- On a slow connection transfer dominates: 4.1 s with gzip at 1.6 Mbit/s, 48 s if the host does not compress. The 2 s
  threshold would be missed there, and the cause is the 0.64 MB download, not the parse.
- At 6x CPU the first suggestion can freeze the page for roughly 0.2 s; typing then feels normal (later suggestions
  take about 10 ms at 6x).

## Remaining risk and when to re-measure

- Real phones can be slower than 6x throttling, and CDP throttling only slows the CPU: it does not model memory
  pressure, thermal limits or a cold JIT on a different engine (Safari and Firefox were not measured; only Chromium).
- A mid-range laptop was not measured; CPU 4x of an M2 is a proxy, not a device.
- The headless Chromium and one machine give one noise floor; replicates differed by up to about 30 ms at 6x in the
  longest task, which matters because the 6x blocks sit at the 200 ms line.
- Gzip on GitHub Pages is assumed (see Method).
- Re-measure when a release has noticeably more entries (parse and the lookup build scale roughly linearly with
  entries: doubling gives about 2x), when `parse.ts` or `query.ts` change shape, when the shipped index gains fields,
  or when the Chromium or React major version changes.
