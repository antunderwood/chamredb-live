/// <reference types="vitest/config" />
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import { CSP } from "./src/csp";
import { buildIndex } from "./src/parse";

// Graph the app ships: the pinned release (data/provenance.json). The e2e tests build from the fixture instead.
const provenance = JSON.parse(readFileSync("data/provenance.json", "utf8"));
const GRAPH = process.env.GRAPH ?? provenance.file;
const isRelease = resolve(GRAPH) === resolve(provenance.file);
if (!isRelease && (process.env.OUT_DIR ?? "dist") === "dist") {
  throw new Error("GRAPH is not the pinned release: set OUT_DIR to something other than dist so it cannot be deployed");
}
if (isRelease) {
  const sha = createHash("sha256").update(readFileSync(GRAPH)).digest("hex");
  if (sha !== provenance.sha256) throw new Error(`${GRAPH} sha256 ${sha} != data/provenance.json ${provenance.sha256}`);
  const msha = createHash("sha256").update(readFileSync("data/data_manifest.json")).digest("hex");
  if (msha !== provenance.manifest_sha256) throw new Error(`data/data_manifest.json sha256 ${msha} != data/provenance.json ${provenance.manifest_sha256}`);
}

// What the footer shows (release build only): the release record plus one row per source database. The manifest
// lists input databases, not graph.json itself; graphSha256 is the hash of the shipped graph.
function provenanceJson(): string {
  const manifest = JSON.parse(readFileSync("data/data_manifest.json", "utf8")) as {
    files: { database: string; release: string; retrieved: string }[];
  };
  const databases: { database: string; release: string; retrieved: string }[] = [];
  for (const { database, release, retrieved } of manifest.files) {
    const seen = databases.find((d) => d.database === database);
    if (!seen) databases.push({ database, release, retrieved });
    else if (seen.release !== release || seen.retrieved !== retrieved) throw new Error(`data_manifest.json has mixed release or date for ${database}`);
  }
  return JSON.stringify({
    release: provenance.version,
    date: provenance.date,
    source: provenance.source,
    tool: provenance.tool,
    graphSha256: provenance.sha256,
    manifestSha256: provenance.manifest_sha256,
    databases,
  });
}

function chamredb(): Plugin {
  const release = isRelease ? provenance.version : undefined;
  let cached: string | undefined; // ponytail: no invalidation in dev; restart after changing the graph
  const indexJson = () => (cached ??= JSON.stringify(buildIndex(JSON.parse(readFileSync(GRAPH, "utf8")), release)));
  return {
    name: "chamredb",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        let body: string;
        if (req.url?.endsWith("/index.json")) body = indexJson();
        else if (isRelease && req.url?.endsWith("/provenance.json")) body = provenanceJson();
        else return next();
        res.setHeader("Content-Type", "application/json");
        res.end(body);
      });
    },
    transformIndexHtml: {
      order: "post",
      handler: (html, ctx) => {
        if (ctx.server) return html; // no CSP in dev: HMR needs inline scripts
        // First in <head>: a meta CSP only governs what is parsed after it. frame-ancestors cannot be set
        // by meta; csp-header.txt carries the policy for hosts that can send headers.
        const out = html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`);
        if (out === html) throw new Error("index.html has no <head> to inject the CSP into");
        return out;
      },
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "index.json", source: indexJson() });
      if (isRelease) this.emitFile({ type: "asset", fileName: "provenance.json", source: provenanceJson() });
      this.emitFile({ type: "asset", fileName: "csp-header.txt", source: `Content-Security-Policy: ${CSP}\n` });
    },
  };
}

export default defineConfig({
  base: process.env.BASE_PATH ?? "./",
  build: { outDir: process.env.OUT_DIR ?? "dist" },
  plugins: [react(), tailwindcss(), chamredb()],
  test: { include: ["src/**/*.test.ts"] },
});
