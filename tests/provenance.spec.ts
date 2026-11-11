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

// #21: the footer is one line with the release id; the full provenance moved, unchanged, into the About and data panel
// opened from the footer's "Sources and checksums". The checks below read the panel instead of the old footer.
const openData = async (page: import("@playwright/test").Page) => {
  await page.getByRole("contentinfo").getByRole("button", { name: "Sources and checksums" }).click();
  const panel = page.getByRole("dialog", { name: "About and data" });
  await expect(panel).toBeVisible();
  return panel.getByTestId("provenance");
};

test("privacy statement is visible before any query, with the one-line release footer", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByText(/searches never leave your browser/i)).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
});

test("the release id is visible with no interaction, before and after a search, and the footer is one line", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("./");
  const release = page.getByTestId("footer-release");
  await expect(release).toHaveText(`Data: release ${record.version} (built ${record.date})`);
  await expect(release).toBeVisible();
  const lineHeight = await page.getByRole("contentinfo").locator("p").last().evaluate((e) => parseFloat(getComputedStyle(e).lineHeight));
  expect((await page.getByRole("contentinfo").locator("p").last().boundingBox())!.height).toBeLessThan(lineHeight * 1.5); // one line at 1280 px
  await page.goto("./#q=card%3AARO%3A3000230");
  await expect(page.getByTestId("comparison")).toBeVisible();
  await expect(release).toHaveText(`Data: release ${record.version} (built ${record.date})`);
  await release.scrollIntoViewIfNeeded();
  await expect(release).toBeVisible();
});

test("panel shows the release, source databases, retrieval dates and full sha256 from the files on disk", async ({ page }) => {
  await page.goto("./");
  const footer = await openData(page);
  await expect(footer).toContainText(`Release ${record.version}`);
  await expect(footer).toContainText(record.date);
  await expect(footer.getByRole("link", { name: "Release page" })).toHaveAttribute("href", record.source);
  // Computed from the shipped graph and manifest, not from data/provenance.json, so a stale record fails here.
  await expect(footer).toContainText(sha256("data/graph.json"));
  await expect(footer).toContainText(sha256("data/data_manifest.json"));
  await expect(footer).toContainText("The checksums detect accidental change only; they do not prove who produced the files.");
  await expect(footer).toContainText(`Graph built with ${record.tool}.`);
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
  expect(new URL(page.url()).hash, "opening the panel does not change the URL").toBe("");
});

test("copy buttons put each checksum on the clipboard", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("./");
  const data = await openData(page);
  for (const [name, file] of [["graph.json", "data/graph.json"], ["data_manifest.json", "data/data_manifest.json"]] as const) {
    await data.getByRole("button", { name: new RegExp(`Copy Release ${name.replace(".", "\\.")}`) }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(sha256(file));
  }
  await expect(data.getByRole("status").first()).toHaveText("Copied.");
});

test("a broken provenance.json is a visible alert in the footer, and the release id stays", async ({ page }) => {
  await page.route("**/provenance.json", (route) => route.fulfill({ status: 500, body: "" }));
  await page.goto("./");
  await expect(page.getByRole("contentinfo").getByRole("alert")).toContainText("Could not load the release provenance");
  await expect(page.getByTestId("footer-release")).toContainText(`Data: release ${record.version}`);
});
