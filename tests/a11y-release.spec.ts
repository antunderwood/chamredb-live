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
  test(`${scheme}: the footer is readable (muted text on the background, border token, underlined link)`, async ({ page }) => {
    const t = readThemes(readFileSync("public/theme.css", "utf8"))[scheme];
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("./");
    const footer = page.getByRole("contentinfo");
    await expect(footer).toBeVisible();
    expect(await footer.evaluate((el) => getComputedStyle(el).color)).toBe(rgb(t["--muted"]));
    expect(await page.locator("body").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(rgb(t["--bg"]));
    expect(await footer.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe(rgb(t["--border"]));
    expect(await footer.getByRole("link", { name: "Release page" }).evaluate((el) => getComputedStyle(el).textDecorationLine)).toContain("underline");
  });
}
