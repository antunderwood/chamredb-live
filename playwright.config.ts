import { defineConfig } from "@playwright/test";

const basePath = process.env.BASE_PATH ?? "/";
export default defineConfig({
  testDir: "tests",
  testMatch: "*.spec.ts",
  use: { baseURL: `http://localhost:4173${basePath}` },
  webServer: {
    command: "npm run build && npx vite preview --port 4173 --strictPort",
    url: `http://localhost:4173${basePath}`,
    reuseExistingServer: false,
  },
});
