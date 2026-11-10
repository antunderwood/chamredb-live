import { defineConfig } from "@playwright/test";

const basePath = process.env.BASE_PATH ?? "/";
export default defineConfig({
  testDir: "tests",
  testMatch: "*.spec.ts",
  use: { baseURL: `http://localhost:4173${basePath}` },
  webServer: {
    command: "GRAPH=tests/fixtures/graph.json OUT_DIR=dist-e2e npm run build && npx vite preview --outDir dist-e2e --port 4173 --strictPort",
    url: `http://localhost:4173${basePath}`,
    reuseExistingServer: false,
  },
});
