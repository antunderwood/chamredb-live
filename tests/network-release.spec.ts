import { expect, test, type Page } from "@playwright/test";

// Runs against the real-release build (playwright.release.config.ts): the entries below exist only in the real data.
// Expected values: a raw read of data/graph.json (scripted, independent of the app). card:ARO:3002546 has six matches at
// 90%, all one-way. Expanding aac(6')-Ib4 (ncbi:WP_003159191.1) gives card:ARO:3002577 (a new node, 100% RBH) and three
// matches that are also matches of the query (the three ResFinder entries); expanding resfinder:ant(3'')-Ii-aac(6')-IId
// gives card:ARO:3002598 (new, 100% RBH) and ncbi:WP_063839878.1 (a match of the query too). Neither expanded entry lists
// the query. So: 1 + 6 + 2 = 9 nodes, 2 step-2 nodes and 4 links between existing nodes.
test.skip(!process.env.RELEASE_E2E, "needs the real-release build: npm run e2e runs it with playwright.release.config.ts");

const net = (page: Page) => page.getByTestId("network");
async function open(page: Page, hash: string) {
  await page.goto(`./${hash}`);
  await expect(net(page)).toBeVisible();
}

test("card:ARO:3002546: six matches; expanding two neighbours gives 9 nodes and no step-2 node is a match of the query", async ({ page }) => {
  await open(page, "#q=card%3AARO%3A3002546&min=90");
  await expect(net(page).locator("g[data-node]")).toHaveCount(7);
  const listed = await page.locator("[data-match]").evaluateAll((els) => els.map((e) => e.getAttribute("data-match")));
  expect(listed).toHaveLength(6);
  await page.getByRole("button", { name: "Expand matches of aac(6')-Ib4 (4)" }).click();
  await page.getByRole("button", { name: "Expand matches of ant(3'')-Ii-aac(6')-IId (2)" }).click();
  await expect(net(page).locator("g[data-node]")).toHaveCount(9);
  const s2 = net(page).locator('g[data-role="step2"]');
  await expect(s2).toHaveCount(2);
  const ids = await s2.evaluateAll((els) => els.map((e) => e.getAttribute("data-node")).sort());
  expect(ids).toEqual(["card:ARO:3002577", "card:ARO:3002598"]);
  for (const id of ids) {
    const g = net(page).locator(`g[data-node="${id}"]`);
    expect(listed).not.toContain(id); // not a match of the query: no card
    expect(["ncbi:WP_003159191.1", "resfinder:ant(3'')-Ii-aac(6')-IId"]).toContain(await g.getAttribute("data-via"));
    await expect(g.locator(".net-sub")).toContainText("match of ");
    await expect(g).toHaveAttribute("aria-label", /not a match of the query/);
  }
  // no step-2 edge goes to or from the query, and the step-2 edges carry no identity label
  await expect(net(page).locator('[data-edge][data-step="2"][data-edge*="card:ARO:3002546"]')).toHaveCount(0);
  await expect(net(page).locator('[data-edge][data-step="2"][data-kind="expand"] .net-pill')).toHaveCount(0);
  // the four links between existing nodes are labelled as a match of a match
  const links = net(page).locator('[data-edge][data-kind="link"]');
  await expect(links).toHaveCount(4);
  for (const l of await links.all()) await expect(l.locator(".net-pill text")).toHaveText("match of a match");
  await expect(net(page).locator('[data-edge][data-step="1"]')).toHaveCount(6);
  // the card list is unchanged
  expect(await page.locator("[data-match]").evaluateAll((els) => els.map((e) => e.getAttribute("data-match")))).toEqual(listed);
  await expect(page.getByTestId("network-step2-note")).toContainText("not a match of the query");
});

test("the cap message appears when the 25 node cap drops step-2 nodes (card:ARO:3001052 at 90%, every match expanded)", async ({ page }) => {
  await open(page, "#q=card%3AARO%3A3001052&min=90");
  await expect(page.getByTestId("network-cap")).toHaveCount(0);
  for (const pill of await page.locator("[data-expand]").all()) await pill.click();
  // the oracle (tests/oracle/expand_expected.json) records 1 dropped node for this entry with every match expanded
  await expect(net(page).locator("g[data-node]")).toHaveCount(25);
  await expect(page.getByTestId("network-cap")).toContainText("limit is 25");
  await expect(page.getByTestId("network-cap")).toContainText("1 lower-ranked (identity, then id) match");
});

test("long names are cut with an ellipsis and stay inside their chip; the full text is in the tooltip and the card", async ({ page }) => {
  for (const hash of ["#q=card%3AARO%3A3000521&min=90", "#q=card%3AARO%3A3002546&min=90"]) {
    await open(page, hash);
    for (const g of await net(page).locator("g[data-node]").all()) {
      const chip = (await g.locator(".net-hit").boundingBox())!;
      const step1 = (await g.getAttribute("data-role")) === "match";
      for (const t of await g.locator(".net-name, .net-sub, .net-detail").all()) {
        const b = (await t.boundingBox())!;
        const room = step1 && !(await t.evaluate((el) => el.classList.contains("net-detail"))) ? 26 : 4; // the "+n" pill covers the right 26 px
        expect(b.x + b.width, `${await g.getAttribute("data-node")} ${await t.textContent()}`).toBeLessThanOrEqual(chip.x + chip.width - room);
      }
    }
  }
  await open(page, "#q=card%3AARO%3A3000521&min=90");
  const q = net(page).locator('g[data-role="query"]');
  await expect(q.locator(".net-name")).toHaveText("Staphylococcu…"); // 14 characters (QUERY_NAME_MAX)
  await q.hover();
  await expect(page.getByRole("tooltip")).toContainText("Staphylococcus aureus mupA conferring resistance to mupirocin");
  await expect(page.locator("[data-query]")).toContainText("Staphylococcus aureus mupA conferring resistance to mupirocin");
});
