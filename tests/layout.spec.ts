import { expect, test, type Page } from "@playwright/test";

// The results layout (#25, ADR 0006): a wider shell; from 1024 px two columns, a sticky left rail with the comparison
// strip and the network picture, the query panel and the cards on the right; below 1024 px one column in the order
// strip, network, query panel, cards. Geometry is read from the rendered page (getBoundingClientRect), not from classes.
type Box = { left: number; top: number; right: number; bottom: number; width: number };
const box = async (page: Page, sel: string): Promise<Box> => {
  const b = await page.locator(sel).first().evaluate((e) => {
    const r = e.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width };
  });
  return b;
};
const STRIP = '[data-testid="comparison"]';
const NET = '[data-testid="network-section"]';
const QUERY = 'section[aria-label="Query entry"]';
const CARDS = 'section[aria-label^="Matches in"]';

async function open(page: Page, q: string, min?: number) {
  await page.goto(`./#q=${encodeURIComponent(q)}${min !== undefined ? `&min=${min}` : ""}`);
  await expect(page.getByTestId("comparison")).toBeVisible();
}

test("from 1024 px: strip and network on the left, query panel and cards on the right, tops aligned; shell about 1200 px", async ({ page }) => {
  for (const width of [1024, 1280, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    await open(page, "card:ARO:1000");
    const [strip, net, query, cards] = await Promise.all([STRIP, NET, QUERY, CARDS].map((s) => box(page, s)));
    expect(strip.right, `${width}: strip left of the query panel`).toBeLessThanOrEqual(query.left);
    expect(net.right, `${width}: network left of the cards`).toBeLessThanOrEqual(cards.left);
    expect(Math.abs(net.left - strip.left), `${width}: one left column`).toBeLessThan(1);
    expect(Math.abs(cards.left - query.left), `${width}: one right column`).toBeLessThan(1);
    expect(net.top, `${width}: network under the strip`).toBeGreaterThan(strip.bottom - 1);
    expect(Math.abs(strip.top - query.top), `${width}: the two columns start together`).toBeLessThan(1);
    const main = await box(page, "main");
    expect(main.width, `${width}: shell`).toBeLessThanOrEqual(1200);
    if (width >= 1280) expect(main.width, `${width}: shell`).toBeGreaterThanOrEqual(1150);
  }
});

test("the left rail stays in view while the cards scroll, and scrolls on its own when taller than the window", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 });
  await open(page, "card:ARO:1000", 0); // every match shown, so the right column is long
  const rail = page.getByTestId("results-rail");
  // Scroll the window 300 px into the results: the right column must still run past the bottom of the window there.
  const detail = await box(page, '[data-testid="results-detail"]');
  expect(detail.bottom - detail.top, "right column long enough for the check").toBeGreaterThan(300 + 700);
  await page.evaluate((y) => window.scrollTo(0, y), detail.top + 300 + (await page.evaluate(() => window.scrollY)));
  expect(await page.evaluate(() => window.scrollY), "the window really scrolled").toBeGreaterThan(300);
  const r = await box(page, '[data-testid="results-rail"]');
  expect(r.top, "rail pinned near the top").toBeGreaterThanOrEqual(0);
  expect(r.top).toBeLessThan(40);
  expect(r.bottom, "rail fits the window").toBeLessThanOrEqual(700);
  // Here the rail is taller than the window, and its whole content is still reachable: it scrolls by itself.
  expect(await rail.evaluate((e) => e.scrollHeight - e.clientHeight), "rail content taller than the rail").toBeGreaterThan(0);
  await rail.evaluate((e) => e.scrollTo(0, e.scrollHeight));
  await expect(page.getByTestId("network")).toBeInViewport();
  expect(await rail.evaluate((e) => e.scrollTop), "the rail scrolled, not the window").toBeGreaterThan(0);
  expect(await rail.evaluate((e) => getComputedStyle(e).position)).toBe("sticky");
});

test("below 1024 px: one column in the order strip, network, query panel, cards", async ({ page }) => {
  for (const width of [1023, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await open(page, "card:ARO:1000");
    const [strip, net, query, cards] = await Promise.all([STRIP, NET, QUERY, CARDS].map((s) => box(page, s)));
    expect(net.top, `${width}`).toBeGreaterThan(strip.bottom - 1);
    expect(query.top, `${width}`).toBeGreaterThan(net.bottom - 1);
    expect(cards.top, `${width}`).toBeGreaterThan(query.bottom - 1);
    for (const b of [net, query, cards]) expect(Math.abs(b.left - strip.left), `${width}: one column`).toBeLessThan(1);
    expect(await page.getByTestId("results-rail").evaluate((e) => getComputedStyle(e).position), `${width}`).toBe("static");
  }
});

test("no horizontal page scroll at 360 px, with results shown", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  for (const q of ["card:ARO:1000", "card:ARO:2000"]) {
    await open(page, q);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), q).toBeLessThanOrEqual(360);
  }
});

