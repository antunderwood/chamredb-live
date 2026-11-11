import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { readDarkAttribute, readThemes } from "../src/contrast";

// Header: wordmark, nav, theme toggle. Expected colours come from public/theme.css on disk, not from the page.
const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};
const css = readFileSync("public/theme.css", "utf8");
const { light, dark } = readThemes(css);
const darkByAttribute = readDarkAttribute(css);
const style = (page: Page, selector: string, prop: string) =>
  page.locator(selector).first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
const toggle = (page: Page) => page.getByRole("button", { name: "Dark mode" });

test("the wordmark's accessible name is chAMReDB, without the emoji", async ({ page }) => {
  await page.goto("./");
  const tree = await page.locator(".wordmark").ariaSnapshot();
  expect(tree.trim()).toBe("- paragraph: chAMReDB"); // the emoji and the split spelling are hidden from assistive technology
  await expect(page.locator(".wordmark")).toContainText("chAMR😍Db"); // what a sighted reader sees
});

test("keyboard only: Query, About, Code, the toggle, then the search form, each with a visible focus ring", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByLabel("Entry id")).toBeEnabled();
  const order: string[] = [];
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Tab");
    const f = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const s = getComputedStyle(el);
      return { name: el.getAttribute("aria-label") ?? el.textContent ?? "", style: s.outlineStyle, width: parseFloat(s.outlineWidth), colour: s.outlineColor, inHeader: !!el.closest("header") };
    });
    order.push(f.name);
    expect(f.style, f.name).not.toBe("none");
    expect(f.width, f.name).toBeGreaterThanOrEqual(2);
    if (f.inHeader) expect(f.colour, f.name).toBe(rgb(light["--brand-fg"])); // --accent would not show on the purple bar
  }
  expect(order).toEqual(["Query", "About", "Code", "Dark mode"]);
  await page.keyboard.press("Tab"); // then the search form
  await expect(page.getByLabel("Search in database")).toBeFocused();
});

test("nav: Query focuses the search box, About opens the About section, Code links to this repository", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByLabel("Entry id")).toBeEnabled();
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Code" })).toHaveAttribute("href", "https://github.com/antunderwood/chamredb-live");
  await nav.getByRole("button", { name: "About" }).click();
  await expect(page.getByText("Welcome to the chAMReDB website.")).toBeVisible();
  await nav.getByRole("button", { name: "Query" }).click();
  await expect(page.getByLabel("Entry id")).toBeFocused();
  expect(new URL(page.url()).hash).toBe(""); // the nav does not touch the hash that holds the search
});

test("the header bar, nav pill and toggle take their colours from the tokens", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("./");
  expect(await style(page, "header", "background-color")).toBe(rgb(light["--brand"]));
  expect(await style(page, "header", "color")).toBe(rgb(light["--brand-fg"]));
  expect(await style(page, ".nav-item-active", "background-color")).toBe(rgb(light["--nav-active-bg"]));
  expect(await style(page, ".nav-item-active", "color")).toBe(rgb(light["--nav-active-fg"]));
  expect(await style(page, ".theme-toggle", "border-top-color")).toBe(rgb(light["--brand-fg"]));
});

test("the toggle follows the system by default, switches, and the choice survives a reload", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("./");
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "true"); // system dark, nothing saved
  expect(await style(page, "body", "background-color")).toBe(rgb(dark["--bg"]));
  await toggle(page).click(); // explicit light beats the system's dark
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await style(page, "body", "background-color")).toBe(rgb(light["--bg"]));
  await page.reload();
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "false"); // kept in localStorage
  expect(await style(page, "body", "background-color")).toBe(rgb(light["--bg"]));
  await toggle(page).click(); // and back to dark
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await style(page, "body", "background-color")).toBe(rgb(darkByAttribute["--bg"]));
  await page.reload();
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
  expect(await style(page, "header", "background-color")).toBe(rgb(darkByAttribute["--brand"]));
});

test("an explicit dark choice beats a light system setting", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => localStorage.setItem("chamredb-theme", "dark"));
  await page.goto("./");
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
  expect(await style(page, "body", "background-color")).toBe(rgb(darkByAttribute["--bg"]));
  expect(await style(page, "body", "color")).toBe(rgb(darkByAttribute["--fg"]));
});

test("with localStorage blocked the page works and the toggle still switches for the visit", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
  });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("./");
  await expect(page.getByLabel("Entry id")).toBeEnabled();
  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
  expect(await style(page, "body", "background-color")).toBe(rgb(darkByAttribute["--bg"]));
  await page.getByLabel("Entry id").fill("card:ARO:1000");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByTestId("network")).toBeVisible();
  expect(errors).toEqual([]);
});
