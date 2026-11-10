import { defineConfig } from "@playwright/test";

// Real-release build (the shipped graph) for the footer test; the default config builds the fixture graph.
const port = process.env.RELEASE_PORT ?? "4174";
const basePath = process.env.BASE_PATH ?? "/"; // the CI build runs under /<repo>/
process.env.RELEASE_E2E = "1";
export default defineConfig({
  testDir: "tests",
  testMatch: ["provenance.spec.ts", "a11y-release.spec.ts"],
  use: { baseURL: `http://localhost:${port}${basePath}` },
  webServer: {
    command: `OUT_DIR=dist-release npm run build && npx vite preview --outDir dist-release --port ${port} --strictPort`,
    url: `http://localhost:${port}${basePath}`,
    reuseExistingServer: false,
  },
});
