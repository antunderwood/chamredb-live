import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

// Expected values: the raw tests/fixtures/graph.json (hand-worked, tests/fixtures/README.md), read directly.
type Node = { id: string; phenotype?: string; additional_phenotype?: string };
const nodes = (JSON.parse(readFileSync("tests/fixtures/graph.json", "utf8")) as { nodes: Node[] }).nodes;
const node = (id: string) => nodes.find((n) => n.id === id)!;

type Page = import("@playwright/test").Page;
async function search(page: Page, id: string) {
  await page.goto("./");
  await expect(page.getByLabel("Entry id")).toBeEnabled();
  await page.getByLabel("Entry id").fill(id);
  await page.getByRole("button", { name: "Search" }).click();
}

// The list shows a label bar and one bullet per item; the stored text must be recomposed exactly from them
// (heading colon or space and the separator between items are display-only and put back here).
type Loc = import("@playwright/test").Locator;
async function expectVerbatim(list: Loc, stored: string) {
  await expect(list).toHaveCount(1);
  const label = (await list.locator("p").first().textContent())!;
  const items = await list.locator("[data-phenotype-item]").allTextContents();
  expect([`${label}: ${items.join(",")}`, `${label} ${items.join("")}`, `${label} ${items.join(", ")}`]).toContain(stored);
}

test("query panel shows the queried entry's phenotype and additional phenotype verbatim", async ({ page }) => {
  await search(page, "card:ARO:2000");
  const header = page.getByRole("region", { name: "Query entry" });
  await expect(header).toContainText("card:ARO:2000");
  await expectVerbatim(header.locator('[data-field="phenotype"] [data-phenotype-primary] [data-phenotype-list]'), node("card:ARO:2000").phenotype!);
  await expectVerbatim(header.locator('[data-field="additional-phenotype"] [data-phenotype-list]'), node("card:ARO:2000").additional_phenotype!);
  await expect(header).not.toContainText("not recorded");
});

test("query panel omits the additional phenotype when the entry has none", async ({ page }) => {
  await search(page, "card:ARO:1000");
  const header = page.getByRole("region", { name: "Query entry" });
  await expectVerbatim(header.locator('[data-field="phenotype"] [data-phenotype-primary] [data-phenotype-list]'), node("card:ARO:1000").phenotype!);
  await expect(header.locator('[data-field="additional-phenotype"]')).toHaveCount(0);
});

test("an entry without a phenotype says 'not recorded in this database', not 'no resistance'", async ({ page }) => {
  expect(node("resfinder:orphan").phenotype).toBeUndefined();
  await search(page, "resfinder:orphan");
  const header = page.getByRole("region", { name: "Query entry" });
  await expect(header.locator('[data-field="phenotype"] [data-phenotype]')).toHaveText("not recorded");
  await expect(header.locator('[data-field="phenotype"]')).toContainText("not recorded in this database");
  await expect(header).toContainText("not a statement that the gene confers no resistance");
});

test("a match without a phenotype says 'not recorded' with the gap caveat", async ({ page }) => {
  expect(node("resfinder:blaXlow").phenotype).toBeUndefined();
  await search(page, "card:ARO:1000");
  await page.getByLabel("Minimum identity").fill("80");
  const row = page.getByRole("region", { name: "Matches in resfinder" }).locator("[data-match]").nth(1);
  await expect(row).toContainText("blaXlow");
  await expect(row.locator("[data-phenotype]")).toHaveText("not recorded");
  await expect(row.locator('[data-field="match-phenotype"]')).toContainText("Phenotype of this match");
  await expect(row.locator('[data-field="match-phenotype"]')).toContainText("not recorded in this database");
  await expect(row).toContainText("not evidence of no resistance");
});

test("each match shows that entry's phenotype verbatim", async ({ page }) => {
  await search(page, "card:ARO:1000");
  const ncbi = page.getByRole("region", { name: "Matches in ncbi" }).locator("[data-match]");
  await expect(ncbi).toHaveCount(3);
  for (const [i, id] of ["ncbi:WP_1.1", "ncbi:WP_3.1", "ncbi:WP_4.1"].entries()) {
    await expect(ncbi.nth(i)).toHaveAttribute("data-match", id);
    await expectVerbatim(ncbi.nth(i).locator('[data-field="match-phenotype"] [data-phenotype-primary] [data-phenotype-list]'), node(id).phenotype!);
  }
  const resfinder = page.getByRole("region", { name: "Matches in resfinder" }).locator("[data-match]");
  await expectVerbatim(resfinder.locator("[data-phenotype-primary] [data-phenotype-list]"), node("resfinder:blaX").phenotype!);
  await expect(resfinder).toContainText("Phenotype of this match");
});

