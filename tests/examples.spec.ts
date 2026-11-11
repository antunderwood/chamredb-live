import { expect, test } from "@playwright/test";
import { EXAMPLES } from "../src/Examples";

// Runs against the real-release build (playwright.release.config.ts): the examples exist only in the real data.
// Expected ids: a raw scan of data/graph.json, see src/examples.test.ts.
test.skip(!process.env.RELEASE_E2E, "needs the real-release build: npm run e2e runs it with playwright.release.config.ts");

const MATCHES: Record<string, { db: string; native: string }[]> = {
  "card:ARO:3000230": [{ db: "ncbi", native: "WP_032490446.1" }, { db: "resfinder", native: "ant(2'')-Ia" }],
  "ncbi:WP_012695489.1": [{ db: "card", native: "ARO:3002735" }, { db: "resfinder", native: "qnrB2" }],
  "resfinder:blaNDM-1": [{ db: "card", native: "ARO:3000589" }, { db: "ncbi", native: "WP_004201164.1" }],
};

test("four example buttons are offered on arrival, with accessible names", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByLabel("Entry id")).toBeEnabled();
  const buttons = page.getByRole("button", { name: /^Example:/ });
  await expect(buttons).toHaveCount(4);
  for (const ex of EXAMPLES) await expect(page.getByRole("button", { name: `Example: ${ex.query}` })).toBeVisible();
  await expect(page.getByText(/searches never leave your browser/i)).toBeVisible();
});

test("each single-entry example loads its expected entry", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByLabel("Entry id")).toBeEnabled();
  for (const ex of EXAMPLES.filter((e) => e.ids.length === 1)) {
    await page.getByRole("button", { name: `Example: ${ex.query}` }).click();
    await expect(page.getByLabel("Entry id or name")).toHaveValue(ex.query);
    await expect(page.getByText(`${ex.ids[0]} (`).first()).toBeVisible(); // the queried entry
    // Matches at 90% or more, from a raw scan of data/graph.json (all three are reciprocal best hits).
    for (const m of MATCHES[ex.query]) await expect(page.getByRole("region", { name: `Matches in ${m.db}` })).toContainText(m.native);
    expect(new URL(page.url()).hash).toContain(`q=${encodeURIComponent(ex.query)}`);
  }
});

test("the name example lists all three candidates and choosing one loads it", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByLabel("Entry id")).toBeEnabled();
  const ex = EXAMPLES.find((e) => e.ids.length > 1)!;
  await page.getByRole("button", { name: `Example: ${ex.query}` }).click();
  for (const id of ex.ids) await expect(page.getByRole("button", { name: new RegExp(`^${id.replace(/[()]/g, "\\$&")} `) })).toBeVisible();
  await page.getByRole("button", { name: /^card:ARO:3000186 / }).click();
  await expect(page.getByRole("region", { name: /^Matches in / }).first()).toBeVisible();
});

test("an example resets a database filter that would hide its entry", async ({ page }) => {
  await page.goto("./#q=resfinder%3AblaNDM-1&db=card");
  await page.getByRole("button", { name: "Example: ncbi:WP_012695489.1" }).click();
  await expect(page.getByLabel("Search in database")).toHaveValue("");
  await expect(page.getByRole("region", { name: "Matches in resfinder" })).toContainText("qnrB2"); // hidden by the card filter
});

test("the example buttons and a result do not scroll sideways at 390 px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("./");
  await expect(page.getByRole("button", { name: /^Example:/ })).toHaveCount(4);
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(await overflow()).toBeLessThanOrEqual(0);
  await page.getByRole("button", { name: "Example: ncbi:WP_012695489.1" }).click();
  await expect(page.getByRole("region", { name: "Matches in card" })).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
});
