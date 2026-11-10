// Measures the real release build in Chromium: navigation start to "search ready" (search box enabled),
// the split into fetch / parse / state update, long main-thread tasks, first completion latency and
// search plus render latency, under CPU and network throttling. See docs/performance.md for the method.
//
// Usage: node scripts/measure-startup.mjs [--runs 5] [--json out.json] [--dist DIR] [--profiles a,b] [--list]
// Uses ./dist if it holds the release build; otherwise builds into a temporary directory outside the repo.
// Reads nothing except the build output. Exits 0 after printing; the verdicts are in the table.
import { execFileSync } from "node:child_process";
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { chromium } from "@playwright/test";

const PORT = 4473; // 4173, 4273, 4373 and 4573 belong to other sessions
const READY_LIMIT_MS = 2000; // spec: index parsed and search ready under 2 s (median)
const BLOCK_LIMIT_MS = 200; // spec: no main-thread block over 200 ms
const QUERY = "card:ARO:3000230";
const NET = { latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 0.75e6 / 8 }; // 1.6 Mbit/s down, 150 ms RTT

// cpu: CDP CPU slowdown factor; net: network throttle; gzip: serve Content-Encoding gzip (as GitHub Pages does)
const PROFILES = [
  { name: "default-gzip", cpu: 1, gzip: true },
  { name: "default-raw", cpu: 1, gzip: false },
  { name: "cpu4-gzip", cpu: 4, gzip: true },
  { name: "cpu4-raw", cpu: 4, gzip: false },
  { name: "cpu6-gzip", cpu: 6, gzip: true },
  { name: "cpu6-raw", cpu: 6, gzip: false },
  { name: "net-gzip", cpu: 1, net: NET, gzip: true },
  { name: "net-raw", cpu: 1, net: NET, gzip: false },
  { name: "cpu4+net-gzip", cpu: 4, net: NET, gzip: true },
  { name: "cpu6+net-gzip", cpu: 6, net: NET, gzip: true },
];

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
if (argv.includes("--list")) { console.log(PROFILES.map((p) => p.name).join("\n")); process.exit(0); }
const RUNS = Number(arg("--runs", 5));
const wanted = arg("--profiles", "").split(",").filter(Boolean);
const profiles = wanted.length ? PROFILES.filter((p) => wanted.includes(p.name)) : PROFILES;

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let dist = path.resolve(arg("--dist", path.join(repo, "dist")));
if (!existsSync(path.join(dist, "index.json"))) {
  dist = mkdtempSync(path.join(os.tmpdir(), "chamredb-measure-"));
  console.log(`No release build in dist/: building into ${dist}`);
  execFileSync("npm", ["run", "build"], { cwd: repo, env: { ...process.env, OUT_DIR: dist }, stdio: "inherit" });
}
const indexRaw = readFileSync(path.join(dist, "index.json"));
const entryCount = Object.keys(JSON.parse(indexRaw).entries).length;
if (entryCount < 1000) throw new Error(`${dist} holds ${entryCount} entries: this is the test fixture, not the release build`);

// Static server over dist. Compressed copies are made once, so the server adds no CPU noise per request.
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".txt": "text/plain", ".svg": "image/svg+xml" };
const cache = new Map();
const server = { gzip: true };
const http = createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html");
  const file = path.resolve(dist, "." + rel);
  if (!file.startsWith(dist + path.sep) || !existsSync(file)) { res.writeHead(404).end(); return; }
  const ext = path.extname(file);
  if (!cache.has(file)) { const raw = readFileSync(file); cache.set(file, { raw, gz: gzipSync(raw, { level: 6 }) }); }
  const { raw, gz } = cache.get(file);
  const useGz = server.gzip && ext in TYPES;
  const body = useGz ? gz : raw;
  res.writeHead(200, { "Content-Type": TYPES[ext] ?? "application/octet-stream", "Content-Length": body.length, "Cache-Control": "no-store", ...(useGz ? { "Content-Encoding": "gzip" } : {}) });
  res.end(body);
});
await new Promise((ok, fail) => { http.once("error", fail); http.listen(PORT, "127.0.0.1", ok); });
const BASE = `http://127.0.0.1:${PORT}/`;

