import { expect, test, type Page } from "@playwright/test";

// Keyboard-only path, labels, focus indicators, non-colour encodings, alerts and the About content.
// Expected values: tests/fixtures/README.md (card:ARO:1000 shows 4 matches at 90%; ARO:1000 alone is ambiguous).
const press = async (page: Page, key: string, times = 1) => {
  for (let i = 0; i < times; i++) await page.keyboard.press(key);
};

test("keyboard only: select, search box, Search, slider in reading order; Enter searches; arrows, Home and End move the slider", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByLabel("Entry id")).toBeEnabled();
  await page.getByRole("button", { name: "Dark mode" }).focus(); // the header (tests/header.spec.ts) comes first in reading order; start after it
  await press(page, "Tab");
  await expect(page.getByRole("button", { name: "Full privacy statement" })).toBeFocused(); // #26: the privacy link comes before the form
  await press(page, "Tab");
  await expect(page.getByLabel("Search in database")).toBeFocused();
  await press(page, "Tab");
  await expect(page.getByLabel("Entry id")).toBeFocused();
  await page.keyboard.type("card:ARO:1000");
  await press(page, "Tab");
  await expect(page.getByRole("button", { name: "Search" })).toBeFocused();
  await press(page, "Shift+Tab");
  await press(page, "Enter"); // submits from the search box
  await expect(page.getByRole("region", { name: "Matches in ncbi" })).toBeVisible();
  await press(page, "Tab", 3); // Search button, How to read this (#26: it now follows the form and the examples), then the slider
  const slider = page.getByLabel("Minimum identity");
  await expect(slider).toBeFocused();
  await expect(slider).toHaveValue("90");
  await press(page, "ArrowLeft", 10);
  await expect(slider).toHaveValue("80");
  await expect(page.getByRole("region", { name: "Matches in resfinder" }).locator("[data-match]")).toHaveCount(2);
  await press(page, "Home");
  await expect(slider).toHaveValue("0");
  await press(page, "End");
  await expect(slider).toHaveValue("100");
  await press(page, "ArrowLeft");
  await expect(slider).toHaveValue("99");
});

test("keyboard only: the database select takes type-ahead", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByLabel("Entry id")).toBeEnabled();
  await page.getByLabel("Search in database").focus();
  await page.keyboard.type("CARD"); // type-ahead picks the option
  await expect(page.getByLabel("Search in database")).toHaveValue("card");
});

test("keyboard only: the candidate buttons follow the Search button and are operated with Enter", async ({ page }) => {
  await page.goto("./");
  await page.getByLabel("Entry id").fill("ARO:1000");
  await page.getByLabel("Entry id").focus();
  await press(page, "Enter");
  const cards = page.getByRole("button", { name: /card:ARO:1000/ });
  await expect(cards).toBeVisible();
  await press(page, "Tab"); // Search button
  await expect(page.getByRole("button", { name: "Search" })).toBeFocused();
  await press(page, "Tab");
  await expect(page.getByTestId("how-to-read").locator("summary")).toBeFocused(); // #26: How to read this sits between the form and the messages
  await press(page, "Tab");
  await expect(cards).toBeFocused();
  await press(page, "Tab");
  await expect(page.getByRole("button", { name: /resfinder:ARO:1000/ })).toBeFocused();
  await press(page, "Shift+Tab");
  await press(page, "Enter");
  await expect(page.getByRole("region", { name: "Query entry" })).toContainText("card:ARO:1000");
});

test("every input, select and range has an associated label", async ({ page }) => {
  await page.goto("./");
  await page.getByLabel("Entry id").fill("card:ARO:1000");
  await page.getByLabel("Entry id").press("Enter");
  await expect(page.getByLabel("Minimum identity")).toBeVisible();
  const unlabelled = await page.locator("input, select, textarea").evaluateAll((els) =>
    els.filter((el) => (el as HTMLInputElement).labels?.length === 0).map((el) => el.outerHTML),
  );
  expect(unlabelled).toEqual([]);
  expect(await page.locator("input, select").count()).toBe(3);
  for (const name of ["Search in database", "Entry id or name", "Minimum identity"]) await expect(page.getByLabel(name)).toHaveCount(1);
});