test("keyboard reading order is strip, network, query panel, cards, at 1280 px and at 390 px", async ({ page }) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await open(page, "card:ARO:1000");
    await page.locator("#min-identity").focus();
    const seen: string[] = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      const where = await page.evaluate(() => {
        const a = document.activeElement;
        if (!a) return "none";
        if (a.closest('[data-testid="comparison"]')) return "strip";
        if (a.closest('[data-testid="network-section"]')) return "network";
        if (a.closest('section[aria-label="Query entry"]')) return "query";
        if (a.closest('section[aria-label^="Matches in"]')) return "cards";
        return "other";
      });
      if (where === "other" && seen.includes("cards")) break; // past the results
      if (where !== "other" && seen[seen.length - 1] !== where) seen.push(where);
    }
    const regions = seen.filter((s) => s !== "query"); // the query panel has no Tab stop of its own
    expect(regions, `${width}: ${seen.join(" > ")}`).toEqual(["strip", "network", "cards"]);
  }
});

test("the network, the strip and the cards list the same first-step matches at 0%, 80% and 90%", async ({ page }) => {
  for (const [q, min] of [["card:ARO:1000", 0], ["card:ARO:1000", 80], ["card:ARO:1000", 90], ["card:ARO:2000", 80]] as const) {
    await open(page, q, min);
    for (const db of ["card", "ncbi", "resfinder"]) {
      const row = page.getByTestId("comparison").locator(`li[data-db="${db}"]`);
      if ((await row.count()) === 0) continue; // the query's own database
      const cardIds = await page.locator(`section[aria-label="Matches in ${db}"] li[data-match]`).evaluateAll((els) => els.map((e) => e.getAttribute("data-match")).sort());
      const nodeIds = await page.locator(`[data-testid="network"] [data-role="match"][data-db="${db}"]`).evaluateAll((els) => els.map((e) => e.getAttribute("data-node")).sort());
      expect(nodeIds, `${q} ${min}% ${db}: network = cards`).toEqual(cardIds);
      if ((await row.getAttribute("data-kind")) === "none") {
        expect(cardIds, `${q} ${min}% ${db}: no-match row, no cards`).toEqual([]);
        continue;
      }
      await expect(row.locator("[data-count]")).toHaveAttribute("data-count", String(cardIds.length));
      const tops = await row.locator("[data-top]").evaluateAll((els) => els.map((e) => e.getAttribute("data-top")).sort());
      const bestNodes = await page.locator(`[data-testid="network"] [data-role="match"][data-db="${db}"][data-best]`).evaluateAll((els) => els.map((e) => e.getAttribute("data-node")).sort());
      expect(tops, `${q} ${min}% ${db}: strip tops = network best`).toEqual(bestNodes);
    }
  }
});

test("in the rail the expanded picture scrolls sideways, and a node reached by hover or Tab keeps its tooltip", async ({ page }) => {
  // The three-column picture is wider than the rail. Before #25 any sideways scroll of the box dismissed the tooltip,
  // so hovering or focusing a node that first had to be scrolled into view showed nothing.
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, "card:ARO:1000");
  await page.getByRole("button", { name: "Expand matches of tetM-like (1)" }).click();
  const scroller = page.getByRole("region", { name: /Network picture/ });
  expect(await scroller.evaluate((e) => e.scrollWidth - e.clientWidth), "the expanded picture is wider than the rail").toBeGreaterThan(0);
  const s2 = page.locator('[data-testid="network"] g[data-role="step2"]');
  await s2.hover();
  await expect(page.getByRole("tooltip")).toContainText("match of ncbi:WP_4.1");
  await page.mouse.move(0, 0);
  await scroller.evaluate((e) => e.scrollTo(0, 0));
  await page.keyboard.press("Shift"); // keyboard focus (:focus-visible), as network.spec.ts keyFocus does
  await s2.focus();
  await expect(page.getByRole("tooltip")).toContainText("match of ncbi:WP_4.1");
  // Scrolled away from the node, the tooltip is hidden rather than pointing at nothing, and comes back with the node.
  await scroller.evaluate((e) => e.scrollTo(0, 0));
  await expect(page.getByRole("tooltip")).toBeHidden();
  await scroller.evaluate((e) => e.scrollTo(e.scrollWidth, 0));
  await expect(page.getByRole("tooltip")).toBeVisible();
});

test("a card lays out its panels by the width of its column: stacked in the narrow right column, side by side in one wide column", async ({ page }) => {
  // In the 1280 px two-column layout the right column is about 450 px; three panels side by side there broke words
  // mid-way (GENTAM ICIN, Be st). The panels follow the column's width (a size container), not the window's.
  const lefts = (sel: string) => page.locator(sel).first().locator(":scope > *").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, "card:ARO:1000");
  for (const sel of ["li[data-match] [data-card-grid]", 'section[aria-label="Query entry"] [data-card-grid]']) {
    expect(new Set(await lefts(sel)).size, `1280: ${sel} stacked`).toBe(1);
  }
  await page.setViewportSize({ width: 900, height: 900 });
  expect(new Set(await lefts("li[data-match] [data-card-grid]")).size, "900: match panels side by side").toBe(3);
  expect(new Set(await lefts('section[aria-label="Query entry"] [data-card-grid]')).size, "900: query panels side by side").toBe(2);
});
