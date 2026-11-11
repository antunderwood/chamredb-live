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

// card:ARO:3000010 (vanA): ncbi:WP_063856521.1 and resfinder:VanHAX are both RBH matches of the query and RBH with each other
// (a raw read of data/graph.json: both directions are RBH). Expanding both used to draw the link twice, on top of itself.
test("two RBH matches that are RBH with each other, both expanded, are joined by one link, and the caption says so", async ({ page }) => {
  await open(page, "#q=card%3AARO%3A3000010&min=90");
  for (const pill of await page.locator("[data-expand]").all()) await pill.click();
  const links = net(page).locator('[data-edge][data-kind="link"]');
  await expect(links).toHaveCount(1);
  await expect(links.first()).toHaveAttribute("data-type", "RBH");
  await expect(links.first().locator("path")).toHaveAttribute("marker-start", /net-arrow/); // still two arrowheads
  await expect(page.getByTestId("network-step2-note")).toContainText("1 reciprocal link between matches is drawn once");
});

// Everything drawn lies inside the svg's own box (owner bug: a link between two step-1 nodes bowed right of a viewBox that had no step-2
// column, and was clipped). card:ARO:3000230 has two matches (ncbi:WP_032490446.1 and resfinder:ant(2'')-Ia); expanding either adds no
// node, only the link between them. Checked at three widths, for the figure and for what the scroll box shows after the expand.
const inside = (page: Page) =>
  page.evaluate(() => {
    const svg = document.querySelector<SVGSVGElement>('[data-testid="network"]')!.getBoundingClientRect();
    const out: string[] = [];
    for (const el of document.querySelectorAll('[data-testid="network"] [data-edge] path, [data-testid="network"] .net-pill rect, [data-testid="network"] g[data-node] .net-hit')) {
      const r = el.getBoundingClientRect();
      const who = `${el.closest("[data-edge], [data-node]")?.getAttribute("data-edge") ?? el.closest("[data-node]")?.getAttribute("data-node")} ${el.tagName}.${el.getAttribute("class") ?? ""}`;
      if (r.left < svg.left - 0.5 || r.top < svg.top - 0.5 || r.right > svg.right - 8 || r.bottom > svg.bottom + 0.5) out.push(`${who}: ${[r.left, r.top, r.right, r.bottom].map(Math.round)} outside ${[svg.left, svg.top, svg.right, svg.bottom].map(Math.round)}`);
    }
    return out;
  });
for (const width of [390, 700, 1000]) {
  test(`${width} px: after an expand every edge, label and chip is inside the figure, and the scroll box shows the new link`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" }); // scrolls at once
    await open(page, "#q=card%3AARO%3A3000230&min=90");
    expect(await inside(page)).toEqual([]);
    const pills = await page.locator("[data-expand]").count();
    expect(pills).toBe(2);
    for (let i = 0; i < pills; i++) {
      await page.locator("[data-expand]").nth(i).click();
      await expect(net(page).locator('[data-edge][data-kind="link"]')).toHaveCount(1); // one link, no new node
      await expect(net(page).locator('g[data-role="step2"]')).toHaveCount(0);
      expect(await inside(page), `expanding pill ${i}`).toEqual([]);
      // the new link's label is visible in the scroll box (the box has scrolled to it)
      const label = (await net(page).locator('[data-kind="link"] .net-pill').boundingBox())!;
      const box = (await page.locator(".net-scroll").boundingBox())!;
      expect(label.x, "label not left of the box").toBeGreaterThanOrEqual(box.x - 1);
      expect(label.x + label.width, "label not right of the box").toBeLessThanOrEqual(box.x + box.width + 1);
      await page.locator("[data-expand]").nth(i).click(); // collapse again
      await expect(net(page).locator('[data-kind="link"]')).toHaveCount(0);
    }
  });
}

test("card:ARO:3002546 with two neighbours expanded: everything drawn is inside the figure", async ({ page }) => {
  await open(page, "#q=card%3AARO%3A3002546&min=90");
  await page.getByRole("button", { name: "Expand matches of aac(6')-Ib4 (4)" }).click();
  await page.getByRole("button", { name: "Expand matches of ant(3'')-Ii-aac(6')-IId (2)" }).click();
  await expect(net(page).locator("g[data-node]")).toHaveCount(9);
  expect(await inside(page)).toEqual([]);
});

test("the scroll box is obviously scrollable at 390 px: a drawn scrollbar and a shade at the edge that has more", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await open(page, "#q=card%3AARO%3A3000230&min=90");
  const box = page.locator(".net-scroll");
  // Headless Chromium hides scrollbars whatever the CSS says, so the style is asserted: a 14 px classic scrollbar (which takes
  // space, unlike a macOS overlay one) drawn in tokens.
  expect(await box.evaluate((el) => getComputedStyle(el, "::-webkit-scrollbar").height)).toBe("14px");
  expect(await box.evaluate((el) => getComputedStyle(el, "::-webkit-scrollbar-thumb").backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");
  const bg = await box.evaluate((el) => getComputedStyle(el).backgroundAttachment);
  expect(bg).toContain("local"); // the covers that hide the shade at the ends
  expect(bg).toContain("scroll");
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