for (const scheme of ["light", "dark"] as const) {
  test(`${scheme}: a focus indicator is visible on every focusable control`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("./");
    await expect(page.getByLabel("Entry id")).toBeEnabled();
    await page.getByLabel("Entry id").fill("ARO:1000"); // ambiguous: shows the candidate buttons
    await page.getByLabel("Entry id").press("Enter");
    await expect(page.getByRole("button", { name: /card:ARO:1000/ })).toBeVisible();
    await page.getByRole("button", { name: /card:ARO:1000/ }).press("Enter"); // now one entry: slider, details
    await expect(page.getByLabel("Minimum identity")).toBeVisible();
    await page.locator("h1").click(); // sets the sequential focus start point at the top, then walk the whole page
    const accent = await page.evaluate(() => {
      const probe = document.body.appendChild(document.createElement("span"));
      probe.style.color = "var(--accent)";
      const c = getComputedStyle(probe).color;
      probe.remove();
      return c; // the accent token as the browser resolves it
    });
    const seen: string[] = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      const f = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const s = getComputedStyle(el);
        return { tag: el.tagName, style: s.outlineStyle, width: parseFloat(s.outlineWidth), colour: s.outlineColor, shadow: s.boxShadow };
      });
      if (f.tag === "BODY") break;
      seen.push(f.tag);
      expect(f.style, f.tag).not.toBe("none");
      expect(f.width, f.tag).toBeGreaterThanOrEqual(2);
      expect(f.colour, f.tag).toBe(accent);
    }
    expect(seen).toEqual(expect.arrayContaining(["SELECT", "INPUT", "BUTTON", "SUMMARY"]));
  });
}

test("non-colour encodings: best, weak and RBH versus OWH are carried by text, shape and dashes", async ({ page }) => {
  await page.goto("./");
  await page.getByLabel("Entry id").fill("card:ARO:1000");
  await page.getByLabel("Entry id").press("Enter");
  const ncbi = page.getByRole("region", { name: "Matches in ncbi" }).locator("[data-match]");
  await expect(ncbi.nth(0)).toContainText("Best"); // text, not only the badge colour
  await expect(ncbi.nth(2)).not.toContainText("Best");
  const net = page.getByTestId("network");
  const dash = (id: string) => net.locator(`[data-edge="card:ARO:1000>${id}"] path`).evaluate((el) => getComputedStyle(el).strokeDasharray);
  expect(await dash("ncbi:WP_1.1")).toBe("none"); // RBH solid
  expect(await dash("ncbi:WP_3.1")).not.toBe("none"); // OWH dashed
  await expect(net.locator('g[data-node="ncbi:WP_1.1"] .net-ribbon')).toContainText("Best"); // best is a text ribbon, not only a colour
  await expect(net.locator('g[data-node="ncbi:WP_4.1"] .net-ribbon')).toHaveCount(0);
  // the database is carried by the badge text and the outline shape as well as by colour
  await expect(net.locator('g[data-node="ncbi:WP_1.1"] .net-badge-text')).toHaveText("NCBI");
  await expect(net.locator('g[data-node="ncbi:WP_1.1"]')).toHaveAttribute("data-shape", "cut");
  await expect(net.locator('g[data-node="resfinder:blaX"]')).toHaveAttribute("data-shape", "pill");
  await expect(net.locator('g[data-node="card:ARO:1000"]')).toHaveAttribute("data-shape", "round");
  // Weak group: wording, not red text alone.
  await page.getByLabel("Entry id").fill("card:ARO:2000");
  await page.getByLabel("Entry id").press("Enter");
  await page.getByLabel("Minimum identity").fill("80");
  const resfinder = page.getByRole("region", { name: "Matches in resfinder" });
  await expect(resfinder).toContainText("Weak evidence");
  await expect(resfinder).toContainText("Highest identity shown");
  await expect(resfinder).not.toContainText("Best");
  // The badge keeps a border when the fill is not distinguishing (weak): a shape cue as well.
  expect(await resfinder.locator("strong").evaluate((el) => getComputedStyle(el).borderTopWidth)).not.toBe("0px");
  // Links are underlined, not only coloured.
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "About" }).click(); // #21: About is in the panel
  expect(await page.getByRole("link", { name: "The Comprehensive Antibiotic Resistance Database (CARD)" }).evaluate((el) => getComputedStyle(el).textDecorationLine)).toContain("underline");
});

test("a not-found message is one alert paragraph, and non-error notices are status, not alert", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByLabel("Entry id")).toBeEnabled();
  await page.getByLabel("Entry id").fill("tetM2");
  await page.getByLabel("Entry id").press("Enter");
  const alert = page.getByRole("alert");
  await expect(alert).toHaveCount(1);
  expect(await alert.evaluate((el) => ({ tag: el.tagName, br: el.querySelectorAll("br").length, text: (el as HTMLElement).innerText }))).toEqual(
    expect.objectContaining({ tag: "P", br: 0, text: expect.not.stringContaining("\n") }),
  );
  await expect(alert).toContainText("exactly tetM2");
  // Alternative id: an explanatory notice, which is a status, and there is no alert.
  await page.getByLabel("Entry id").fill("NG_1.1");
  await page.getByLabel("Entry id").press("Enter");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "alternative id" })).toHaveCount(1);
  // No match above the threshold: status.
  await page.getByLabel("Entry id").fill("resfinder:orphan");
  await page.getByLabel("Entry id").press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "No matches with identity" })).toHaveCount(1);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("a failed data load is announced as an alert", async ({ page }) => {
  await page.route("**/index.json", (route) => route.abort());
  await page.goto("./");
  await expect(page.getByRole("alert")).toContainText("Could not load the data");
});

