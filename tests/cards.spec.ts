import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

// Expected values: the raw tests/fixtures/graph.json (hand-worked, tests/fixtures/README.md), read directly.
type Node = { id: string; name: string; PMID?: string[]; is_a?: string; product?: string };
const nodes = (JSON.parse(readFileSync("tests/fixtures/graph.json", "utf8")) as { nodes: Node[] }).nodes;
const node = (id: string) => nodes.find((n) => n.id === id)!;

type Page = import("@playwright/test").Page;
async function search(page: Page, id: string) {
  await page.goto("./");
  await expect(page.getByLabel("Entry id")).toBeEnabled();
  await page.getByLabel("Entry id").fill(id);
  await page.getByRole("button", { name: "Search" }).click();
}

test("query panel: chips Query, database, name with id", async ({ page }) => {
  await search(page, "card:ARO:2000");
  const head = page.getByRole("region", { name: "Query entry" }).getByRole("heading", { level: 2 });
  await expect(head).toHaveText("Query card tet(M) (card:ARO:2000)");
});

test("every field of the entry is shown verbatim, PMIDs link to PubMed and open safely", async ({ page }) => {
  const n = node("card:ARO:2000");
  await search(page, n.id);
  const meta = page.getByRole("region", { name: "Query entry" }).locator('[data-field="other-metadata"]');
  await expect(meta.locator('[data-field="is-a"] dd')).toHaveText(n.is_a!);
  await expect(meta.locator('[data-field="product"] dd')).toHaveText(n.product!);
  const items = meta.locator("[data-pmid]");
  await expect(items).toHaveCount(n.PMID!.length);
  for (const [i, id] of n.PMID!.entries()) {
    await expect(items.nth(i)).toHaveText(id);
    const link = items.nth(i).getByRole("link");
    if (/^[0-9]+$/.test(id)) {
      await expect(link).toHaveAttribute("href", `https://pubmed.ncbi.nlm.nih.gov/${id}/`);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    } else {
      await expect(link).toHaveCount(0); // a DOI in a PMID field is shown as text, never linked as a PubMed id
    }
  }
});

test("fields that are absent are not shown", async ({ page }) => {
  await search(page, "card:ARO:1000"); // PMID and is_a, no product
  const meta = page.getByRole("region", { name: "Query entry" }).locator('[data-field="other-metadata"]');
  await expect(meta.locator('[data-field="pmid"]')).toBeVisible();
  await expect(meta.locator('[data-field="is-a"] dd')).toHaveText(node("card:ARO:1000").is_a!);
  await expect(meta.locator('[data-field="product"]')).toHaveCount(0);
});

test("an entry with no metadata says so and shows no field", async ({ page }) => {
  await search(page, "resfinder:orphan");
  const meta = page.getByRole("region", { name: "Query entry" }).locator('[data-field="other-metadata"]');
  await expect(meta).toContainText("No other metadata recorded in this database");
  await expect(meta.locator("dt")).toHaveCount(0);
});

test("a match panel has chips, its own metadata and match details", async ({ page }) => {
  await search(page, "card:ARO:1000");
  const panel = page.locator('[data-match="ncbi:WP_1.1"]');
  await expect(panel.getByRole("heading", { level: 3 })).toHaveText("Match ncbi blaX-1 (WP_1.1)");
  await expect(panel.locator('[data-field="product"] dd')).toHaveText(node("ncbi:WP_1.1").product!);
  await expect(panel.locator('[data-field="pmid"]')).toHaveCount(0);
  await expect(panel.locator('[data-field="identity"] dd')).toContainText("97.0%");
  await expect(panel.locator('[data-field="identity"] dd')).toContainText("Best");
  await expect(panel.locator('[data-field="coverage"] dd')).toHaveText("100.0%");
  await expect(panel.locator('[data-field="type"] dd')).toHaveText("Reciprocal best hit");
  await expect(page.locator('[data-match="ncbi:WP_3.1"] [data-field="type"] dd')).toHaveText("One-way hit");
  await expect(page.locator('[data-match="ncbi:WP_3.1"] [data-field="identity"] dd')).toContainText("Best"); // tie
  await expect(page.locator('[data-match="ncbi:WP_4.1"] [data-field="identity"] dd')).toHaveText("90.0%");
});

test("a weak group labels its top match 'Highest identity shown' beside the group warning", async ({ page }) => {
  await search(page, "card:ARO:2000");
  await page.getByLabel("Minimum identity").fill("80");
  const group = page.getByRole("region", { name: "Matches in resfinder" });
  await expect(group).toContainText("Weak evidence");
  const identity = group.locator('[data-match="resfinder:tetM"] [data-field="identity"] dd');
  await expect(identity).toContainText("88.0%");
  await expect(identity).toContainText("Highest identity shown");
  await expect(group.locator('[data-field="coverage"] dd')).toHaveText("100.0%");
});

test("the network is its own section under the query panel, open by default", async ({ page }) => {
  await search(page, "card:ARO:1000");
  const section = page.getByTestId("network-section");
  await expect(section).toHaveJSProperty("open", true);
  await expect(section.locator("summary")).toHaveText("Network");
  await expect(section.getByTestId("network")).toBeVisible();
  const y = async (sel: string) => (await page.locator(sel).first().boundingBox())!.y;
  expect(await y('[data-testid="network-section"]')).toBeGreaterThan(await y('[data-query]'));
  expect(await y('[data-match]')).toBeGreaterThan(await y('[data-testid="network-section"]'));
});

test("cards stack in one column at phone width and sit side by side on a wide screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await search(page, "card:ARO:1000");
  const xs = async () => page.locator('[data-match="ncbi:WP_1.1"] h4').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().x)));
  expect(new Set(await xs()).size).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await page.setViewportSize({ width: 1200, height: 800 });
  expect(new Set(await xs()).size).toBe(3);
});
