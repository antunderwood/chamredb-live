import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Runs only against the real-release build (playwright.release.config.ts sets RELEASE_E2E). Expected values are
// computed here from the files on disk, never read back from the built provenance.json.
test.skip(!process.env.RELEASE_E2E, "needs the real-release build: npm run e2e runs it with playwright.release.config.ts");

const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const record = JSON.parse(readFileSync("data/provenance.json", "utf8"));
const manifest = JSON.parse(readFileSync("data/data_manifest.json", "utf8")) as {
  files: { database: string; release: string; retrieved: string }[];
};
const label: Record<string, string> = { card: "CARD", ncbi: "NCBI AMRFinderPlus", resfinder: "ResFinder" };

test("privacy statement is visible before any query, with the release footer", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByText(/searches never leave your browser/i)).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
});

test("footer shows the release, source databases, retrieval dates and full sha256 from the files on disk", async ({ page }) => {
  await page.goto("./");
  const footer = page.getByRole("contentinfo");
  await expect(footer).toContainText(`Release ${record.version}`);
  await expect(footer).toContainText(record.date);
  await expect(footer.getByRole("link", { name: "Release page" })).toHaveAttribute("href", record.source);
  // Computed from the shipped graph and manifest, not from data/provenance.json, so a stale record fails here.
  await expect(footer).toContainText(sha256("data/graph.json"));
  await expect(footer).toContainText(sha256("data/data_manifest.json"));
  const dbs = [...new Set(manifest.files.map((f) => f.database))];
  expect(dbs).toEqual(["card", "ncbi", "resfinder"]);
  for (const db of dbs) {
    const files = manifest.files.filter((f) => f.database === db);
    const row = footer.getByRole("listitem").filter({ hasText: label[db] });
    for (const f of files) {
      await expect(row).toContainText(f.release);
      await expect(row).toContainText(`retrieved ${f.retrieved}`);
    }
  }
});
