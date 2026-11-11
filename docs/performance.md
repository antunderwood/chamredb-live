# Performance measurement (issue #12)

Spec trigger (issue #1, Performance): index parsed and search ready in under 2 s on a mid-range laptop (median of 5 runs
after one warm-up, in the browser); no main-thread block over 200 ms; Rust/WASM only if this is missed. Timing is a
measurement, not a test: nothing here runs in `npm test` or `npm run e2e`.

Reproduce: `npm run build && npm run measure` (roughly 15 to 20 minutes, mostly the raw 9 MB transfer at 1.6 Mbit/s;
`--profiles default-gzip,cpu6-gzip --runs 5` for a quick look, `--list` for profile names, `--json out.json` for every run).

## Verdict

| Threshold (spec) | Default (this laptop) | CPU 4x | CPU 6x | 1.6 Mbit/s network |
|---|---|---|---|---|
| Search ready, median under 2 s | PASS (66 ms) | PASS (257 ms) | PASS (388 ms) | MISS (4.1 s gzip, 48 s raw) |
| No main-thread block over 200 ms, load to ready | PASS (0 ms: no task over 50 ms) | PASS (max 112 ms) | PASS (max 184 ms) | PASS (max 62 ms at 1x CPU) |
| No main-thread block over 200 ms, typing and searching | PASS (0 ms) | PASS (max 127 ms) | MISS at the margin (see below) | PASS at 1x CPU |
| CPU 4x and 1.6 Mbit/s (gzip) | not applicable | ready MISS (4.3 s); block PASS (max 162 ms; typing 137 ms) | not applicable | not applicable |
| CPU 6x and 1.6 Mbit/s (gzip) | not applicable | not applicable | ready MISS (4.4 s); block MISS (load max 282 ms, typing max 270 ms; one outlier run, median 190 ms) | not applicable |

Raw and gzip give the same CPU-only verdicts; on the network the raw case is the worse MISS (48 s). All verdicts are
for this machine (an Apple M2, a fast laptop) with Chromium throttling applied as a proxy. CDP CPU throttling slows the
renderer main thread only (GC, compile threads and gunzip run at full speed) and was not calibrated against a reference
device, so "4x" and "6x" mean "this M2 slowed N times", not a device class, and the 200 ms verdicts could flip with a
further 1.2x. No mid-range laptop and no phone was measured, so the spec target (a mid-range laptop) has no direct
verdict. The network rows are informational: the spec defines no network, and the miss comes from the 0.64 MB download,
not from parsing. The median is used for the 2 s criterion (it has a margin of about 5x); the maximum over runs is used
for the 200 ms criterion, because the spec says "no block".

**Rust/WASM is not triggered.** The only misses are (a) transfer time on a slow network, which WASM cannot reduce, and
(b) a main-thread block of about 180 to 270 ms in the lookup-table build for the first suggestions when the CPU is
throttled 6x; a chunked TypeScript build removes that block (see "Cheap TypeScript options"). Parse itself is 26 to
33 ms here (160 to 169 ms at 6x), far from the 2 s limit. The spec's own rule applies: try Web Worker and a faster
algorithm in TypeScript first. No app code was changed in this ticket.

Reading of the 6x row: the first completion after two keystrokes builds the lookup table (about 170 ms at 6x). Its
longest task at 6x with gzip was 207 ms (replicate 1), 178 ms (replicate 2, the table below) and 217 ms (replicate 3,
3 runs, a short re-run after review fixes to the script); with raw, 190 and 197 ms. It sits on the 200 ms line and the
verdict flips between replicates (with about 1 exceedance in 10 to 13 runs, 5 runs often show none; more runs, about 20
to 30, would be needed for a tail estimate). It is recorded as MISS at the margin: the table below shows PASS for the
178 and 197 ms of replicate 2 under the script's strict rule applied to one replicate, and the worst-replicate reading
is MISS. Replicate 1 and 3 outputs are not committed; the numbers below are replicate 2.

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
  case sends `Content-Encoding: gzip` (compressed on first request and cached, level 6, as GitHub Pages does; the cost falls in the discarded warm-up) and the raw case sends
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
spec's "try TypeScript first" step was measured with a throwaway harness (not in the repo, so indicative and not
reproducible from it; it used the real `query.ts` for the first suggestion and replicas for the others), 5 runs after a
warm-up, medians, gzip, no network throttle. Its "ready" is fetch plus parse in a bare page (no React, no bundle load),
so it is lower than the 388 ms of the main table and only comparable within this table. "No task over 50 ms" does not
prove there is no jank:

