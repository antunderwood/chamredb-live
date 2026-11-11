import { expect, test, type Locator, type Page } from "@playwright/test";

// The at-a-glance comparison strip (#20, ADR 0006) on the fixture build. Expected values: tests/fixtures/README.md,
// "Comparison strip" and "Bar scale", worked by hand from the edge list (W = 200 px).
async function open(page: Page, q: string, min?: number) {
  await page.goto(`./#q=${encodeURIComponent(q)}${min !== undefined ? `&min=${min}` : ""}`);
  await expect(page.getByTestId("comparison")).toBeVisible();
}
const row = (page: Page, db: string) => page.getByTestId("comparison").locator(`li[data-db="${db}"]`);
const top = (r: Locator, id: string) => r.locator(`[data-top="${id}"]`);

test("card:ARO:1000 at 90%: one row per other database, ties all listed, counts and values as worked by hand", async ({ page }) => {
  await open(page, "card:ARO:1000");
  await expect(page.getByTestId("comparison").locator("li[data-db]")).toHaveCount(2);
  const ncbi = row(page, "ncbi");
  await expect(ncbi.locator("[data-label]")).toHaveText("Best (2 tied)");
  await expect(ncbi.locator("[data-count]")).toHaveText("3 matches shown");
  await expect(ncbi.locator("[data-top]")).toHaveCount(2);
  for (const [id, type] of [["ncbi:WP_1.1", "Reciprocal best hit"], ["ncbi:WP_3.1", "One-way hit"]]) {
    await expect(top(ncbi, id).locator('[data-value="identity"]')).toHaveText("97.0%");
    await expect(top(ncbi, id).locator('[data-value="coverage"]')).toHaveText("100.0%");
    await expect(top(ncbi, id).locator('[data-value="type"]')).toHaveText(type);
  }
  await expect(top(ncbi, "ncbi:WP_1.1").locator('[data-glyph="RBH"]')).toHaveCount(1);
  await expect(top(ncbi, "ncbi:WP_3.1").locator('[data-glyph="OWH"]')).toHaveCount(1);
  const res = row(page, "resfinder");
  await expect(res.locator("[data-label]")).toHaveText("Best");
  await expect(res.locator("[data-count]")).toHaveText("1 match shown");
  await expect(top(res, "resfinder:blaX").locator('[data-value="identity"]')).toHaveText("100.0%");
});

test("card:ARO:2000 at 90%: coverage above 100% is drawn full with an overflow mark; resfinder has a no-match row", async ({ page }) => {
  await open(page, "card:ARO:2000");
  const t = top(row(page, "ncbi"), "ncbi:WP_4.1");
  await expect(t.locator('[data-value="coverage"]')).toHaveText("105.0% (over 100%)");
  await expect(t.locator('[data-bar="coverage"]')).toHaveAttribute("data-length", "200");
  await expect(t.locator('[data-bar="coverage"] [data-overflow]')).toHaveCount(1);
  await expect(t.locator('[data-bar="identity"] [data-overflow]')).toHaveCount(0);
  const res = row(page, "resfinder");
  await expect(res).toHaveAttribute("data-kind", "none");
  await expect(res.locator("[data-none]")).toBeVisible(); // stated, not merely present in the DOM
  await expect(res.locator("[data-none]")).toContainText("No match at or above 90% identity");
  await expect(res.locator("[data-none]")).toContainText("1 match below 90% in this release's graph; lower the minimum identity to see it.");
  await expect(res.locator("svg[data-bar]")).toHaveCount(0); // no bar on a no-match row
});

test("card:ARO:2000 at 80%: a weak group is Highest identity shown, never Best", async ({ page }) => {
  await open(page, "card:ARO:2000", 80);
  const res = row(page, "resfinder");
  await expect(res.locator("[data-label]")).toHaveText("Highest identity shown");
  await expect(res).toContainText("Weak evidence");
  await expect(top(res, "resfinder:tetM").locator('[data-value="identity"]')).toHaveText("88.0%");
  await expect(res.getByText("Best", { exact: true })).toHaveCount(0);
});

test("resfinder:orphan: a no-match row for each other database", async ({ page }) => {
  await open(page, "resfinder:orphan");
  for (const db of ["card", "ncbi"]) {
    await expect(row(page, db).locator("[data-none]")).toBeVisible();
    await expect(row(page, db).locator("[data-none]")).toContainText("No match at or above 90% identity");
    await expect(row(page, db).locator("[data-none]")).toContainText("No match from this entry at any identity in this release's graph");
  }
  await expect(page.getByTestId("comparison").locator("li[data-db]")).toHaveCount(2);
});