// Injected before any page script. Observes only; the app is unchanged.
const INIT = () => {
  const w = window;
  w.__m = { long: [], ready: null, readyPainted: null, jsonStart: null, jsonEnd: null };
  new PerformanceObserver((l) => { for (const e of l.getEntries()) w.__m.long.push([e.startTime, e.duration]); }).observe({ type: "longtask", buffered: true });
  // Time Response.json(), from which the analysis subtracts any wait for the body. The remainder up to "ready" is state update and render.
  const json = Response.prototype.json;
  Response.prototype.json = function () {
    const mine = this.url.endsWith("/index.json");
    if (mine) w.__m.jsonStart = performance.now();
    return json.call(this).then((v) => { if (mine) w.__m.jsonEnd = performance.now(); return v; });
  };
  new MutationObserver(() => {
    const el = document.querySelector("input[list=suggestions]");
    if (el && !el.disabled && w.__m.ready === null) {
      w.__m.ready = performance.now();
      requestAnimationFrame(() => requestAnimationFrame(() => { w.__m.readyPainted = performance.now(); }));
    }
  }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["disabled"] });
};

const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const stat = (a) => ({ min: Math.min(...a), median: median(a), max: Math.max(...a) });

async function once(browser, p) {
  server.gzip = p.gzip;
  const ctx = await browser.newContext(); // fresh context: cold HTTP and code cache
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  if (p.cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: p.cpu });
  if (p.net) { await cdp.send("Network.enable"); await cdp.send("Network.emulateNetworkConditions", { offline: false, ...p.net }); }
  await page.addInitScript(INIT);
  await page.goto(BASE, { waitUntil: "commit" });
  await page.waitForFunction(() => window.__m?.readyPainted != null, null, { timeout: 300000, polling: 50 });
  const start = await page.evaluate(() => {
    const m = window.__m;
    const r = performance.getEntriesByType("resource").find((e) => e.name.endsWith("/index.json"));
    return { ready: m.ready, readyPainted: m.readyPainted, jsonStart: m.jsonStart, jsonEnd: m.jsonEnd,
      fetchStart: r.startTime, responseEnd: r.responseEnd, encoded: r.encodedBodySize, decoded: r.decodedBodySize };
  });
  // Interaction: type two characters (the first completion builds the lookup table), then search a known id.
  await page.evaluate(() => {
    const m = window.__m;
    const input = document.querySelector("input[list=suggestions]");
    const list = document.getElementById("suggestions");
    m.inputs = []; m.completion = null; m.click = null; m.found = null; m.foundPainted = null;
    input.addEventListener("input", () => m.inputs.push(performance.now()), true);
    new MutationObserver(() => { if (m.completion === null && list.children.length) m.completion = performance.now(); }).observe(list, { childList: true });
    document.addEventListener("click", () => { m.click = performance.now(); }, true);
    new MutationObserver(() => {
      if (m.click !== null && m.found === null && document.querySelector("section[aria-label^='Matches in']")) {
        m.found = performance.now();
        requestAnimationFrame(() => requestAnimationFrame(() => { m.foundPainted = performance.now(); }));
      }
    }).observe(document.body, { subtree: true, childList: true });
  });
  const box = page.locator("input[list=suggestions]");
  await box.focus();
  await page.keyboard.type("ca");
  await page.waitForFunction(() => window.__m.completion != null, null, { timeout: 60000, polling: 20 });
  await box.fill(QUERY);
  await page.getByRole("button", { name: "Search" }).click();
  await page.waitForFunction(() => window.__m.foundPainted != null, null, { timeout: 60000, polling: 20 });
  const m = await page.evaluate(() => window.__m);
  await ctx.close();
  const tasks = m.long.map(([s, d]) => ({ s, d }));
  const startup = tasks.filter((t) => t.s <= start.ready);
  const inter = tasks.filter((t) => t.s > start.ready);
  const longest = (a) => (a.length ? Math.max(...a.map((t) => t.d)) : 0);
  return {
    ready: start.ready, readyPainted: start.readyPainted,
    preFetch: start.fetchStart, // navigation start to the index request: HTML, JS bundle, React start
    fetch: start.responseEnd - start.fetchStart,
    parse: start.jsonEnd - Math.max(start.jsonStart, start.responseEnd), // JSON.parse (json() may be called before the body has arrived)
    render: start.ready - start.jsonEnd, // setState, React render and commit until the box is enabled
    longest: longest(startup), over200: startup.filter((t) => t.d > BLOCK_LIMIT_MS).length, nLong: startup.length,
    encoded: start.encoded, decoded: start.decoded,
    completion: m.completion - m.inputs[1], // second keystroke input event to the datalist options in the DOM
    search: m.foundPainted - m.click, // click to matches painted (two frames)
    interLongest: longest(inter), interOver200: inter.filter((t) => t.d > BLOCK_LIMIT_MS).length,
  };
}

