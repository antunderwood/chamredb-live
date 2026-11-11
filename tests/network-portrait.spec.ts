import { expect, test, type Locator, type Page } from "@playwright/test";

// The portrait (phone) network picture. Fixture graph: card:ARO:1000 shows 4 matches at 90% (ncbi WP_1.1 RBH best, WP_3.1 OWH best,
// WP_4.1 OWH 90.0%, resfinder blaX RBH 100% best), 5 at 80% (adds blaXlow, OWH 85%, Below 90%), 1 at 98% (blaX). WP_4.1 has one match
// of its own, card:ARO:2000 (92%, RBH). card:ARO:2000 at 80% is a weak group (tetM 88% is "Highest identity shown").
// Geometry and its hand-worked pixels: docs/network-layout.md ("Portrait"); the box width is at 1 unit = 1 CSS pixel.
const net = (page: Page) => page.getByTestId("network");
const node = (page: Page, id: string) => net(page).locator(`g[data-node="${id}"]`);
const text = (l: Locator) => l.locator("text").allTextContents().then((t) => t.join(" | "));
async function search(page: Page, id: string) {
  await page.getByLabel("Entry id").fill(id);
  await page.getByRole("button", { name: "Search" }).click();
  await expect(net(page)).toBeVisible();
}
const keyFocus = async (page: Page, l: Locator) => {
  await page.keyboard.press("Shift");
  await l.focus();
};
const wrapWidth = async (page: Page) => (await page.locator(".net-wrap").boundingBox())!.width;
const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

// Every drawn edge, identity or link label, chip and expand target lies inside the svg's own box (nothing is clipped).
const clipped = (page: Page) =>
  page.evaluate(() => {
    const svg = document.querySelector<SVGSVGElement>('[data-testid="network"]')!.getBoundingClientRect();
    const out: string[] = [];
    for (const el of document.querySelectorAll('[data-testid="network"] [data-edge] path, [data-testid="network"] .net-pill rect, [data-testid="network"] .net-hit, [data-testid="network"] .net-expand-hit, [data-testid="network"] .net-expand-pill')) {
      const r = el.getBoundingClientRect();
      if (r.left < svg.left - 0.5 || r.top < svg.top - 0.5 || r.right > svg.right + 0.5 || r.bottom > svg.bottom + 0.5) {
        out.push(`${el.closest("[data-edge], [data-node], [data-expand]")?.getAttribute("data-edge") ?? el.closest("[data-node], [data-expand]")?.getAttribute("data-node") ?? el.closest("[data-expand]")?.getAttribute("data-expand")} ${el.getAttribute("class") ?? el.tagName}`);
      }
    }
    return out;
  });

