/// <reference types="vitest/config" />
import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import { CSP } from "./src/csp";
import { buildIndex } from "./src/parse";

// Release graph the app ships. ponytail: fixture until ticket #5 pins the real release.
const GRAPH = process.env.GRAPH ?? "tests/fixtures/graph.json";

function chamredb(): Plugin {
  const indexJson = () => JSON.stringify(buildIndex(JSON.parse(readFileSync(GRAPH, "utf8"))));
  return {
    name: "chamredb",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.endsWith("/index.json")) return next();
        res.setHeader("Content-Type", "application/json");
        res.end(indexJson());
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
      this.emitFile({ type: "asset", fileName: "csp-header.txt", source: `Content-Security-Policy: ${CSP}\n` });
    },
  };
}

export default defineConfig({
  base: process.env.BASE_PATH ?? "./",
  plugins: [react(), tailwindcss(), chamredb()],
  test: { include: ["src/**/*.test.ts"] },
});