const browser = await chromium.launch();
const env = {
  date: new Date().toISOString(), os: `${os.type()} ${os.release()} ${os.arch()}`, cpu: `${os.cpus()[0].model} x${os.cpus().length}`,
  memGiB: (os.totalmem() / 2 ** 30).toFixed(0), node: process.version, chromium: browser.version(),
  loadavgStart: os.loadavg().map((x) => x.toFixed(2)).join(" "), entries: entryCount, indexBytes: indexRaw.length, dist, runs: RUNS,
};
console.log(`Machine: ${env.os}; ${env.cpu}; ${env.memGiB} GiB; Node ${env.node}; Chromium ${env.chromium}; ${env.date}`);
console.log(`Release index: ${env.entries} entries, ${(env.indexBytes / 1e6).toFixed(2)} MB raw; ${RUNS} runs per profile after 1 warm-up; load average at start ${env.loadavgStart}`);

const results = [];
for (const p of profiles) {
  process.stdout.write(`${p.name}: warm-up`);
  await once(browser, p); // discarded
  const runs = [];
  for (let i = 0; i < RUNS; i++) { process.stdout.write(` ${i + 1}`); runs.push(await once(browser, p)); }
  process.stdout.write("\n");
  results.push({ profile: p.name, cpu: p.cpu, net: !!p.net, gzip: p.gzip, runs, ready: stat(runs.map((r) => r.ready)), longest: stat(runs.map((r) => r.longest)) });
}
env.loadavgEnd = os.loadavg().map((x) => x.toFixed(2)).join(" ");
await browser.close();
http.close();

const f = (x) => Math.round(x).toString();
const mm = (s) => `${f(s.min)}/${f(s.median)}/${f(s.max)}`;
const rows = results.map((r) => {
  const c = (k) => f(median(r.runs.map((x) => x[k])));
  return [r.profile, mm(r.ready), r.ready.median < READY_LIMIT_MS ? "PASS" : "MISS", mm(r.longest), r.longest.max <= BLOCK_LIMIT_MS ? "PASS" : "MISS",
    c("preFetch"), c("fetch"), c("parse"), c("render"), (r.runs[0].encoded / 1e6).toFixed(2), c("completion"), c("search"),
    f(Math.max(...r.runs.map((x) => x.interLongest))), Math.max(...r.runs.map((x) => x.interLongest)) <= BLOCK_LIMIT_MS ? "PASS" : "MISS"];
});
const head = ["profile", "ready min/med/max", "<2s", "longest task min/med/max", "<=200", "pre-fetch", "fetch", "parse", "render", "MB wire", "complete", "search", "after-ready max", "<=200"];
const w = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
const line = (r) => r.map((c, i) => c.padEnd(w[i])).join("  ");
console.log("\n" + line(head) + "\n" + line(w.map((n) => "-".repeat(n))) + "\n" + rows.map(line).join("\n"));
console.log("\nAll times in ms (medians for the breakdown columns). ready = navigation start to search box enabled; pre-fetch + fetch +");
console.log("parse + render approximately sum to ready. complete = 2nd keystroke to suggestions in the DOM; search = click to matches");
console.log("painted; after-ready max = longest main-thread task after ready (typing and searching).");
console.log(`Verdicts: ready PASS when the median < ${READY_LIMIT_MS} ms; block PASS when the longest task in every run is <= ${BLOCK_LIMIT_MS} ms.`);
const json = arg("--json");
if (json) writeFileSync(json, JSON.stringify({ env, results }, null, 1));
process.exit(0);