for (const width of [390, 360]) {
  test.describe(`${width} px`, () => {
    test.use({ viewport: { width, height: 800 }, reducedMotion: "reduce" }); // no entrance animation: a chip is measured where it settles

    test("portrait: the page does not scroll sideways, the picture fits its box, no extra scroll region", async ({ page }) => {
      await page.goto("./");
      await search(page, "card:ARO:1000");
      expect(await noSideScroll(page)).toBe(true);
      await expect(page.locator(".net-scroll")).toHaveAttribute("data-orientation", "portrait");
      await expect(page.getByRole("region", { name: /Network picture/ })).toHaveCount(0); // nothing to scroll: no extra Tab stop
      const box = (await page.locator(".net-scroll").boundingBox())!;
      const svg = (await net(page).boundingBox())!;
      expect(svg.x).toBeGreaterThanOrEqual(box.x - 0.5);
      expect(svg.x + svg.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
      expect(await page.locator(".net-scroll").evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      const viewBox = (await net(page).getAttribute("viewBox"))!.split(" ").map(Number);
      expect(svg.width).toBeCloseTo(viewBox[2]!, 0); // not scaled: 1 unit is 1 CSS pixel
      await expect(net(page).locator(".net-head")).toHaveCount(0);
    });

    test("one node and one step-1 edge per shown match at 90, 80 and 98%, equal to the card list; nothing clipped", async ({ page }) => {
      await page.goto("./");
      await search(page, "card:ARO:1000");
      for (const [min, matches] of [["90", 4], ["80", 5], ["98", 1]] as const) {
        await page.getByLabel("Minimum identity").fill(min);
        await expect(page.locator("[data-match]")).toHaveCount(matches);
        await expect(net(page).locator('[data-edge][data-step="1"]')).toHaveCount(matches);
        await expect(net(page).locator("g[data-node]")).toHaveCount(matches + 1);
        const drawn = await net(page).locator('g[data-role="match"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-node")).sort());
        const listed = await page.locator("[data-match]").evaluateAll((els) => els.map((e) => e.getAttribute("data-match")).sort());
        expect(drawn).toEqual(listed);
        expect(await clipped(page), `at ${min}%`).toEqual([]);
        expect(await noSideScroll(page)).toBe(true);
      }
    });

    test("every chip and expand pill is a 44 px touch target, matches are one column under the query, with identity pills on the edges", async ({ page }) => {
      await page.goto("./");
      await search(page, "card:ARO:1000");
      await page.getByLabel("Minimum identity").fill("80");
      const q = (await node(page, "card:ARO:1000").locator(".net-hit").boundingBox())!;
      let previous = q;
      for (const id of ["ncbi:WP_1.1", "ncbi:WP_3.1", "ncbi:WP_4.1", "resfinder:blaX", "resfinder:blaXlow"]) {
        const b = (await node(page, id).locator(".net-hit").boundingBox())!;
        expect(b.height, id).toBeGreaterThanOrEqual(44);
        expect(b.width, id).toBeGreaterThanOrEqual(44);
        expect(b.y, `${id} is below the one before`).toBeGreaterThanOrEqual(previous.y + previous.height);
        expect(b.x, `${id} shares the column`).toBeCloseTo((await node(page, "ncbi:WP_1.1").locator(".net-hit").boundingBox())!.x, 0);
        previous = b;
        await expect(net(page).locator(`[data-edge="card:ARO:1000>${id}"] .net-pill text`)).toHaveText(/^\d+\.\d%$/);
      }
      expect(q.y + q.height).toBeLessThanOrEqual((await node(page, "ncbi:WP_1.1").locator(".net-hit").boundingBox())!.y);
      for (const pill of await page.locator("[data-expand] .net-expand-hit").all()) {
        const b = (await pill.boundingBox())!;
        expect(b.width).toBeGreaterThanOrEqual(44);
        expect(b.height).toBeGreaterThanOrEqual(44);
      }
    });

    test("the cues are the same words as in the list: Best, Highest identity shown, Below 90%", async ({ page }) => {
      await page.goto("./");
      await search(page, "card:ARO:1000");
      await page.getByLabel("Minimum identity").fill("80");
      expect(await text(node(page, "resfinder:blaXlow"))).toBe("ResFinder | blaXlow | blaXlow | 85.0% · OWH | Below 90%");
      await expect(node(page, "resfinder:blaXlow").locator(".net-ribbon")).toHaveAttribute("data-cue", "below");
      expect(await text(node(page, "ncbi:WP_1.1"))).toBe("NCBI | blaX-1 | WP_1.1 | 97.0% · RBH | Best");
      expect(await text(node(page, "ncbi:WP_3.1"))).toBe("NCBI | blaX-2 | WP_3.1 | 97.0% · OWH | Best"); // a tie: both best
      expect(await text(node(page, "ncbi:WP_4.1"))).toBe("NCBI | tetM-like | WP_4.1 | 90.0% · OWH"); // exactly at the line, not best
      await search(page, "card:ARO:2000");
      await page.getByLabel("Minimum identity").fill("80");
      expect(await text(node(page, "resfinder:tetM"))).toBe("ResFinder | tetM | tetM | 88.0% · OWH | Highest identity shown");
      expect(await text(node(page, "ncbi:WP_4.1"))).toBe("NCBI | tetM-like | WP_4.1 | 92.0% · RBH | Best");
      await expect(net(page)).not.toContainText("best (weak");
    });

    test("expand and collapse: the step-2 node sits indented right under its match, dashed, labelled, never in the list; the caption says it is not a match of the query", async ({ page }) => {
      await page.goto("./");
      await search(page, "card:ARO:1000");
      const listBefore = await page.locator("[data-match]").evaluateAll((els) => els.map((e) => e.getAttribute("data-match")));
      await page.getByRole("button", { name: "Expand matches of tetM-like (1)" }).click();
      const s2 = net(page).locator('g[data-role="step2"]');
      await expect(s2).toHaveCount(1);
      // the second line is cut to the chip's limit (shorter on a 360 px phone: the full text is in the tooltip and in the label)
      expect(await text(s2)).toBe(width === 390 ? "CARD | tet(M) | match of tetM-like | 92.0% · RBH" : "CARD | tet(M) | match of tet… | 92.0% · RBH");
      await expect(s2).toHaveAttribute("aria-label", /Match of tetM-like \(ncbi:WP_4.1\), not a match of the query/);
      await expect(s2).toHaveAttribute("data-via", "ncbi:WP_4.1");
      const [parent, child, next] = await Promise.all([node(page, "ncbi:WP_4.1"), s2, node(page, "resfinder:blaX")].map(async (l) => (await l.locator(".net-hit").boundingBox())!));
      expect(child.y).toBeGreaterThanOrEqual(parent.y + parent.height); // directly under
      expect(child.x).toBeGreaterThan(parent.x); // indented
      expect(next.y).toBeGreaterThanOrEqual(child.y + child.height); // and before the next match
      expect(await clipped(page)).toEqual([]);
      expect(await noSideScroll(page)).toBe(true);
      await expect(page.getByTestId("network-step2-note")).toContainText("A match of a match is not a match of the query");
      await expect(page.locator('[data-match="card:ARO:2000"]')).toHaveCount(0);
      expect(await page.locator("[data-match]").evaluateAll((els) => els.map((e) => e.getAttribute("data-match")))).toEqual(listBefore);
      await expect(net(page).locator('[data-edge="ncbi:WP_4.1>card:ARO:2000"] .net-pill')).toHaveCount(0);
      await page.getByRole("button", { name: "Collapse matches of tetM-like (1)" }).click();
      await expect(net(page).locator('g[data-role="step2"]')).toHaveCount(0);
      await expect(net(page).locator("g[data-node]")).toHaveCount(5);
      await expect(page.getByTestId("network-step2-note")).toHaveCount(0);
    });

    test("click navigation: a node becomes the query, one history entry each, Back and Forward step through", async ({ page }) => {
      await page.goto("./");
      await search(page, "card:ARO:1000");
      const len = () => page.evaluate(() => history.length);
      const start = await len();
      await node(page, "ncbi:WP_4.1").click();
      await expect(page.locator("[data-query]")).toHaveAttribute("data-query", "ncbi:WP_4.1");
      expect(await len()).toBe(start + 1);
      await expect(node(page, "ncbi:WP_4.1")).toHaveAttribute("data-role", "query");
      await expect(net(page).locator("g[data-node]")).toHaveCount(2);
      expect(await noSideScroll(page)).toBe(true);
      await page.goBack();
      await expect(page.locator("[data-query]")).toHaveAttribute("data-query", "card:ARO:1000");
      await expect(net(page).locator("g[data-node]")).toHaveCount(5);
      await page.goForward();
      await expect(page.locator("[data-query]")).toHaveAttribute("data-query", "ncbi:WP_4.1");
      await expect(page.getByLabel("Entry id")).toHaveValue("ncbi:WP_4.1");
    });

    test("keyboard: Tab goes through the picture from top to bottom, each match followed by its pill and its own step-2 nodes", async ({ page }) => {
      await page.goto("./");
      await search(page, "card:ARO:1000");
      await page.getByLabel("Minimum identity").fill("80");
      await page.getByRole("button", { name: "Expand matches of tetM-like (1)" }).click();
      await page.getByLabel("Minimum identity").focus();
      const seen: { id: string; y: number }[] = [];
      for (let i = 0; i < 30 && seen.length < 9; i++) {
        await page.keyboard.press("Tab");
        const info = await page.evaluate(() => {
          const el = document.activeElement as Element;
          const id = el.getAttribute("data-node") ?? (el.hasAttribute("data-expand") ? `expand ${el.getAttribute("data-expand")}` : null);
          return id ? { id, y: el.getBoundingClientRect().top + window.scrollY } : null;
        });
        if (info) seen.push(info);
      }
      expect(seen.map((s) => s.id)).toEqual([
        "card:ARO:1000",
        "ncbi:WP_1.1",
        "ncbi:WP_3.1",
        "ncbi:WP_4.1",
        "expand ncbi:WP_4.1",
        "card:ARO:2000", // its own step-2 node, directly under it
        "resfinder:blaX",
        "resfinder:blaXlow",
      ]);
      for (let i = 1; i < seen.length; i++) expect(seen[i]!.y, `${seen[i]!.id} is not above ${seen[i - 1]!.id}`).toBeGreaterThanOrEqual(seen[i - 1]!.y - 0.5);
    });

    test("tooltip on keyboard focus stays inside the picture and carries the full id; the card is the touch route to it", async ({ page }) => {
      await page.goto("./");
      await search(page, "card:ARO:1000");
      await page.mouse.move(0, 0);
      for (const id of ["ncbi:WP_1.1", "resfinder:blaX", "ncbi:WP_4.1"]) {
        await keyFocus(page, node(page, id));
        const tip = page.getByRole("tooltip");
        await expect(tip.locator("[data-line]").first()).toHaveText(id);
        const [t, w] = [(await tip.boundingBox())!, (await page.locator(".net-wrap").boundingBox())!];
        expect(t.x).toBeGreaterThanOrEqual(w.x - 1);
        expect(t.x + t.width).toBeLessThanOrEqual(w.x + w.width + 1);
        expect(t.y).toBeGreaterThanOrEqual(w.y - 1);
        expect(t.y + t.height).toBeLessThanOrEqual(w.y + w.height + 1);
        await expect(tip).toContainText("Tap or press Enter to make this the query");
        await expect(tip).toContainText("Its full id is on its card in the list below");
        await expect(page.locator(`[data-match="${id}"]`)).toContainText(id.split(":")[1]!); // and it is
      }
    });

    test("highlight sync: hovering a node lights its card and its edge, and a card lights its node", async ({ page }) => {
      await page.goto("./");
      await search(page, "card:ARO:1000");
      await node(page, "ncbi:WP_3.1").hover();
      await expect(page.locator('[data-match="ncbi:WP_3.1"]')).toHaveAttribute("data-hl", "true");
      await expect(net(page).locator('[data-edge="card:ARO:1000>ncbi:WP_3.1"]')).toHaveClass(/is-hl/);
      await page.mouse.move(0, 0);
      await page.locator('[data-match="resfinder:blaX"]').hover();
      await expect(node(page, "resfinder:blaX")).toHaveClass(/is-hl/);
    });
  });
}

test.describe("the breakpoint", () => {
  test("portrait below a 640 px box, landscape from it, tested on both sides", async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 800 });
    await page.goto("./");
    await search(page, "card:ARO:1000");
    // The page's gutters change at 640 px (Tailwind sm), so the viewport that gives a box of exactly `box` is found by measuring.
    const fit = async (box: number) => {
      let v = box + 50;
      for (let i = 0; i < 4; i++) {
        await page.setViewportSize({ width: v, height: 800 });
        const got = Math.round(await wrapWidth(page));
        if (got === box) return;
        v += box - got;
      }
      throw new Error(`no viewport gives a box of ${box}`);
    };
    for (const [box, orientation] of [[639, "portrait"], [640, "landscape"], [641, "landscape"], [420, "portrait"]] as const) {
      await fit(box);
      await expect(page.locator(".net-scroll")).toHaveAttribute("data-orientation", orientation);
    }
  });

  test("a window resize changes the drawing without a reload and keeps the query and the expansion", async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 800 });
    await page.goto("./");
    await search(page, "card:ARO:1000");
    await page.getByRole("button", { name: "Expand matches of tetM-like (1)" }).click();
    await expect(page.locator(".net-scroll")).toHaveAttribute("data-orientation", "landscape");
    await expect(net(page).locator(".net-head")).toHaveCount(3);
    await page.setViewportSize({ width: 390, height: 800 });
    await expect(page.locator(".net-scroll")).toHaveAttribute("data-orientation", "portrait");
    await expect(net(page).locator(".net-head")).toHaveCount(0);
    await expect(net(page).locator('g[data-role="step2"]')).toHaveCount(1); // still expanded
    await expect(page.locator("[data-query]")).toHaveAttribute("data-query", "card:ARO:1000");
    expect(await clipped(page)).toEqual([]);
    await page.setViewportSize({ width: 1000, height: 800 });
    await expect(page.locator(".net-scroll")).toHaveAttribute("data-orientation", "landscape");
  });

  test("1000 px stays landscape: three column headings, the keyboard scroll region, the design width", async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 800 });
    await page.goto("./");
    await search(page, "card:ARO:1000");
    await expect(net(page).locator(".net-head")).toHaveText(["Query", "Matches of the query"]);
    const box = page.getByRole("region", { name: /Network picture/ });
    await expect(box).toHaveAttribute("tabindex", "0");
    const viewBox = (await net(page).getAttribute("viewBox"))!.split(" ").map(Number);
    expect(viewBox[2]).toBe(644);
  });

  test("a narrow rail at 1152 px or more stays landscape (the rail is 656 px wide or more)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("./");
    await search(page, "card:ARO:1000");
    expect(await wrapWidth(page)).toBeGreaterThanOrEqual(640);
    await expect(page.locator(".net-scroll")).toHaveAttribute("data-orientation", "landscape");
  });
});

// A phone taps: a tap on a chip makes it the query (the tooltip cannot be the way to its full id, the card is), a tap on a pill expands.
test.describe("touch at 390 px", () => {
  test.use({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" });
  test("tap a pill to expand, tap a step-2 chip to make it the query", async ({ page }) => {
    await page.goto("./");
    await search(page, "card:ARO:1000");
    await page.getByRole("button", { name: "Expand matches of tetM-like (1)" }).tap();
    await expect(net(page).locator('g[data-role="step2"]')).toHaveCount(1);
    expect(await clipped(page)).toEqual([]);
    await node(page, "card:ARO:2000").tap(); // a step-2 node: it becomes the query, and its panel shows its full id
    await expect(page.locator("[data-query]")).toHaveAttribute("data-query", "card:ARO:2000");
    await expect(page.locator("[data-query]")).toContainText("ARO:2000");
    await expect(node(page, "card:ARO:2000")).toHaveAttribute("data-role", "query");
  });
});
