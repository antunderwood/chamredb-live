import { expect, test } from "@playwright/test";
import { EXAMPLES } from "../src/Examples";

// Runs against the real-release build (playwright.release.config.ts): the examples exist only in the real data.
// Expected ids: a raw scan of data/graph.json, see src/examples.test.ts.
test.skip(!process.env.RELEASE_E2E, "needs the real-release build: npm run e2e runs it with playwright.release.config.ts");

// Raw scan of data/graph.json at 90%: the one match per other database, its identity, coverage and type (printed to
// 1 decimal of the percentage), and the match count in that database (1 in each case).
const MATCHES: Record<string, { db: string; native: string; identity: string; coverage: string; type: string }[]> = {
  "card:ARO:3000230": [
    { db: "ncbi", native: "WP_032490446.1", identity: "97.1%", coverage: "100.0%", type: "Reciprocal best hit" },
    { db: "resfinder", native: "ant(2'')-Ia", identity: "97.1%", coverage: "100.0%", type: "Reciprocal best hit" },
  ],
  "ncbi:WP_012695489.1": [
    { db: "card", native: "ARO:3002735", identity: "99.5%", coverage: "100.0%", type: "Reciprocal best hit" },
    { db: "resfinder", native: "qnrB2", identity: "100.0%", coverage: "100.0%", type: "Reciprocal best hit" },
  ],
  "resfinder:blaNDM-1": [
    { db: "card", native: "ARO:3000589", identity: "100.0%", coverage: "100.0%", type: "Reciprocal best hit" },
    { db: "ncbi", native: "WP_004201164.1", identity: "100.0%", coverage: "100.0%", type: "Reciprocal best hit" },
  ],
};

test("four example buttons are offered on arrival, with accessible names", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByLabel("Entry id")).toBeEnabled();
  const buttons = page.getByRole("button", { name: /^Example:/ });
  await expect(buttons).toHaveCount(4);
  for (const ex of EXAMPLES) await expect(page.getByRole("button", { name: `Example: ${ex.query}` })).toBeVisible();
  await expect(page.getByText("Searches run in your browser; nothing is sent.")).toBeVisible(); // #26: the one-sentence line; the full statement is in How to read this
});

test("each single-entry example loads its expected entry", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByLabel("Entry id")).toBeEnabled();
  for (const ex of EXAMPLES.filter((e) => e.ids.length === 1)) {
    await page.getByRole("button", { name: `Example: ${ex.query}` }).click();
    await expect(page.getByLabel("Entry id or name")).toHaveValue(ex.query);
    await expect(page.getByRole("region", { name: "Query entry" })).toHaveAttribute("data-query", ex.ids[0]); // the queried entry (#8 query panel)
    // Matches at 90% or more, from a raw scan of data/graph.json (all three are reciprocal best hits).
    for (const m of MATCHES[ex.query]) await expect(page.getByRole("region", { name: `Matches in ${m.db}` })).toContainText(m.native);
    // The comparison strip (#20): the same match is the Best row of its database, and no database is missing.
    const strip = page.getByTestId("comparison");
    await expect(strip.locator("li[data-db]")).toHaveCount(2);
    for (const m of MATCHES[ex.query]) {
      const r = strip.locator(`li[data-db="${m.db}"]`);
      await expect(r.locator("[data-label]")).toHaveText("Best");
      const t = r.locator(`[data-top="${m.db}:${m.native}"]`);
      await expect(r.locator("[data-top]")).toHaveCount(1);
      await expect(r.locator("[data-count]")).toHaveAttribute("data-count", "1");
      await expect(t.locator('[data-value="identity"]')).toHaveText(m.identity);
      await expect(t.locator('[data-value="coverage"]')).toHaveText(m.coverage);
      await expect(t.locator('[data-value="type"]')).toHaveText(m.type);
    }
    expect(new URL(page.url()).hash).toContain(`q=${encodeURIComponent(ex.query)}`);
  }
});

test("the name example lists all three candidates and choosing one loads it", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByLabel("Entry id")).toBeEnabled();
  const ex = EXAMPLES.find((e) => e.ids.length > 1)!;
  await page.getByRole("button", { name: `Example: ${ex.query}` }).click();
  for (const id of ex.ids) await expect(page.getByRole("button", { name: new RegExp(`^${id.replace(/[()]/g, "\\$&")} `) })).toBeVisible();
  await expect(page.getByTestId("comparison")).toHaveCount(0); // no single entry yet, so no comparison strip (#20)
  await page.getByRole("button", { name: /^card:ARO:3000186 / }).click();
  await expect(page.getByTestId("comparison")).toBeVisible();
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

