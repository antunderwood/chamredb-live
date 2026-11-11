import { expect, test } from "@playwright/test";

// Runs on the fixture build (the default config). The example buttons need the real release: tests/examples.spec.ts.
const squash = (s: string | null) => (s ?? "").replace(/\s+/g, " ").trim();

// The sentences that sat above the results before ticket #7, quoted from the old src/main.tsx. Each one must still
// be on the page: in the collapsed section, in the visible privacy line (sentence 2), or in the short results line.
const OLD_PRIVACY = [
  "Privacy: all searches run in your browser.",
  "Your searches never leave your browser, and this site loads no third-party scripts, fonts or analytics.",
  "The web host keeps ordinary access logs of page and data file requests.",
  "The address of this page records your search after the # sign, so you can share it; your browser does not send that part to this site, but anyone you give the link to can read it.",
];
const OLD_RESULTS = [
  "identity: fraction of identical residues; coverage: alignment length / query length, so it can exceed 100%",
  "Best is the highest identity in that database among the matches shown, by identity only: it ignores coverage and the match type.",
  "RBH: reciprocal best hit; OWH: one-way hit (the reverse direction is not implied).",
];

test("the page has exactly one h1, the tagline; the wordmark is not a heading (#26)", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Find the equivalent of an antimicrobial resistance gene in CARD, NCBI AMRFinderPlus and ResFinder.");
});

test("the one-sentence privacy line is visible before any query and the full statement is collapsed (#26)", async ({ page }) => {
  await page.goto("./");
  const line = page.getByTestId("privacy-line");
  await expect(line).toBeVisible();
  await expect(line).toContainText("Searches run in your browser; nothing is sent.");
  const form = await page.locator("form").boundingBox();
  expect((await line.boundingBox())!.y).toBeLessThan(form!.y); // above the search
  const section = page.getByTestId("how-to-read");
  await expect(section).not.toHaveAttribute("open", "");
  await expect(page.getByTestId("privacy-full")).toBeHidden();
});

test("the privacy link opens How to read this at the full statement, which is the previous wording; the address does not change (#26)", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByLabel("Entry id")).toBeEnabled();
  const before = page.url();
  await page.getByRole("button", { name: "Full privacy statement" }).click();
  await expect(page.getByTestId("how-to-read")).toHaveAttribute("open", "");
  const full = page.getByTestId("privacy-full");
  await expect(full).toBeVisible();
  await expect(full).toBeInViewport();
  await expect(page.getByTestId("howto-privacy")).toBeFocused();
  // The sentence that used to sit above the results, word for word, without its pointer to this section.
  expect(squash(await full.textContent())).toBe(
    "Privacy: your searches never leave your browser, and this site loads no third-party scripts, fonts or analytics. The web host keeps ordinary access logs, and anyone you give a link to can read the search in it.",
  );
  await expect(page.getByText("anyone you give the link to can read it")).toBeVisible(); // the address paragraph is unchanged
  expect(page.url()).toBe(before);
});

test("How to read this opens with Enter and with Space from the keyboard, and closes again", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByLabel("Entry id")).toBeEnabled();
  const summary = page.getByTestId("how-to-read").locator("summary"); // #26: the label gained an info icon, so the summary itself is the control
  await page.getByLabel("Entry id").focus();
  await page.keyboard.press("Tab"); // Search is disabled while the box is empty and the fixture has no examples
  await expect(summary).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("how-to-read")).toHaveAttribute("open", "");
  await page.keyboard.press("Space");
  await expect(page.getByTestId("how-to-read")).not.toHaveAttribute("open", "");
  await page.keyboard.press("Space");
  await expect(page.getByTestId("how-to-read")).toHaveAttribute("open", "");
  await expect(page.getByText("anyone you give the link to can read it")).toBeVisible();
});

test("no caveat sentence from before was lost", async ({ page }) => {
  await page.goto("./");
  const page_text = squash(await page.locator("main").textContent());
  for (const s of [...OLD_PRIVACY, ...OLD_RESULTS]) {
    const body = s.replace(/^Privacy: /, "").replace(/^[A-Z]/, (c) => c.toLowerCase());
    expect(page_text.toLowerCase(), s).toContain(body.toLowerCase());
  }
  expect(squash(await page.getByTestId("how-to-read").textContent())).toContain("Weak evidence");
});

test("the short results line and the weak-evidence warning stay visible without opening anything", async ({ page }) => {
  await page.goto("./");
  await page.getByLabel("Entry id").fill("card:ARO:2000");
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByLabel("Minimum identity").fill("80");
  await expect(page.getByText("databases with matches at or above 80% identity.")).toBeVisible();
  await expect(page.getByText("Best marks the highest identity shown in each database, by identity only")).toBeVisible();
  await expect(page.getByText("RBH: reciprocal best hit; OWH: one-way hit.").first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Matches in resfinder" })).toContainText("Weak evidence");
  await expect(page.getByRole("region", { name: "Matches in resfinder" }).getByText("Weak evidence")).toBeVisible();
  await expect(page.getByTestId("how-to-read")).not.toHaveAttribute("open", "");
});

test("the top of the page does not scroll sideways at 390 px, collapsed or open", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("./");
  await page.getByTestId("how-to-read").locator("summary").click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the fixture build offers no example buttons (none of the real examples exists in it)", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByLabel("Entry id")).toBeEnabled();
  await expect(page.getByRole("button", { name: /^Example:/ })).toHaveCount(0);
});

test("the Query and About nav buttons still work", async ({ page }) => {
  await page.goto("./");
  // #21: About opens the About and data panel; the footer has an About button too on release builds, so scope to the nav.
  // The panel is modal, so it is closed (Escape) before Query is pressed.
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "About" }).click();
  await expect(page.getByRole("dialog", { name: "About and data" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Query" }).click();
  await expect(page.getByLabel("Entry id")).toBeFocused();
});
