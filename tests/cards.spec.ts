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
    await expect(items.nth(i)).toHaveText(/^[0-9]+$/.test(id) ? `${id} (PubMed, opens in new tab)` : id);
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

test("the network is its own section, open by default, between the comparison strip and the cards", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await search(page, "card:ARO:1000");
  const section = page.getByTestId("network-section");
  await expect(section).toHaveJSProperty("open", true);
  await expect(section.locator("summary")).toHaveText("Network");
  await expect(section.getByTestId("network")).toBeVisible();
  const y = async (sel: string) => (await page.locator(sel).first().boundingBox())!.y;
  // #25 (ADR 0006): the network moved from under the query panel into the rail with the strip. Checked in one column
  // (900 px): strip, network, query panel, cards. The two-column case is in layout.spec.ts.
  expect(await y('[data-testid="network-section"]')).toBeGreaterThan(await y('[data-testid="comparison"]'));
  expect(await y('[data-query]')).toBeGreaterThan(await y('[data-testid="network-section"]'));
  expect(await y('[data-match]')).toBeGreaterThan(await y('[data-query]'));
});

test("a row below 90% in a group that is not weak says so; the 90.0% row does not", async ({ page }) => {
  await search(page, "card:ARO:1000");
  await page.getByLabel("Minimum identity").fill("80");
  await expect(page.locator('[data-match="resfinder:blaXlow"] [data-field="below-line"]')).toContainText("Below 90% identity");
  await expect(page.locator('[data-match="ncbi:WP_4.1"] [data-field="below-line"]')).toHaveCount(0); // exactly 90.0%
  await expect(page.locator('[data-match="resfinder:blaX"] [data-field="below-line"]')).toHaveCount(0);
});

test("the query panel's cards are h3 under its h2, a match panel's cards h4 under its h3", async ({ page }) => {
  await search(page, "card:ARO:1000");
  await expect(page.getByRole("region", { name: "Query entry" }).getByRole("heading", { level: 3 })).toHaveText(["Phenotype", "Other metadata"]);
  await expect(page.locator('[data-match="ncbi:WP_1.1"]').getByRole("heading", { level: 4 })).toHaveText(["Phenotype of this match", "Other metadata", "Match details"]);
});

test("no horizontal overflow at 768 px, where the three columns begin", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await search(page, "card:ARO:1000");
  await expect(page.locator("[data-match]").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

test("cards stack in one column at phone width and sit side by side in a wide column", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await search(page, "card:ARO:1000");
  const xs = async () => page.locator('[data-match="ncbi:WP_1.1"] h4').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().x)));
  expect(new Set(await xs()).size).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  // #25: the panels follow the width of the cards' column. At 1200 px the cards are in the narrow right column and
  // stack (layout.spec.ts); a wide single column (900 px window, below the two-column breakpoint) puts them side by side.
  await page.setViewportSize({ width: 900, height: 800 });
  expect(new Set(await xs()).size).toBe(3);
});

test("Match details: identity and coverage have a bar the length scale() gives, and the printed numbers are unchanged (#23)", async ({ page }) => {
  await search(page, "card:ARO:1000");
  const p = page.locator('[data-match="ncbi:WP_1.1"]');
  // Hand-worked (tests/fixtures/README.md, Bar scale): identity 0.97 x 200 = 194, coverage 1.0 x 200 = 200.
  await expect(p.locator('[data-bar="identity"]')).toHaveAttribute("data-length", "194");
  await expect(p.locator('[data-bar="identity"] [data-fill]')).toHaveAttribute("width", "194");
  await expect(p.locator('[data-bar="coverage"]')).toHaveAttribute("data-length", "200");
  await expect(p.locator('[data-bar="coverage"] [data-overflow]')).toHaveCount(0);
  await expect(p.locator('[data-field="identity"] dd')).toContainText("97.0%");
  await expect(p.locator('[data-field="identity"] dd')).toContainText("Best"); // the label is unchanged
  await expect(p.locator('[data-field="coverage"] dd')).toHaveText("100.0%");
  await expect(p.locator('[data-field="identity"] [data-line]')).toHaveCount(0); // the 90% mark stays in the strip
});

test("Match details: coverage above 100% is a full bar with the overflow mark and the exact number (#23)", async ({ page }) => {
  await search(page, "card:ARO:2000");
  const p = page.locator('[data-match="ncbi:WP_4.1"]');
  await expect(p.locator('[data-field="coverage"] dd')).toHaveText("105.0% (over 100%)");
  await expect(p.locator('[data-bar="coverage"]')).toHaveAttribute("data-length", "200");
  await expect(p.locator('[data-bar="coverage"] [data-overflow]')).toHaveCount(1);
  await expect(p.locator('[data-bar="identity"] [data-overflow]')).toHaveCount(0);
  await expect(p.locator('[data-bar="identity"]')).toHaveAttribute("data-length", "184"); // 0.92 x 200 (README: WP_4.1 at 92.0%)
});
