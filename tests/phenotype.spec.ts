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

test("header shows the queried entry's phenotype and additional phenotype verbatim", async ({ page }) => {
  await search(page, "card:ARO:2000");
  const header = page.getByRole("region", { name: "Query entry" });
  await expect(header).toContainText("card:ARO:2000");
  await expect(header.locator('[data-field="phenotype"] [data-phenotype]')).toHaveText(node("card:ARO:2000").phenotype!);
  await expect(header.locator('[data-field="additional-phenotype"] [data-phenotype]')).toHaveText(
    node("card:ARO:2000").additional_phenotype!,
  );
  await expect(header).not.toContainText("not recorded");
});

test("header omits the additional phenotype when the entry has none", async ({ page }) => {
  await search(page, "card:ARO:1000");
  const header = page.getByRole("region", { name: "Query entry" });
  await expect(header.locator('[data-field="phenotype"] [data-phenotype]')).toHaveText(node("card:ARO:1000").phenotype!);
  await expect(header.locator('[data-field="additional-phenotype"]')).toHaveCount(0);
});

test("an entry without a phenotype says 'not recorded in this database', not 'no resistance'", async ({ page }) => {
  expect(node("resfinder:orphan").phenotype).toBeUndefined();
  await search(page, "resfinder:orphan");
  const header = page.getByRole("region", { name: "Query entry" });
  await expect(header.locator('[data-field="phenotype"] [data-phenotype]')).toHaveText("not recorded");
  await expect(header).toContainText("Phenotype: not recorded in this database");
  await expect(header).toContainText("not a statement that the gene confers no resistance");
});

test("a match without a phenotype says 'not recorded' with the gap caveat", async ({ page }) => {
  expect(node("resfinder:blaXlow").phenotype).toBeUndefined();
  await search(page, "card:ARO:1000");
  await page.getByLabel("Minimum identity").fill("80");
  const row = page.getByRole("region", { name: "Matches in resfinder" }).getByRole("listitem").nth(1);
  await expect(row).toContainText("blaXlow");
  await expect(row.locator("[data-phenotype]")).toHaveText("not recorded");
  await expect(row).toContainText("Phenotype of this match: not recorded in this database");
  await expect(row).toContainText("not evidence of no resistance");
});

test("each match shows that entry's phenotype verbatim", async ({ page }) => {
  await search(page, "card:ARO:1000");
  const ncbi = page.getByRole("region", { name: "Matches in ncbi" }).getByRole("listitem");
  const expected = ["ncbi:WP_1.1", "ncbi:WP_3.1", "ncbi:WP_4.1"].map((id) => node(id).phenotype!);
  await expect(ncbi).toHaveCount(3);
  for (const [i, text] of expected.entries()) {
    await expect(ncbi.nth(i).locator('[data-field="match-phenotype"] [data-phenotype]')).toHaveText(text);
  }
  const resfinder = page.getByRole("region", { name: "Matches in resfinder" }).getByRole("listitem");
  await expect(resfinder.locator("[data-phenotype]")).toHaveText(node("resfinder:blaX").phenotype!);
  await expect(resfinder).toContainText("Phenotype of this match:");
});

test("phenotype text wraps at phone width (no horizontal scroll)", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 700 });
  await search(page, "card:ARO:2000");
  await expect(page.getByRole("region", { name: "Query entry" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
