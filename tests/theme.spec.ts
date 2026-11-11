import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { readThemes, type Tokens } from "../src/contrast";

// Expected colours come from the token files on disk (public/theme.css, public/theme.bsb.css), not from the page.
const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};
const themes = (file: string) => readThemes(readFileSync(`public/${file}`, "utf8"));
const css = (page: Page, selector: string, prop: string) =>
  page.locator(selector).first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

async function search(page: Page, text: string) {
  await page.getByLabel("Entry id").fill(text);
  await page.getByRole("button", { name: "Search" }).click();
}

for (const scheme of ["light", "dark"] as const) {
  test(`${scheme}: every component takes its colours from the tokens`, async ({ page }) => {
    const t: Tokens = themes("theme.css")[scheme];
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("./");
    await expect(page.getByLabel("Entry id")).toBeEnabled();
    await search(page, "card:ARO:1000");
    await expect(page.getByTestId("network")).toBeVisible();

    expect(await css(page, "body", "background-color")).toBe(rgb(t["--bg"]));
    expect(await css(page, "h1", "color")).toBe(rgb(t["--fg"]));
    expect(await css(page, "h1 + p", "color")).toBe(rgb(t["--muted"])); // intro line
    // Controls: select, text input (the datalist input), Search button, slider.
    for (const sel of ["select", "input:not([type=range])"]) {
      expect(await css(page, sel, "background-color"), sel).toBe(rgb(t["--surface"]));
      expect(await css(page, sel, "border-top-color"), sel).toBe(rgb(t["--control-border"]));
    }
    expect(await css(page, "button[type=submit]", "background-color")).toBe(rgb(t["--accent"]));
    expect(await css(page, "button[type=submit]", "color")).toBe(rgb(t["--accent-fg"]));
    // Notice (role=note: demo data), result section, best badge, picture marks.
    expect(await css(page, '[role="note"]', "background-color")).toBe(rgb(t["--surface"]));
    expect(await css(page, 'section[aria-label="Matches in ncbi"] [data-match]', "background-color")).toBe(rgb(t["--panel"]));
    expect(await css(page, 'section[aria-label="Matches in ncbi"] [data-field="match-details"]', "background-color")).toBe(rgb(t["--surface"]));
    // Chips of the query panel and of a match panel.
    for (const [chip, token] of [["query", "--chip-query"], ["db", "--chip-db"], ["name", "--chip-name"]] as const) {
      expect(await css(page, `section[aria-label="Query entry"] [data-chip="${chip}"]`, "background-color"), chip).toBe(rgb(t[token]));
      expect(await css(page, `section[aria-label="Query entry"] [data-chip="${chip}"]`, "color"), chip).toBe(rgb(t["--chip-fg"]));
    }
    expect(await css(page, '[data-match] [data-chip="match"]', "background-color")).toBe(rgb(t["--chip-match"]));
    expect(await css(page, "strong", "background-color")).toBe(rgb(t["--accent"]));
    expect(await css(page, "strong", "color")).toBe(rgb(t["--accent-fg"]));
    const node = (id: string, part: string) => `[data-testid="network"] g[data-node="${id}"] ${part}`;
    expect(await css(page, node("ncbi:WP_1.1", ".net-badge"), "fill")).toBe(rgb(t["--db-ncbi"]));
    expect(await css(page, node("ncbi:WP_1.1", ".net-badge-text"), "fill")).toBe(rgb(t["--db-ncbi-fg"]));
    expect(await css(page, node("resfinder:blaX", ".net-badge"), "fill")).toBe(rgb(t["--db-resfinder"]));
    expect(await css(page, node("card:ARO:1000", ".net-badge"), "fill")).toBe(rgb(t["--db-card"]));
    expect(await css(page, node("ncbi:WP_4.1", ".net-shape"), "fill")).toBe(rgb(t["--surface"]));
    expect(await css(page, node("ncbi:WP_4.1", ".net-shape"), "stroke")).toBe(rgb(t["--db-ncbi"]));
    expect(await css(page, node("card:ARO:1000", ".net-shape"), "fill")).toBe(rgb(t["--brand"])); // the query chip
    expect(await css(page, node("card:ARO:1000", ".net-name"), "fill")).toBe(rgb(t["--brand-fg"]));
    expect(await css(page, node("ncbi:WP_1.1", ".net-ribbon rect"), "fill")).toBe(rgb(t["--best"]));
    expect(await css(page, node("ncbi:WP_1.1", ".net-ribbon text"), "fill")).toBe(rgb(t["--best-fg"]));
    expect(await css(page, node("ncbi:WP_4.1", ".net-name"), "fill")).toBe(rgb(t["--fg"]));
    expect(await css(page, node("ncbi:WP_4.1", ".net-sub"), "fill")).toBe(rgb(t["--muted"]));
    expect(await css(page, '[data-testid="network"] [data-edge] path', "stroke")).toBe(rgb(t["--muted"]));
    expect(await css(page, '[data-testid="network"] .net-pill rect', "fill")).toBe(rgb(t["--surface"]));
    expect(await css(page, "[data-expand]  .net-expand-pill", "stroke")).toBe(rgb(t["--chip-match"]));

    // Phenotype blocks and the weak-evidence warning (danger text on a surface).
    await search(page, "card:ARO:2000");
    await expect(page.getByRole("region", { name: "Query entry" })).toContainText("card:ARO:2000");
    await page.getByLabel("Minimum identity").fill("80");
    await expect(page.locator("section p.text-danger")).toBeVisible();
    // The green label bars of the cards.
    expect(await css(page, '[data-field="match-phenotype"] [data-phenotype-list] p', "background-color")).toBe(rgb(t["--label"]));
    expect(await css(page, '[data-field="match-phenotype"] [data-phenotype-list] p', "color")).toBe(rgb(t["--label-fg"]));
    expect(await css(page, '[data-field="match-details"] dt', "background-color")).toBe(rgb(t["--label"]));
    expect(await css(page, "section p.text-danger", "color")).toBe(rgb(t["--danger"]));
    // Not found: danger text on the page background.
    await search(page, "nope");
    expect(await css(page, '[role="alert"]', "color")).toBe(rgb(t["--danger"]));
    // Status notice (alternative id), candidate buttons (ambiguous text) and the slider's accent.
    await search(page, "NG_1.1");
    expect(await css(page, '[role="status"]', "background-color")).toBe(rgb(t["--surface"]));
    expect(await css(page, '[role="status"]', "border-top-color")).toBe(rgb(t["--border"]));
    expect(await css(page, "#min-identity", "accent-color")).toBe(rgb(t["--accent"]));
    await search(page, "ARO:1000");
    const cand = page.getByRole("button", { name: /card:ARO:1000/ });
    expect(await cand.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe(rgb(t["--control-border"]));
    expect(await cand.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(rgb(t["--surface"]));
    // About section.
    await page.getByText("About chAMReDB").click();
    await expect(page.getByText("Welcome to the chAMReDB website.")).toBeVisible();
    expect(await css(page, '[data-testid="about"]', "background-color")).toBe(rgb(t["--surface"]));
    expect(await css(page, '[data-testid="about"] a', "text-decoration-line")).toBe("underline");
  });
}

test("swap test: serving theme.bsb.css as the tokens file restyles the same build, with no component edit", async ({ page }) => {
  const bsb = readFileSync("public/theme.bsb.css", "utf8");
  await page.route("**/theme.css", (route) => route.fulfill({ contentType: "text/css", body: bsb }));
  const { light } = themes("theme.bsb.css");
  expect(light["--bg"]).not.toBe(themes("theme.css").light["--bg"]); // the two files differ, so a pass cannot be a coincidence
  await page.goto("./");
  await expect(page.getByLabel("Entry id")).toBeEnabled();
  await search(page, "card:ARO:1000");
  await expect(page.getByTestId("network")).toBeVisible();
  expect(await css(page, "body", "background-color")).toBe("rgb(240, 240, 247)"); // Pearl, from the BSB brand guidelines
  expect(await css(page, "body", "background-color")).toBe(rgb(light["--bg"]));
  expect(await css(page, "button[type=submit]", "background-color")).toBe("rgb(226, 100, 58)"); // Orange
  expect(await css(page, "button[type=submit]", "color")).toBe("rgb(22, 16, 38)"); // Midnight
  expect(await css(page, '[data-testid="network"] g[data-node="card:ARO:1000"] .net-badge', "fill")).toBe("rgb(226, 100, 58)"); // a mark (CARD badge: Orange)
  expect(await css(page, "h1", "color")).toBe("rgb(22, 16, 38)");
  expect(await css(page, "header", "background-color")).toBe("rgb(135, 51, 139)"); // Purple, the new header token
  expect(await css(page, 'section[aria-label="Matches in ncbi"] h2', "background-color")).toBe(rgb(light["--chip-db"])); // database chip
});

test("swap test in dark mode: the BSB dark variant uses Midnight as background with Pearl text", async ({ page }) => {
  const bsb = readFileSync("public/theme.bsb.css", "utf8");
  await page.route("**/theme.css", (route) => route.fulfill({ contentType: "text/css", body: bsb }));
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("./");
  await expect(page.getByLabel("Entry id")).toBeEnabled();
  await search(page, "card:ARO:1000");
  await expect(page.getByTestId("network")).toBeVisible();
  expect(await css(page, "body", "background-color")).toBe("rgb(22, 16, 38)");
  expect(await css(page, "h1", "color")).toBe("rgb(240, 240, 247)");
  expect(await css(page, "select", "border-top-color")).toBe("rgb(143, 137, 163)"); // dark --control-border
  expect(await css(page, '[data-testid="network"] g[data-node="card:ARO:1000"] .net-badge', "fill")).toBe("rgb(226, 100, 58)");
});