test("bar pixels: identity length and the labelled weak mark at 180; the minimum identity is not drawn on the bars", async ({ page }) => {
  await open(page, "card:ARO:1000");
  const bar = top(row(page, "resfinder"), "resfinder:blaX").locator('[data-bar="identity"]');
  await expect(bar).toHaveAttribute("data-length", "200"); // identity 1.0
  await expect(bar.locator('[data-line="weak"]')).toHaveAttribute("data-x", "180");
  await expect(bar.locator('[data-line="weak"] [data-stroke]')).toHaveAttribute("x1", "180");
  const label = top(row(page, "resfinder"), "resfinder:blaX").locator("[data-mark-label]");
  await expect(label).toHaveText("90%");
  await expect(label).toHaveAttribute("data-x", "180");
  // The label is centred over the line: its centre and the line's x agree on screen to within a pixel.
  const [lc, sx] = await Promise.all([
    label.evaluate((e) => { const r = e.getBoundingClientRect(); return r.left + r.width / 2; }),
    bar.locator('[data-line="weak"] [data-stroke]').evaluate((e) => { const r = e.getBoundingClientRect(); return r.left + r.width / 2; }),
  ]);
  expect(Math.abs(lc - sx)).toBeLessThan(1);
  await expect(bar.locator("[data-fill]")).toHaveAttribute("width", "200");
  await open(page, "card:ARO:2000", 80);
  const weakBar = top(row(page, "resfinder"), "resfinder:tetM").locator('[data-bar="identity"]');
  await expect(weakBar.locator('[data-line="weak"] [data-stroke]')).toHaveAttribute("x1", "180");
  await expect(weakBar.locator("[data-fill]")).toHaveAttribute("width", "176"); // 0.88 x 200
  // One mark per identity bar, none on coverage bars, and no minimum identity line anywhere in the strip.
  const strip = page.getByTestId("comparison");
  await expect(strip.locator('[data-line="min"]')).toHaveCount(0);
  await expect(strip.locator('[data-bar="coverage"] [data-line]')).toHaveCount(0);
  await expect(strip.locator('[data-bar="identity"] [data-line="weak"]')).toHaveCount(await strip.locator('[data-bar="identity"]').count());
  await expect(page.getByTestId("comparison-key")).toContainText("does not hide anything");
  await expect(page.getByTestId("comparison-key")).toContainText("minimum identity (80%)");
});

test("moving the slider updates the strip: a match hidden by the minimum becomes a no-match row", async ({ page }) => {
  await open(page, "card:ARO:2000", 80);
  await expect(row(page, "resfinder")).toHaveAttribute("data-kind", "match");
  await page.getByLabel("Minimum identity").fill("89");
  await expect(row(page, "resfinder")).toHaveAttribute("data-kind", "none");
  await expect(row(page, "resfinder").locator("[data-none]")).toBeVisible();
  await expect(row(page, "resfinder").locator("[data-none]")).toContainText("No match at or above 89% identity");
});

test("the strip equals the cards: best ids, counts and databases, at three minimum identities", async ({ page }) => {
  for (const [q, min] of [["card:ARO:1000", 90], ["card:ARO:1000", 0], ["card:ARO:2000", 80]] as const) {
    await open(page, q, min);
    for (const db of ["card", "ncbi", "resfinder"]) {
      const r = row(page, db);
      if ((await r.count()) === 0) continue; // the query's own database has no row
      const cards = page.getByRole("region", { name: `Matches in ${db}` }).locator("li[data-match]");
      if ((await r.getAttribute("data-kind")) === "none") {
        await expect(cards).toHaveCount(0);
        continue;
      }
      await expect(r.locator("[data-count]")).toHaveAttribute("data-count", String(await cards.count()));
      const bestCards = await page.getByRole("region", { name: `Matches in ${db}` }).locator("li[data-match][data-best]").evaluateAll((els) => els.map((e) => e.getAttribute("data-match")));
      const tops = await r.locator("[data-top]").evaluateAll((els) => els.map((e) => e.getAttribute("data-top")));
      expect(tops, `${q} at ${min}% in ${db}`).toEqual(bestCards);
      // The printed identity, coverage and type of each top match equal its card's Match details.
      for (const id of tops) {
        const card = page.locator(`li[data-match="${id}"] [data-field="match-details"]`);
        const t = r.locator(`[data-top="${id}"]`);
        await expect(t.locator('[data-value="identity"]')).toHaveText((await card.locator('[data-field="identity"] dd').innerText()).match(/^[0-9.]+%/)![0]);
        await expect(t.locator('[data-value="coverage"]')).toContainText((await card.locator('[data-field="coverage"] dd').innerText()).trim());
        await expect(t.locator('[data-value="type"]')).toHaveText((await card.locator('[data-field="type"] dd').innerText()).trim());
      }
    }
  }
});

test("a top match's name goes to its card, by keyboard", async ({ page }) => {
  await open(page, "card:ARO:1000");
  const btn = top(row(page, "resfinder"), "resfinder:blaX").getByRole("button");
  await btn.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('li[data-match="resfinder:blaX"]')).toBeFocused();
  await expect(page.locator('li[data-match="resfinder:blaX"]')).toBeInViewport();
});

test("every bar in the strip is drawn at the same width, so lengths compare across matches and databases", async ({ page }) => {
  // A grid whose last column sized to its content once made one match's bars wider than another's (same values,
  // different lengths). Checked with RBH and OWH rows side by side, and with an overflow note.
  for (const [q, min] of [["card:ARO:1000", 90], ["card:ARO:2000", 80]] as const) {
    await open(page, q, min);
    const widths = await page.getByTestId("comparison").locator("svg[data-bar]").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
    expect(widths.length, q).toBeGreaterThan(1);
    expect(new Set(widths).size, `${q}: ${widths.join(", ")}`).toBe(1);
  }
});