test("no horizontal page scroll at 360 px on a real result, footer included (#25)", async ({ page }) => {
  // The footer listed a 40 character ResFinder git commit; before #25 it pushed the page 5 px sideways at 360 px.
  // Since #21 the footer is one line (the list is in the About and data panel); the check stays for the new footer.
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("./#q=card%3AARO%3A3000230");
  await expect(page.getByTestId("comparison")).toBeVisible();
  await expect(page.getByTestId("footer-release")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  // The long commit now lives in the panel: it must wrap there too.
  await page.getByRole("contentinfo").getByRole("button", { name: "Sources and checksums" }).click();
  const panel = page.getByRole("dialog", { name: "About and data" });
  await expect(panel).toContainText("git commit");
  expect(await panel.evaluate((e) => e.scrollWidth - e.clientWidth)).toBeLessThanOrEqual(0);
});

test("once a result is shown the example cards become one row of small chips, and each chip still loads its entry (#26)", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator('[data-examples="cards"]')).toBeVisible(); // before any result: the cards with their notes
  await page.getByRole("button", { name: "Example: card:ARO:3000230" }).click();
  await expect(page.getByTestId("comparison")).toBeVisible();
  await expect(page.locator('[data-examples="cards"]')).toHaveCount(0);
  const row = page.locator('[data-examples="compact"]');
  await expect(row).toBeVisible();
  expect((await row.boundingBox())!.height).toBeLessThan(40); // one line
  for (const ex of EXAMPLES.filter((e) => e.ids.length === 1)) {
    await page.getByRole("button", { name: `Example: ${ex.query}` }).click();
    await expect(page.getByRole("region", { name: "Query entry" })).toHaveAttribute("data-query", ex.ids[0]); // the queried entry (the heading no longer repeats an id that is only the name)
  }
});

// The layout targets moved here from #25 (ticket #26): measured on the real release, searching card:ARO:3000230.
test("1280 x 800: the search box and the whole comparison strip are visible without scrolling after a search (#26)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("./");
  await page.getByRole("button", { name: "Example: card:ARO:3000230" }).click();
  const strip = page.getByTestId("comparison");
  await expect(strip).toBeVisible();
  await expect(page.getByLabel("Entry id")).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole("button", { name: "Search" })).toBeInViewport({ ratio: 1 });
  await expect(strip).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("390 x 844: the comparison strip starts above 700 px after a search (#26)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  await page.getByRole("button", { name: "Example: card:ARO:3000230" }).click();
  const strip = page.getByTestId("comparison");
  await expect(strip).toBeVisible();
  expect((await strip.boundingBox())!.y).toBeLessThan(700); // measured after #25: 1151; after #26: 690
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

test("resfinder:blaNDM-1 at 90%: each side-by-side column shows the match's identity, coverage and type; no weak note, no more-matches line", async ({ page }) => {
  await page.goto(`./#q=${encodeURIComponent("resfinder:blaNDM-1")}`);
  const view = page.getByTestId("side-by-side");
  await expect(view).toBeVisible();
  for (const m of MATCHES["resfinder:blaNDM-1"]) {
    const col = view.locator(`[data-side-col="${m.db}"]`);
    await expect(col.locator("[data-side-evidence]")).toHaveText(`Identity ${m.identity}, coverage ${m.coverage}, ${m.type} (RBH)`);
    await expect(col.locator("[data-side-weak]")).toHaveCount(0);
    await expect(col.locator("[data-side-more]")).toHaveCount(0);
  }
  await expect(view.locator('[data-side-col="resfinder"] [data-side-evidence]')).toHaveCount(0); // the query column has none
});

test("a long heading chip never pushes the name chip out of its row at 390 px (Highest identity shown, tet(L))", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("./#q=ncbi%3AWP_002294500.1&min=80");
  const role = page.locator("[data-chip]").filter({ hasText: "Highest identity shown" }).first();
  await expect(role).toBeVisible();
  const row = role.locator("xpath=ancestor::*[contains(@class,'shadow-card')][1]");
  const r = (await row.boundingBox())!;
  for (const chip of await row.locator("[data-chip]").all()) {
    const b = (await chip.boundingBox())!;
    expect(b.x, `${await chip.textContent()} starts inside the row`).toBeGreaterThanOrEqual(r.x - 1);
    expect(b.x + b.width, `${await chip.textContent()} ends inside the row`).toBeLessThanOrEqual(r.x + r.width + 1);
    expect(b.width, `${await chip.textContent()} is not squeezed to a sliver`).toBeGreaterThan(60);
  }
});
