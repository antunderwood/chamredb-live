import { expect, test } from "@playwright/test";

// Expected values: tests/fixtures/README.md (worked by hand). card:ARO:1000 shows 4 matches at 90% (ncbi WP_1.1 RBH,
// WP_3.1 OWH, WP_4.1 OWH, resfinder blaX RBH) and 5 at 80% (adds blaXlow, OWH, 85%). card:ARO:2000 shows 1 at 90%
// (WP_4.1 RBH) and 2 at 80% (adds tetM, OWH, 88%, a group whose top identity is below 90%).
type Page = import("@playwright/test").Page;

async function search(page: Page, id: string) {
  await page.getByLabel("Entry id").fill(id);
  await page.getByRole("button", { name: "Search" }).click();
}
const net = (page: Page) => page.getByTestId("network");

test("one node and one edge per shown match at 90%, and again at 80%", async ({ page }) => {
  await page.goto("./");
  await search(page, "card:ARO:1000");
  await expect(net(page).locator("[data-edge]")).toHaveCount(4);
  await expect(net(page).locator("g[data-node]")).toHaveCount(5); // 4 matches and the query
  await page.getByLabel("Minimum identity").fill("80");
  await expect(net(page).locator("[data-edge]")).toHaveCount(5);
  await expect(net(page).locator("g[data-node]")).toHaveCount(6);
  await page.getByLabel("Minimum identity").fill("98"); // only blaX (100%) is left
  await expect(net(page).locator("[data-edge]")).toHaveCount(1);
  // The count also equals the list's own row count.
  await expect(page.getByRole("region").getByRole("listitem")).toHaveCount(1);
});

test("dashed is OWH, solid is RBH, with arrowheads showing direction", async ({ page }) => {
  await page.goto("./");
  await search(page, "card:ARO:1000");
  const edge = (id: string) => net(page).locator(`[data-edge="${id}"]`);
  await expect(edge("ncbi:WP_1.1")).toHaveAttribute("data-type", "RBH");
  await expect(edge("ncbi:WP_1.1")).not.toHaveAttribute("stroke-dasharray", /.+/);
  await expect(edge("ncbi:WP_1.1")).toHaveAttribute("marker-start", /nv-arrow/); // reciprocal: both ends
  await expect(edge("ncbi:WP_1.1")).toHaveAttribute("marker-end", /nv-arrow/);
  await expect(edge("ncbi:WP_3.1")).toHaveAttribute("data-type", "OWH");
  await expect(edge("ncbi:WP_3.1")).toHaveAttribute("stroke-dasharray", /.+/);
  await expect(edge("ncbi:WP_3.1")).not.toHaveAttribute("marker-start", /.+/); // one-way: arrow at the match only
  await expect(edge("ncbi:WP_3.1")).toHaveAttribute("marker-end", /nv-arrow/);
  await expect(edge("resfinder:blaX")).toHaveAttribute("data-type", "RBH");
});

test("the picture and the list agree on matches, identity, type and best", async ({ page }) => {
  await page.goto("./");
  await search(page, "card:ARO:1000");
  const ncbi = page.getByRole("region", { name: "Matches in ncbi" }).getByRole("listitem");
  const svgText = async (id: string) => (await net(page).locator(`g[data-node="${id}"] text`).allTextContents()).join(" ");
  expect(await svgText("ncbi:WP_1.1")).toBe("ncbi WP_1.1 97.0% RBH, best");
  expect(await svgText("ncbi:WP_3.1")).toBe("ncbi WP_3.1 97.0% OWH, best"); // tie: both best, as in the list
  expect(await svgText("ncbi:WP_4.1")).toBe("ncbi WP_4.1 90.0% OWH"); // exactly at the threshold, not best
  expect(await svgText("resfinder:blaX")).toBe("resfinder blaX 100.0% RBH, best");
  await expect(ncbi.nth(0)).toContainText("WP_1.1");
  await expect(ncbi.nth(0)).toContainText("97.0%");
  await expect(ncbi.nth(2)).toContainText("90.0%");
  // Every list row has a node whose labels match it.
  const items = await page.getByRole("region").getByRole("listitem").all();
  expect(items.length).toBe(4);
  expect(await net(page).locator("[data-edge]").count()).toBe(items.length);
  for (const li of items) {
    const text = (await li.textContent())!;
    const native = text.split(" ")[0]!;
    const pctText = text.match(/identity (\d+\.\d%)/)![1]!;
    const type = text.match(/(RBH|OWH)/)![1]!;
    const labels = await net(page).locator("g[data-node] text").allTextContents();
    expect(labels.some((t) => t.endsWith(native))).toBe(true);
    expect(labels).toContain(`${pctText} ${type}${text.includes("Best") ? ", best" : ""}`);
  }
  // Best is also a shape: square for best, circle otherwise.
  await expect(net(page).locator('g[data-node="ncbi:WP_1.1"] rect')).toHaveCount(1);
  await expect(net(page).locator('g[data-node="ncbi:WP_4.1"] circle')).toHaveCount(1);
  await expect(net(page).locator('g[data-node="ncbi:WP_4.1"] rect')).toHaveCount(0);
  // A text alternative: role img named and described.
  await expect(net(page)).toHaveAttribute("role", "img");
  await expect(net(page).locator("title").first()).toContainText("card:ARO:1000 and its 4 shown matches");
  await expect(net(page).locator("desc")).toContainText("ncbi:WP_3.1, identity 97.0%, one-way hit, best");
});

test("a weak group is marked 'highest', not 'best', in the picture as in the list", async ({ page }) => {
  await page.goto("./");
  await search(page, "card:ARO:2000");
  await expect(net(page).locator("[data-edge]")).toHaveCount(1);
  await page.getByLabel("Minimum identity").fill("80");
  await expect(net(page).locator("[data-edge]")).toHaveCount(2);
  expect((await net(page).locator('g[data-node="resfinder:tetM"] text').allTextContents()).join(" ")).toBe(
    "resfinder tetM 88.0% OWH, highest",
  );
  expect((await net(page).locator('g[data-node="ncbi:WP_4.1"] text').allTextContents()).join(" ")).toBe(
    "ncbi WP_4.1 92.0% RBH, best",
  );
});

test("no matches draws nothing; the picture fits the phone width", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("./");
  await search(page, "resfinder:orphan");
  await expect(net(page)).toHaveCount(0);
  await search(page, "card:ARO:1000");
  await expect(net(page)).toBeVisible();
  const box = (await net(page).boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test("the picture uses token colours only", async ({ page }) => {
  await page.goto("./");
  await search(page, "card:ARO:1000");
  const literal = await net(page).evaluate((svg) =>
    [...svg.querySelectorAll("*")].flatMap((el) => [el.getAttribute("fill"), el.getAttribute("stroke"), el.getAttribute("style")])
      .filter((v): v is string => !!v && /#[0-9a-f]{3,8}|rgb|hsl/i.test(v)),
  );
  expect(literal).toEqual([]);
});