| Option | Raw / gzip size | 6x parse | 6x first completion longest task | 6x ready | Verdict |
|---|---|---|---|---|---|
| Baseline (current index) | 9.28 MB / 636 kB | 196 ms | 178 ms (max 245) | 202 ms | |
| Drop fields the UI never shows (phenotype, product, is_a, PMIDs) | 7.04 MB / 530 kB (-24% / -17%) | 166 ms (1.2x) | 175 ms | 171 ms | small gain, below the 2x rule |
| Compact format (also no empty maps, no repeated id or database, edges as tuples) | 3.38 MB / 428 kB (-64% / -33%) | 99 ms (2.0x) | n/a | 105 ms | 2x on parse, needs `query.ts` and `parse.ts` to read the format |
| Parse in a Web Worker, post the object back | n/a | worker 35 ms | 173 ms (startup longest task 225 ms) | 298 ms (slower) | rejected: the structured clone back onto the main thread costs more than the parse |
| Build the lookup table in slices of 1500 entries with a yield | n/a | n/a | 0 ms in every run (no task over 50 ms; table ready after 134 ms) | n/a | removes the block |

Recommendation (one follow-up ticket): build the lookup table in yielded slices (or in idle time right after ready)
so no first keystroke blocks the main thread. It is the only option that removes a measured over-200 ms task and it
changes one function. A worker only pays off if the whole lookup lives in it (search by message), which is a larger
design. Not recommended now: the compact format. It cuts gzip transfer by a third (about 3.2 s to 2.1 s of transfer at
1.6 Mbit/s) but still cannot bring the slow-network case under 2 s (a 0.43 MB floor plus latency), and the spec defines
no network target.

## Lookup table in slices (#15)

`prime(index)` in `src/query.ts` now builds the lookup table and the completions list in slices of 1500 units (entries,
then searchable strings), with a `setTimeout` yield between slices, and `src/main.tsx` calls it as soon as the index has
loaded. `findEntries` and `suggest` stay synchronous and always correct: they drain the same generator, so a call
before or during priming finishes the remaining work instead of starting again, and results are identical
(`src/prime.test.ts`, plus the unchanged sweeps in `src/lookup.test.ts` and `src/query.test.ts`).