test("About: the header's About opens the About and data panel by keyboard; content kept; Esc closes it and focus returns", async ({ page }) => {
  // #21: the collapsible About section at the page end became the About and data panel (a native modal <dialog>).
  await page.goto("./");
  await expect(page.getByLabel("Entry id")).toBeEnabled();
  const about = page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "About" });
  const panel = page.getByRole("dialog", { name: "About and data" });
  await expect(panel).toBeHidden();
  await press(page, "Tab", 2); // Query, then About (tests/header.spec.ts asserts the full header order)
  await expect(about).toBeFocused();
  await press(page, "Enter");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { name: "About chAMReDB" })).toBeFocused();
  await expect(page.getByText("Welcome to the chAMReDB website.")).toBeVisible();
  await expect(page.getByText("the dilemma a scientist faces")).toBeVisible();
  await expect(page.getByText("The hypothesis for the project is as follows:")).toBeVisible();
  await expect(page.getByText("aggregate the combined descriptive information")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Databases used" })).toBeVisible();
  const href = (name: string) => page.getByRole("link", { name }).getAttribute("href");
  expect(await page.getByRole("link", { name: "chAMReDB", exact: true }).getAttribute("href")).toBe("https://github.com/antunderwood/chamredb");
  expect(await href("The Comprehensive Antibiotic Resistance Database (CARD)")).toBe("https://card.mcmaster.ca/");
  expect(await href("NCBI AMRFinderPlus Database")).toBe("https://www.ncbi.nlm.nih.gov/pathogens/antimicrobial-resistance/AMRFinder/");
  expect(await href("The ResFinder Database")).toBe("https://bitbucket.org/genomicepidemiology/resfinder_db/src/master/");
  await press(page, "Tab"); // the first link inside is next in order
  await expect(page.getByRole("link", { name: "chAMReDB", exact: true })).toBeFocused();
  // The demo build has no release: the data section says so rather than showing nothing.
  await expect(panel.getByTestId("provenance")).toContainText("Demo data");
  await press(page, "Escape");
  await expect(panel).toBeHidden();
  await expect(about).toBeFocused(); // focus back on the opener
  expect(new URL(page.url()).hash).toBe(""); // opening and closing never touches the hash that holds the search
});

test("About: one clarifying sentence follows the unchanged 2021 hypothesis text", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByLabel("Entry id")).toBeEnabled();
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "About" }).click();
  const about = page.getByTestId("about");
  await expect(about.getByText("This site lists matches by sequence identity; it does not decide that two entries are equivalent.", { exact: true })).toBeVisible();
  await expect(about).toContainText("union of the metadata, and report this to the user so that they can make intelligent, informed choices.");
});

test("About and data panel: Close and a click on the backdrop close it; the page behind is inert while it is open", async ({ page }) => {
  await page.goto("./#q=card%3AARO%3A1000");
  await expect(page.getByTestId("comparison")).toBeVisible();
  const about = page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "About" });
  const panel = page.getByRole("dialog", { name: "About and data" });
  await about.click();
  await expect(panel).toBeVisible();
  for (let i = 0; i < 25; i++) {
    await press(page, "Tab");
    // The page behind is inert: Tab moves through the panel and out to the browser, never onto a page control.
    expect(await page.evaluate(() => { const a = document.activeElement; return !a || a === document.body || !!a.closest("dialog"); }), "no page control behind the panel takes focus").toBe(true);
  }
  // A click on empty space inside the sheet, or a text selection dragged out onto the backdrop, keeps it open.
  const box = (await panel.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height - 5);
  await expect(panel).toBeVisible();
  const text = (await panel.getByText("Welcome to the chAMReDB website.").boundingBox())!;
  await page.mouse.move(text.x + 5, text.y + text.height / 2);
  await page.mouse.down();
  await page.mouse.move(10, 300, { steps: 5 });
  await page.mouse.up();
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "Close" }).click();
  await expect(panel).toBeHidden();
  await expect(about).toBeFocused();
  await about.click();
  await page.mouse.click(10, 300); // left of the sheet: the backdrop
  await expect(panel).toBeHidden();
  expect(new URL(page.url()).hash).toBe("#q=card%3AARO%3A1000"); // the search is untouched
});