test("a match's phenotype is never inside the query panel, and the query's never inside a match", async ({ page }) => {
  await search(page, "card:ARO:2000");
  const query = page.getByRole("region", { name: "Query entry" });
  await expect(query.locator('[data-field="match-phenotype"]')).toHaveCount(0);
  await expect(query.locator("[data-match]")).toHaveCount(0);
  await expect(page.locator("[data-match] [data-field='phenotype']")).toHaveCount(0);
});

test("phenotype text wraps at phone width (no horizontal scroll)", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 700 });
  await search(page, "card:ARO:2000");
  await expect(page.getByRole("region", { name: "Query entry" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

// #24: the side-by-side view. Expected values come from the raw tests/fixtures/graph.json, not from the page. The
// "not recorded" wording in this view is checked in src/sideBySideModel.test.ts: in the fixture no entry that has matches in
// another database lacks a phenotype, so there is no page to open for it.
test.describe("phenotypes side by side (#24)", () => {
  const view = async (page: Page, id: string) => {
    await search(page, id);
    return page.getByTestId("side-by-side");
  };

  test("one column per database, the query first, each entry labelled with its database, pieces as stored", async ({ page }) => {
    const v = await view(page, "card:ARO:1000");
    await expect(v.getByRole("heading", { level: 2 })).toHaveText("Phenotypes side by side");
    expect(await v.locator("[data-side-col]").evaluateAll((els) => els.map((e) => e.getAttribute("data-side-col")))).toEqual(["card", "ncbi", "resfinder"]);
    // [entry, heading words, stored phenotype pieces]
    const expected: [string, string, string[]][] = [
      ["card:ARO:1000", "Query card blaX", ["cephalosporin"]],
      ["ncbi:WP_1.1", "Best match ncbi blaX-1", ["CEPHALOSPORIN"]],
      ["ncbi:WP_3.1", "Best match ncbi blaX-2", ["CEPHALOSPORIN"]],
      ["resfinder:blaX", "Best match resfinder blaX", ["Cephalosporins"]],
    ];
    for (const [id, heading, pieces] of expected) {
      expect(node(id).phenotype).toContain(pieces[0]); // the expected pieces are the stored ones
      const entry = v.locator(`[data-side-entry="${id}"]`);
      await expect(entry.locator("h3")).toHaveText(heading);
      await expect(entry.locator("[data-phenotype-item]")).toHaveText(pieces);
    }
  });

  test("a tie lists both best matches in the database's column", async ({ page }) => {
    const v = await view(page, "card:ARO:1000");
    await expect(v.locator('[data-side-col="ncbi"] [data-side-entry]')).toHaveCount(2);
  });

  test("the additional phenotype of the query is shown in its column, only where it exists", async ({ page }) => {
    const v = await view(page, "card:ARO:2000");
    await expect(v.locator('[data-side-entry="card:ARO:2000"] [data-field="side-additional-phenotype"]')).toContainText("tetracycline");
    await expect(v.locator('[data-side-entry="ncbi:WP_4.1"] [data-field="side-additional-phenotype"]')).toHaveCount(0);
  });

  test("a database with no match is a column that says so; with no match anywhere there is no view", async ({ page }) => {
    const v = await view(page, "card:ARO:2000");
    await expect(v.locator('[data-side-col="resfinder"] [data-side-none]')).toHaveText("No match at or above 90% identity; 1 below.");
    await expect(v.locator('[data-side-col="ncbi"]')).toContainText("Best match");
    await search(page, "resfinder:orphan");
    await expect(page.getByTestId("side-by-side")).toHaveCount(0);
  });

  test("a weak group is labelled 'Highest identity shown', never 'Best match'", async ({ page }) => {
    const v = await view(page, "card:ARO:2000");
    await page.getByLabel("Minimum identity").fill("80");
    await expect(v.locator('[data-side-col="resfinder"]')).toContainText("Highest identity shown");
    await expect(v.locator('[data-side-col="resfinder"]')).not.toContainText("Best match");
  });

  test("no sideways scroll at 360 px, and no highlighting of shared terms", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    const v = await view(page, "card:ARO:1000");
    await expect(v).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await expect(v.locator("mark")).toHaveCount(0);
  });
});