Measured with `npm run measure --profiles default-gzip,cpu4-gzip,cpu6-gzip --runs 5` (one warm-up, then 5 runs, gzip),
same machine as above (Apple M2, Chromium 158, 2026-11-10, other work running), before (main at the start of #15) and
after (this branch). "After ready" is the longest main-thread task starting after the search box was enabled, over the
whole session (it includes the priming slices). The script types `ca` the moment the box is enabled, so priming is
still running and that keystroke finishes the remaining slices synchronously: the standard row is a worst case. The
second "after" row repeats it with a throwaway 1.5 s pause before typing (a user does not type within 130 ms of the
page becoming usable); that variant is not in the repo.

| Profile | Version | Ready median | Longest task after ready (5 runs: min / median / max) | First completion (median) |
|---|---|---|---|---|
| default | before | 66 | 0 / 0 / 0 | 31 |
| default | after | 65 | 0 / 0 / 0 | 17 |
| default | after, 1.5 s pause | 77 | 0 / 0 / 0 | 5 |
| CPU 4x | before | 257 | 106 / 132 / 142 | 108 |
| CPU 4x | after | 258 | 53 / 62 / 67 | 61 |
| CPU 4x | after, 1.5 s pause | 258 | 0 / 0 / 0 | 16 |
| CPU 6x | before | 395 | 155 / 167 / 175 | 167 |
| CPU 6x | after | 399 | 104 / 111 / 117 | 109 |
| CPU 6x | after, 1.5 s pause | 395 | 59 / 62 / 74 | 23 |

Verdict: the 200 ms limit after ready is met at 6x in all 5 measured runs (max 117 ms typing at once, 74 ms with a
pause; 175 ms before, which also passed). This batch did not reproduce the 178 to 217 ms failures recorded above (two of
the three exceed this batch's before maximum), so the claim rests on the relative gain: the median fell from 167 to 111
ms and the ranges do not overlap. The after batch ran at a higher load average (7.5) than the before batch (4.3), which
works against the claim. Five runs on one machine are not a bound. The margin to 200 ms is now about 80 ms in the worst case, against 25 ms before. Ready is
unchanged (the work is after ready). What remains over 50 ms: typing at the instant of ready still pays for the part of
the build not yet done (about 110 ms at 6x), and with a pause the longest task at 6x is 59 to 74 ms (not attributed to a
particular slice; smaller slices were not tried). The
longest task over the whole session at 6x is still the startup JSON parse (156 to 171 ms), unchanged. Not measured: a
real phone, other engines, and network throttling (not repeated). Rust/WASM is not triggered.

## What the numbers mean for users

- On this laptop the search box is usable about 66 ms after navigation starts; the first suggestions follow about 31 ms
  after the second keystroke and a search shows matches about 31 ms after the click. Throttled 4 to 6 times, the box is
  usable after 0.26 to 0.39 s, the first suggestions appear 0.12 to 0.18 s after the second keystroke and a search takes
  50 to 71 ms.
- The spec asks for under 2 s from file chosen to result shown. The app has no file step; the substitute used here is
  page load to result shown for a user who types first: about 0.45 to 0.65 s under 6x throttling on a fast connection
  (ready 0.39 s, first completion about 0.17 s, search about 0.07 s), roughly 3 times inside 2 s. That says nothing about
  a real phone.
- A shared link with a search in the address bar runs the search in the same render that sets the index, so the lookup
  build (about 170 ms at 6x) falls before "ready" on that path. That path was not measured separately.
- On a slow connection transfer dominates: 4.1 s with gzip at 1.6 Mbit/s, 48 s if the host does not compress. The 2 s
  threshold would be missed there (an extra scenario, not a spec criterion), and the cause is the 0.64 MB download.
- Under 6x throttling the first suggestion can freeze the page for roughly 0.2 s; typing then feels normal (a later
  suggestion took about 10 ms at 6x in the throwaway harness; the script does not measure it).

## Remaining risk and when to re-measure

- Real phones can be slower than 6x throttling, and CDP throttling only slows the CPU: it does not model memory
  pressure, thermal limits or a cold JIT on a different engine (Safari and Firefox were not measured; only Chromium).
- A mid-range laptop was not measured; CPU 4x of an M2 is a proxy, not a device.
- The headless Chromium and one machine give one noise floor; replicates differed by up to about 30 ms at 6x in the
  longest task, which matters because the 6x blocks sit at the 200 ms line.
- Gzip on GitHub Pages is assumed (see Method).
- Cold first visit only: every run starts with an empty cache. A repeat visit (HTTP cache hit) was not measured.
- The server shares a Node process with the Playwright driver, profiles run in a fixed order and the machine was busy;
  the "long task" figures have a 50 ms floor (0 means none over 50 ms), report task duration (not blocking time), and
  the attribution of the startup block to the parse is inferred from matching numbers, not observed. The "parse" column
  is `Response.json()` after the body arrived, so it includes body decode; under the network profile it reads about 52 ms
  against 26 to 33 ms without it.
- Re-measure when a release has noticeably more entries (parse and the lookup build are expected, not measured, to scale
  roughly linearly with entries), when `parse.ts` or `query.ts` change shape, when the shipped index gains fields,
  or when the Chromium or React major version changes.

## Interactive network picture (tickets #9 and #10)

Measured with `npm run build` then `node scripts/measure-startup.mjs --runs 5 --profiles default-gzip,cpu6-gzip` on the same M2 laptop (Chromium 158, 5 runs after a warm-up):

| Profile | Ready (min/median/max, ms) | Longest task (min/median/max, ms) | After-ready max (ms) | Verdicts |
| --- | --- | --- | --- | --- |
| default-gzip | 98 / 101 / 104 | 0 / 0 / 0 | 0 | ready PASS, block PASS |
| cpu6-gzip | 603 / 623 / 655 | 172 / 183 / 192 | 131 | ready PASS, block PASS |

The budget holds (ready under 2 s, no task over 200 ms). The longest 6x task is still the startup JSON parse; the picture is built after a search and the search-to-paint time at 6x was 61 ms. Honest caveats: the 6x longest task (192 ms at the maximum) sits 8 ms under the 200 ms line, as before; the picture's own cost (a model build, a layout and up to 25 chips) was not profiled separately, and the bundle grew (JS 264.8 kB, 83.5 kB gzip, CSS 22.5 kB). Earlier figures in this file were taken on a different day and load, so a small difference from them is not attributed to this change.
