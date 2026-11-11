import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { readThemes } from "../src/contrast";

// Runs against the real-release build (playwright.release.config.ts), the only build that shows the footer.
test.skip(!process.env.RELEASE_E2E, "needs the real-release build: npm run e2e runs it with playwright.release.config.ts");

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

for (const scheme of ["light", "dark"] as const) {
  // #21: the footer is one line; its "Release page" link moved into the About and data panel, so the underline check
  // reads the footer's own Code link and buttons, and the panel gets the same token checks (tested pairs in contrast.ts).
  test(`${scheme}: the footer and the About and data panel are readable (token colours, underlined links)`, async ({ page }) => {
    const t = readThemes(readFileSync("public/theme.css", "utf8"))[scheme];
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("./");
    const footer = page.getByRole("contentinfo");
    await expect(footer).toBeVisible();
    expect(await footer.evaluate((el) => getComputedStyle(el).color)).toBe(rgb(t["--muted"]));
    expect(await page.locator("body").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(rgb(t["--bg"]));
    expect(await footer.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe(rgb(t["--border"]));
    for (const l of [footer.getByRole("link", { name: "Code" }), footer.getByRole("button", { name: "Sources and checksums" }), footer.getByRole("button", { name: "About" })]) {
      expect(await l.evaluate((el) => getComputedStyle(el).textDecorationLine)).toContain("underline");
    }
    await footer.getByRole("button", { name: "Sources and checksums" }).click();
    const panel = page.getByRole("dialog", { name: "About and data" });
    expect(await panel.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(rgb(t["--surface"])); // --fg and --muted on --surface: tested pairs
    expect(await panel.evaluate((el) => getComputedStyle(el).color)).toBe(rgb(t["--fg"]));
    expect(await panel.locator("[data-sha]").first().evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(rgb(t["--panel"])); // --fg on --panel
    expect(await panel.getByRole("button", { name: "Close" }).evaluate((el) => getComputedStyle(el).borderTopColor)).toBe(rgb(t["--control-border"]));
    expect(await panel.getByRole("link", { name: "Release page" }).evaluate((el) => getComputedStyle(el).textDecorationLine)).toContain("underline");
  });
}
