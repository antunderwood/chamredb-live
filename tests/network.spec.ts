import { readFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { contrast } from "../src/contrast";
import { buildNetwork } from "../src/networkModel";
import { tooltip } from "../src/networkTooltip";
import { buildIndex } from "../src/parse";
import type { ReleaseGraph } from "../src/types";

// The interactive network picture (tickets #9 and #10). Expected values: tests/fixtures/README.md (worked by hand).
// card:ARO:1000 shows 4 matches at 90% (ncbi WP_1.1 RBH, WP_3.1 OWH, WP_4.1 OWH, resfinder blaX RBH) and 5 at 80%
// (adds blaXlow, OWH, 85%). card:ARO:2000 shows 1 at 90% (WP_4.1 RBH) and 2 at 80% (adds tetM, OWH, 88%, a group
// whose top identity is below 90%). The only fixture entry with matches of its own (besides the query) is WP_4.1,
// which lists card:ARO:2000 (0.92, RBH): expanding it adds one step-2 node.
const fixture = buildIndex(JSON.parse(readFileSync("tests/fixtures/graph.json", "utf8")) as ReleaseGraph);

async function search(page: Page, id: string) {
  await page.getByLabel("Entry id").fill(id);
  await page.getByRole("button", { name: "Search" }).click();
}
const net = (page: Page) => page.getByTestId("network");
const node = (page: Page, id: string) => net(page).locator(`g[data-node="${id}"]`);
// Keyboard focus as a user would make it: a key press first, so the browser treats the focus as keyboard focus (:focus-visible).
// A pointer click or a bare programmatic focus deliberately does not drive the tooltip.
const keyFocus = async (page: Page, l: Locator) => {
  await page.keyboard.press("Shift");
  await l.focus();
};
const text = (l: Locator) => l.locator("text").allTextContents().then((t) => t.join(" | "));
const hex = (rgb: string) => "#" + (rgb.match(/\d+/g) ?? []).slice(0, 3).map((n) => Number(n).toString(16).padStart(2, "0")).join("");
const css = (l: Locator, prop: string) => l.first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

test("one node and one step-1 edge per shown match at 90%, 80% and 98%, equal to the list", async ({ page }) => {
  await page.goto("./");
  await search(page, "card:ARO:1000");
  const edges = net(page).locator('[data-edge][data-step="1"]');
  await expect(edges).toHaveCount(4);
  await expect(net(page).locator("g[data-node]")).toHaveCount(5); // 4 matches and the query
  await page.getByLabel("Minimum identity").fill("80");
  await expect(edges).toHaveCount(5);
  await expect(net(page).locator("g[data-node]")).toHaveCount(6);
  await page.getByLabel("Minimum identity").fill("98"); // only blaX (100%) is left
  await expect(edges).toHaveCount(1);
  await expect(page.locator("[data-match]")).toHaveCount(1);
  // the set of ids drawn equals the set of cards
  await page.getByLabel("Minimum identity").fill("80");
  const drawn = await net(page).locator('g[data-role="match"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-node")).sort());
  const listed = await page.locator("[data-match]").evaluateAll((els) => els.map((e) => e.getAttribute("data-match")).sort());
  expect(drawn).toEqual(listed);
});

test("dashed is OWH, solid is RBH, with arrowheads showing direction; the picture never implies a reverse hit for a one-way match", async ({ page }) => {
  await page.goto("./");
  await search(page, "card:ARO:1000");
  const edge = (id: string) => net(page).locator(`[data-edge="card:ARO:1000>${id}"]`);
  const dash = (id: string) => edge(id).locator("path").evaluate((el) => getComputedStyle(el).strokeDasharray);
  await expect(edge("ncbi:WP_1.1")).toHaveAttribute("data-type", "RBH");
  expect(await dash("ncbi:WP_1.1")).toBe("none");
  await expect(edge("ncbi:WP_1.1").locator("path")).toHaveAttribute("marker-start", /net-arrow/); // reciprocal: both ends
  await expect(edge("ncbi:WP_1.1").locator("path")).toHaveAttribute("marker-end", /net-arrow/);
  await expect(edge("ncbi:WP_3.1")).toHaveAttribute("data-type", "OWH");
  expect(await dash("ncbi:WP_3.1")).not.toBe("none");
  await expect(edge("ncbi:WP_3.1").locator("path")).not.toHaveAttribute("marker-start", /.+/); // one-way: arrow at the match only
  await expect(edge("ncbi:WP_3.1").locator("path")).toHaveAttribute("marker-end", /net-arrow/);
  await expect(edge("resfinder:blaX")).toHaveAttribute("data-type", "RBH");
  await expect(edge("ncbi:WP_3.1")).toHaveAttribute("aria-hidden", "true"); // the nodes and the list carry the text
});

test("labels in the picture agree with the list: identity, type and Best", async ({ page }) => {
  await page.goto("./");
  await search(page, "card:ARO:1000");
  expect(await text(node(page, "ncbi:WP_1.1"))).toBe("NCBI | blaX-1 | WP_1.1 | 97.0% · RBH | Best");
  expect(await text(node(page, "ncbi:WP_3.1"))).toBe("NCBI | blaX-2 | WP_3.1 | 97.0% · OWH | Best"); // tie: both best, as in the list
  expect(await text(node(page, "ncbi:WP_4.1"))).toBe("NCBI | tetM-like | WP_4.1 | 90.0% · OWH"); // exactly at the threshold, not best
  expect(await text(node(page, "resfinder:blaX"))).toBe("ResFinder | blaX | blaX | 100.0% · RBH | Best");
  expect(await text(node(page, "card:ARO:1000"))).toBe("CARD | blaX | ARO:1000 | Query");
  // every list row has a node and an edge pill with the same identity, and the same type and best flag
  const items = await page.locator("[data-match]").all();
  expect(items.length).toBe(4);
  for (const li of items) {
    const id = (await li.getAttribute("data-match"))!;
    const pct = (await li.locator('[data-field="identity"] dd').textContent())!.match(/^(\d+\.\d%)/)![1]!;
    const type = (await li.locator("[data-type]").getAttribute("data-type"))!;
    const best = (await li.getAttribute("data-best")) === "best";
    await expect(node(page, id).locator(".net-detail")).toHaveText(`${pct} · ${type}`);
    await expect(net(page).locator(`[data-edge="card:ARO:1000>${id}"] .net-pill text`)).toHaveText(pct);
    if (best) await expect(node(page, id)).toHaveAttribute("data-best", "best");
    else await expect(node(page, id)).not.toHaveAttribute("data-best", /.+/);
    await expect(node(page, id).locator(".net-ribbon")).toHaveCount(best ? 1 : 0);
  }
  // accessible names
  await expect(node(page, "ncbi:WP_1.1")).toHaveAttribute("aria-label", /blaX-1, ncbi, ncbi:WP_1.1\. identity 97\.0%, reciprocal best hit, best\. Press Enter/);
  await expect(node(page, "card:ARO:1000")).toHaveAttribute("aria-label", "blaX, card, card:ARO:1000. The query.");
});

test("a weak group says 'Highest identity shown', not 'best', in the picture as in the list", async ({ page }) => {
  await page.goto("./");
  await search(page, "card:ARO:2000");
  await expect(net(page).locator('[data-edge][data-step="1"]')).toHaveCount(1);
  await page.getByLabel("Minimum identity").fill("80");
  await expect(net(page).locator('[data-edge][data-step="1"]')).toHaveCount(2);
  expect(await text(node(page, "resfinder:tetM"))).toBe("ResFinder | tetM | tetM | 88.0% · OWH | Highest identity shown");
  await expect(node(page, "resfinder:tetM")).toHaveAttribute("data-best", "highest");
  expect(await text(node(page, "ncbi:WP_4.1"))).toBe("NCBI | tetM-like | WP_4.1 | 92.0% · RBH | Best");
  await expect(page.locator('[data-match="resfinder:tetM"]')).toContainText("Highest identity shown");
  await expect(net(page)).not.toContainText("best (weak"); // never the word best for a weak group
  await expect(node(page, "resfinder:tetM").locator(".net-ribbon")).not.toContainText("Best");
});

test("the database is carried by shape and badge text, not by colour alone", async ({ page }) => {
  await page.goto("./");
  await search(page, "card:ARO:1000");
  const shape = async (id: string) => [await node(page, id).getAttribute("data-shape"), await node(page, id).locator(".net-shape").getAttribute("d")];
  const [round, cut, pill] = [await shape("card:ARO:1000"), await shape("ncbi:WP_1.1"), await shape("resfinder:blaX")];
  expect(round[0]).toBe("round");
  expect(cut[0]).toBe("cut");
  expect(pill[0]).toBe("pill");
  expect(new Set([round[1], cut[1], pill[1]]).size).toBe(3);
  expect(round[1]).toContain("Q"); // curves
  expect(cut[1]).toContain("L");
  expect(pill[1]).toContain("A");
  await expect(node(page, "ncbi:WP_1.1").locator(".net-badge-text")).toHaveText("NCBI");
  await expect(page.getByRole("list", { name: "Legend" })).toContainText("NCBI (cut corners)");
  expect(await page.getByRole("list", { name: "Legend" }).locator("svg").count()).toBeGreaterThanOrEqual(6); // real swatches
});

test("no matches draws nothing", async ({ page }) => {
  await page.goto("./");
  await search(page, "resfinder:orphan");
  await expect(net(page)).toHaveCount(0);
});

test("phone width: the page does not scroll sideways, the figure keeps its design width in its own keyboard-scrollable box", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("./");
  await search(page, "card:ARO:1000");
  await expect(net(page)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const box = page.getByRole("region", { name: /Network picture/ });
  await expect(box).toHaveAttribute("tabindex", "0");
  expect(await box.evaluate((el) => getComputedStyle(el).overflowX)).toBe("auto");
  const [client, scroll] = await box.evaluate((el) => [el.clientWidth, el.scrollWidth]);
  expect(scroll).toBeGreaterThan(client);
  // not scaled down: 1 viewBox unit is 1 CSS pixel, so a chip is at least 44 px high
  const viewBox = (await net(page).getAttribute("viewBox"))!.split(" ").map(Number);
  expect((await net(page).boundingBox())!.width).toBeCloseTo(viewBox[2]!, 0);
  expect((await node(page, "ncbi:WP_1.1").locator(".net-hit").boundingBox())!.height).toBeGreaterThanOrEqual(44);
  // the box scrolls by keyboard
  await box.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => box.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0); // arrow scrolling is animated
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
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

for (const scheme of ["light", "dark"] as const) {
  test(`${scheme}: text and marks of the picture pass the contrast thresholds (4.5:1 text, 3:1 marks)`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.goto("./");
    await search(page, "card:ARO:1000");
    await page.getByLabel("Minimum identity").fill("80");
    await page.locator('[data-expand="ncbi:WP_4.1"]').click(); // adds a dashed step-2 chip
    const panel = hex(await css(page.getByTestId("network-section"), "background-color"));
    const surface = hex(await css(page.locator("body"), "background-color")); // only to prove it differs from the panel
    expect(panel).not.toBe(surface);
    const fillOf = async (l: Locator) => hex(await css(l, "fill"));
    const checked: string[] = [];
    const text = async (sel: Locator, bg: string, what: string) => {
      const n = await sel.count();
      expect(n, what).toBeGreaterThan(0);
      for (let i = 0; i < n; i++) {
        const fg = hex(await css(sel.nth(i), "fill"));
        expect(contrast(fg, bg), `${what} ${i}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
      checked.push(what);
    };
    for (const id of ["card:ARO:1000", "ncbi:WP_1.1", "ncbi:WP_4.1", "resfinder:blaX", "card:ARO:2000", "resfinder:blaXlow"]) {
      const g = node(page, id);
      const shape = await fillOf(g.locator(".net-shape"));
      for (const cls of [".net-name", ".net-sub", ".net-detail"]) await text(g.locator(cls), shape, `${id} ${cls}`);
      await text(g.locator(".net-badge-text"), await fillOf(g.locator(".net-badge")), `${id} badge`);
      const stroke = hex(await css(g.locator(".net-shape"), "stroke"));
      expect(contrast(stroke, panel), `${id} outline`).toBeGreaterThanOrEqual(3);
      const rib = g.locator(".net-ribbon text");
      if (await rib.count()) await text(rib, await fillOf(g.locator(".net-ribbon rect")), `${id} ribbon`);
    }
    await text(net(page).locator(".net-pill text").first(), await fillOf(net(page).locator(".net-pill rect").first()), "identity pill");
    await text(net(page).locator(".net-head"), panel, "column headings");
    await text(page.locator('[data-expand] text').first(), await fillOf(page.locator("[data-expand] .net-expand-pill").first()), "expand pill");
    for (const [sel, what] of [['[data-edge][data-step="1"] path', "step-1 edge"], ['[data-edge][data-step="2"] path', "step-2 edge"]] as const) {
      expect(contrast(hex(await css(net(page).locator(sel), "stroke")), panel), what).toBeGreaterThanOrEqual(3);
    }
    expect(contrast(hex(await css(page.locator("[data-expand] .net-expand-pill").first(), "stroke")), panel)).toBeGreaterThanOrEqual(3);
    expect(checked.length).toBeGreaterThan(20);
  });
}

test("keyboard only: Tab to a node, Enter makes it the query; the card, picture and address agree; Back returns", async ({ page }) => {
  await page.goto("./");
  await search(page, "card:ARO:1000");
  await expect(page.locator("[data-match]")).toHaveCount(4);
  await page.getByLabel("Minimum identity").focus();
  let guard = 0;
  while (!(await page.evaluate(() => document.activeElement?.getAttribute("data-node"))) && guard++ < 8) await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toHaveAttribute("data-role", "query"); // the query is the first node in the Tab order
  await page.keyboard.press("Tab"); // WP_1.1 (the first match)
  await expect(page.locator(":focus")).toHaveAttribute("data-node", "ncbi:WP_1.1");
  await page.keyboard.press("Tab"); // WP_1.1 has no matches of its own beyond the query: no pill, next node is WP_3.1
  await page.keyboard.press("Tab"); // WP_4.1
  await expect(page.locator(":focus")).toHaveAttribute("data-node", "ncbi:WP_4.1");
  const before = await page.evaluate(() => history.length);
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-query]")).toHaveAttribute("data-query", "ncbi:WP_4.1");
  expect(await page.evaluate(() => history.length)).toBe(before + 1); // pushState: one entry per node
  expect(await page.evaluate(() => location.hash)).toContain("q=ncbi%3AWP_4.1");
  await expect(page.getByLabel("Entry id")).toHaveValue("ncbi:WP_4.1");
  await expect(node(page, "ncbi:WP_4.1")).toHaveAttribute("data-role", "query"); // the picture agrees
  await expect(page.locator(":focus")).toHaveAttribute("data-role", "query"); // focus stays in the picture, on the new query
  await expect(page.locator("[data-match]")).toHaveCount(1); // WP_4.1 has one match at 90%: card:ARO:2000
  await expect(page.locator('[data-match="card:ARO:2000"]')).toBeVisible();
  await expect(net(page).locator("g[data-node]")).toHaveCount(2);
  // Back restores the previous entry in the card, the picture and the address
  await page.goBack();
  await expect(page.locator("[data-query]")).toHaveAttribute("data-query", "card:ARO:1000");
  await expect(page.locator("[data-match]")).toHaveCount(4);
  await expect(node(page, "card:ARO:1000")).toHaveAttribute("data-role", "query");
  await expect(net(page).locator("g[data-node]")).toHaveCount(5);
  expect(await page.evaluate(() => location.hash)).toContain("q=card%3AARO%3A1000");
  await expect(page.getByLabel("Entry id")).toHaveValue("card:ARO:1000");
  await page.goForward();
  await expect(page.locator("[data-query]")).toHaveAttribute("data-query", "ncbi:WP_4.1");
});

test("click navigation: Back and Forward step through the explored entries; the slider and the filter do not add history", async ({ page }) => {
  await page.goto("./");
  await search(page, "card:ARO:1000");
  const len = () => page.evaluate(() => history.length);
  const start = await len();
  await page.getByLabel("Minimum identity").fill("85"); // replaceState
  await page.getByLabel("Search in database").selectOption("card"); // replaceState
  expect(await len()).toBe(start);
  await page.getByLabel("Search in database").selectOption(""); // all databases
  await node(page, "resfinder:blaX").click();
  await expect(page.locator("[data-query]")).toHaveAttribute("data-query", "resfinder:blaX");
  expect(await len()).toBe(start + 1);
  expect(await page.evaluate(() => location.hash)).toContain("min=85"); // the slider value is kept
  await expect(page.getByLabel("Minimum identity")).toHaveValue("85");
  await node(page, "card:ARO:1000").click(); // blaX lists the query back (RBH)
  await expect(page.locator("[data-query]")).toHaveAttribute("data-query", "card:ARO:1000");
  expect(await len()).toBe(start + 2);
  await page.goBack();
  await expect(page.locator("[data-query]")).toHaveAttribute("data-query", "resfinder:blaX");
  await page.goBack();
  await expect(page.locator("[data-query]")).toHaveAttribute("data-query", "card:ARO:1000");
  await page.goForward();
  await expect(page.locator("[data-query]")).toHaveAttribute("data-query", "resfinder:blaX");
  // the query node itself does nothing
  const here = await len();
  await node(page, "resfinder:blaX").click({ force: true }); // aria-disabled, so Playwright would wait forever
  expect(await len()).toBe(here);
});

test("a database filter that would hide the clicked entry is cleared", async ({ page }) => {
  await page.goto("./");
  await page.getByLabel("Search in database").selectOption("card");
  await search(page, "card:ARO:1000");
  await node(page, "ncbi:WP_1.1").click();
  await expect(page.locator("[data-query]")).toHaveAttribute("data-query", "ncbi:WP_1.1");
  await expect(page.getByLabel("Search in database")).toHaveValue("");
});

for (const how of ["hover", "focus"] as const) {
  test(`${how}: the tooltip shows the model's lines, is described by role, flips inside the figure and Escape dismisses it`, async ({ page }) => {
    await page.goto("./");
    await search(page, "card:ARO:1000");
    for (const id of ["ncbi:WP_4.1", "ncbi:WP_1.1", "card:ARO:1000", "resfinder:blaX"]) {
      if (how === "hover") await node(page, id).hover();
      else await keyFocus(page, node(page, id));
      const tip = page.getByRole("tooltip");
      await expect(tip).toBeVisible();
      const n = buildNetwork(fixture, "card:ARO:1000", 0.9).nodes.find((x) => x.id === id)!;
      const expected = tooltip(n, fixture.entries[id]!).lines;
      await expect(tip.locator("[data-line]")).toHaveText(expected); // retries until the tooltip is the one for this node
      await expect(node(page, id)).toHaveAttribute("aria-describedby", "net-tip");
      const [t, w] = [(await tip.boundingBox())!, (await page.locator(".net-wrap").boundingBox())!];
      expect(t.x).toBeGreaterThanOrEqual(w.x - 1);
      expect(t.y).toBeGreaterThanOrEqual(w.y - 1);
      expect(t.x + t.width).toBeLessThanOrEqual(w.x + w.width + 1);
      expect(t.y + t.height).toBeLessThanOrEqual(w.y + w.height + 1);
      const c = (await node(page, id).locator(".net-hit").boundingBox())!;
      const overlap = Math.min(t.x + t.width, c.x + c.width) > Math.max(t.x, c.x) && Math.min(t.y + t.height, c.y + c.height) > Math.max(t.y, c.y);
      expect(overlap, `the tooltip does not cover ${id}`).toBe(false);
    }
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
  });
}

test("the tooltip of a match lists id, name, database, identity, coverage, type and phenotype (fixture, worked by hand)", async ({ page }) => {
  await page.goto("./");
  await search(page, "card:ARO:2000");
  await node(page, "ncbi:WP_4.1").hover();
  const lines = await page.getByRole("tooltip").locator("[data-line]").allTextContents();
  expect(lines.slice(0, 6)).toEqual(["ncbi:WP_4.1", "tetM-like", "Database: ncbi", "Identity: 92.0%", "Coverage: 105.0%", "Type: Reciprocal best hit"]); // coverage 1.05 in the fixture
  expect(lines).toContain("best");
});

test("highlight sync both ways: a node lights its card and edges; a card lights its node", async ({ page }) => {
  await page.goto("./");
  await search(page, "card:ARO:1000");
  await node(page, "ncbi:WP_3.1").hover();
  await expect(page.locator('[data-match="ncbi:WP_3.1"]')).toHaveAttribute("data-hl", "true");
  await expect(page.locator('[data-match="ncbi:WP_1.1"]')).not.toHaveAttribute("data-hl", "true");
  await expect(net(page).locator('[data-edge="card:ARO:1000>ncbi:WP_3.1"]')).toHaveClass(/is-hl/);
  await expect(net(page).locator('[data-edge="card:ARO:1000>ncbi:WP_1.1"]')).not.toHaveClass(/is-hl/);
  await expect(node(page, "ncbi:WP_3.1")).toHaveClass(/is-hl/);
  await page.mouse.move(0, 0);
  await expect(page.locator("[data-hl]")).toHaveCount(0);
  await page.locator('[data-match="resfinder:blaX"]').hover();
  await expect(node(page, "resfinder:blaX")).toHaveClass(/is-hl/);
  await expect(net(page).locator('[data-edge="card:ARO:1000>resfinder:blaX"]')).toHaveClass(/is-hl/);
  await page.mouse.move(0, 0);
  // keyboard focus lights the card too
  await keyFocus(page, node(page, "ncbi:WP_1.1"));
  await expect(page.locator('[data-match="ncbi:WP_1.1"]')).toHaveAttribute("data-hl", "true");
});

test("pairing by keyboard: L on a node moves focus to its card; Show in network on a card moves focus to its node", async ({ page }) => {
  await page.goto("./");
  await search(page, "card:ARO:1000");
  await keyFocus(page, node(page, "resfinder:blaX"));
  await page.keyboard.press("l");
  await expect(page.locator('[data-match="resfinder:blaX"]')).toBeFocused();
  await page.locator('[data-match="ncbi:WP_4.1"] [data-action="show-in-network"]').click();
  await expect(node(page, "ncbi:WP_4.1")).toBeFocused();
  await expect(page.getByRole("tooltip")).toBeVisible();
});

test("prefers-reduced-motion: no entrance animation; otherwise there is one", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  await search(page, "card:ARO:1000");
  for (const sel of [".net-node", ".net-edge", ".net-expand"]) expect(await css(net(page).locator(sel), "animation-name"), sel).toBe("none");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  expect(await css(net(page).locator(".net-node"), "animation-name")).toBe("net-rise");
});

// ---- ticket #10: expanding a node ----
test("expand and collapse: a step-2 node is dashed, labelled 'match of X', in its own column, and never in the list", async ({ page }) => {
  await page.goto("./");
  await search(page, "card:ARO:1000");
  const listBefore = await page.locator("[data-match]").evaluateAll((els) => els.map((e) => e.getAttribute("data-match")));
  const pill = page.getByRole("button", { name: "Expand matches of tetM-like (1)" });
  await expect(pill).toHaveAttribute("aria-expanded", "false");
  await expect(pill).toHaveText("+1");
  await expect(page.getByRole("button", { name: /Expand matches of blaX/ })).toHaveCount(0); // blaX lists only the query: nothing to expand
  await expect(net(page).locator(".net-head")).toHaveText(["Query", "Matches of the query"]);
  await expect(page.getByTestId("network-step2-note")).toHaveCount(0);
  await pill.click();
  const collapse = page.getByRole("button", { name: "Collapse matches of tetM-like (1)" });
  await expect(collapse).toHaveAttribute("aria-expanded", "true");
  const s2 = net(page).locator('g[data-role="step2"]');
  await expect(s2).toHaveCount(1);
  await expect(s2).toHaveAttribute("data-node", "card:ARO:2000");
  await expect(s2).toHaveAttribute("data-via", "ncbi:WP_4.1");
  expect(await text(s2)).toBe("CARD | tet(M) | match of tetM-like | 92.0% · RBH");
  expect(await css(s2.locator(".net-shape"), "stroke-dasharray")).not.toBe("none"); // dashed outline
  await expect(net(page).locator(".net-head")).toHaveText(["Query", "Matches of the query", "Matches of a match"]);
  await expect(page.getByTestId("network-step2-note")).toContainText("A match of a match is not a match of the query");
  // the step-2 edge: no identity label on it
  const e2 = net(page).locator('[data-edge="ncbi:WP_4.1>card:ARO:2000"]');
  await expect(e2).toHaveAttribute("data-step", "2");
  await expect(e2.locator(".net-pill")).toHaveCount(0);
  await expect(net(page).locator('[data-edge][data-step="2"] text')).toHaveCount(0);
  // WP_4.1 does not list the query, so no reverse hit exists here (hiding the reverse of an RBH is covered by visibleEdges)
  await expect(net(page).locator('[data-edge="ncbi:WP_4.1>card:ARO:1000"]')).toHaveCount(0);
  await expect(page.getByTestId("network-step2-note")).not.toContainText("reverse");
  // the card list is unchanged by expansion, and the step-2 entry has no card
  expect(await page.locator("[data-match]").evaluateAll((els) => els.map((e) => e.getAttribute("data-match")))).toEqual(listBefore);
  await expect(page.locator('[data-match="card:ARO:2000"]')).toHaveCount(0);
  await expect(s2).toHaveAttribute("aria-label", /Match of tetM-like \(ncbi:WP_4.1\), not a match of the query/);
  // tooltip of a step-2 node says whose match it is
  await s2.hover();
  const lines = await page.getByRole("tooltip").locator("[data-line]").allTextContents();
  expect(lines).toContain("match of ncbi:WP_4.1");
  expect(lines.some((l) => l.startsWith("identity, coverage and best are relative to ncbi:WP_4.1, not to the query"))).toBe(true);
  // collapse restores the one-step picture
  await collapse.click();
  await expect(net(page).locator('g[data-role="step2"]')).toHaveCount(0);
  await expect(net(page).locator("g[data-node]")).toHaveCount(5);
  await expect(page.getByTestId("network-step2-note")).toHaveCount(0);
  await expect(net(page).locator(".net-head")).toHaveCount(2);
});

test("expansion is not in the address and resets when the query changes; clicking a step-2 node makes it the query", async ({ page }) => {
  await page.goto("./");
  await search(page, "card:ARO:1000");
  const hash = await page.evaluate(() => location.hash);
  await page.locator('[data-expand="ncbi:WP_4.1"]').click();
  expect(await page.evaluate(() => location.hash)).toBe(hash);
  await node(page, "card:ARO:2000").click(); // a step-2 node: navigation like any other
  await expect(page.locator("[data-query]")).toHaveAttribute("data-query", "card:ARO:2000");
  await expect(net(page).locator('g[data-role="step2"]')).toHaveCount(0); // reset
  await page.goBack();
  await expect(page.locator("[data-query]")).toHaveAttribute("data-query", "card:ARO:1000");
  await expect(net(page).locator('g[data-role="step2"]')).toHaveCount(0); // not remembered either
});

test("keyboard only: the expand pill is its own Tab stop; Enter and Space expand and collapse; focus stays on it", async ({ page }) => {
  await page.goto("./");
  await search(page, "card:ARO:1000");
  await keyFocus(page, node(page, "ncbi:WP_4.1"));
  await page.keyboard.press("Tab");
  const pill = page.locator('[data-expand="ncbi:WP_4.1"]');
  await expect(pill).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(net(page).locator('g[data-role="step2"]')).toHaveCount(1);
  await expect(pill).toBeFocused();
  await expect(pill).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Space");
  await expect(net(page).locator('g[data-role="step2"]')).toHaveCount(0);
  await expect(pill).toHaveAttribute("aria-expanded", "false");
  await expect(pill).toBeFocused();
  // the pill is at least 44 by 44 and sits on the chip's right edge
  const hit = (await pill.locator(".net-expand-hit").boundingBox())!;
  expect(hit.width).toBeGreaterThanOrEqual(44);
  expect(hit.height).toBeGreaterThanOrEqual(44);
});

test("a match whose only match is the query has no expand control; the cap message is absent when nothing was dropped", async ({ page }) => {
  await page.goto("./");
  await search(page, "card:ARO:2000");
  await page.getByLabel("Minimum identity").fill("80");
  await expect(net(page).locator("g[data-node]")).toHaveCount(3);
  await expect(page.locator("[data-expand]")).toHaveCount(0); // WP_4.1 lists only the query; tetM lists nothing
  await expect(page.getByTestId("network-cap")).toHaveCount(0);
  // expansion uses the slider's minimum identity: card:ARO:1000 at 98% has only blaX, which lists only the query
  await search(page, "card:ARO:1000");
  await page.getByLabel("Minimum identity").fill("98");
  await expect(page.locator("[data-expand]")).toHaveCount(0);
});

test("a click does not pin the tooltip: it goes when the pointer leaves, and it is not driven by the click's focus", async ({ page }) => {
  await page.goto("./");
  await search(page, "card:ARO:1000");
  await node(page, "ncbi:WP_1.1").click();
  await expect(page.locator("[data-query]")).toHaveAttribute("data-query", "ncbi:WP_1.1");
  await page.mouse.move(2, 2); // well away from the figure
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await expect(page.locator('[data-hl="true"]')).toHaveCount(0);
});
