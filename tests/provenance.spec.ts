import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { readThemes } from "../src/contrast";

// Runs only against the real-release build (playwright.release.config.ts sets RELEASE_E2E). Expected values are
// computed here from the files on disk, never read back from the built provenance.json.
test.skip(!process.env.RELEASE_E2E, "needs the real-release build: npm run e2e runs it with playwright.release.config.ts");

const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const record = JSON.parse(readFileSync("data/provenance.json", "utf8"));
const manifest = JSON.parse(readFileSync("data/data_manifest.json", "utf8")) as {
  files: { database: string; release: string; retrieved: string }[];
};
const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};
const label: Record<string, string> = { card: "CARD", ncbi: "NCBI AMRFinderPlus", resfinder: "ResFinder" };

// #21: the footer is one line with the release id; the full provenance moved, unchanged, into the About and data panel
// opened from the footer's "Sources and checksums". The checks below read the panel instead of the old footer.
const openData = async (page: import("@playwright/test").Page) => {
  await page.getByRole("contentinfo").getByRole("button", { name: "Sources and checksums" }).click();
  const panel = page.getByRole("dialog", { name: "About and data" });
  await expect(panel).toBeVisible();
  return panel.getByTestId("provenance");
};

test("privacy statement is visible before any query, with the one-line release footer", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByText(/searches never leave your browser/i)).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
});

test("the release id is visible with no interaction, before and after a search, and the footer is one line", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("./");
  const release = page.getByTestId("footer-release");
  await expect(release).toHaveText(`Data: release ${record.version} (built ${record.date})`);
  await expect(release).toBeVisible();
  const lineHeight = await page.getByTestId("footer-release").locator("..").evaluate((e) => parseFloat(getComputedStyle(e).lineHeight));
  expect((await page.getByTestId("footer-release").locator("..").boundingBox())!.height).toBeLessThan(lineHeight * 1.5); // one line at 1280 px
  await page.goto("./#q=card%3AARO%3A3000230");
  await expect(page.getByTestId("comparison")).toBeVisible();
  await expect(release).toHaveText(`Data: release ${record.version} (built ${record.date})`);
  await release.scrollIntoViewIfNeeded();
  await expect(release).toBeVisible();
});

test("panel shows every provenance field, word for word, from the files on disk (invariant 5)", async ({ page }) => {
  await page.goto("./");
  const data = await openData(page);
  // Each line is built here from data/provenance.json and data/data_manifest.json; the hashes are computed from the
  // shipped graph and manifest, so a stale record or a dropped field fails.
  await expect(data.locator('[data-field="release"]')).toHaveText(`Release ${record.version}, built ${record.date}. Release page.`);
  await expect(data.getByRole("link", { name: "Release page" })).toHaveAttribute("href", record.source);
  await expect(data.getByText("Source databases:", { exact: true })).toBeVisible();
  const dbs = [...new Set(manifest.files.map((f) => f.database))];
  expect(dbs).toEqual(["card", "ncbi", "resfinder"]);
  const expected = dbs.map((db) => {
    const f = manifest.files.find((x) => x.database === db)!;
    return `${label[db]} ${db === "resfinder" ? "git commit " : ""}${f.release}, retrieved ${f.retrieved}`;
  });
  await expect(data.getByRole("listitem")).toHaveText(expected);
  await expect(data.getByText(`Graph built with ${record.tool}.`, { exact: true })).toBeVisible();
  await expect(data.getByText("Release graph.json sha256 (a build input, see the release page):", { exact: true })).toBeVisible();
  await expect(data.locator('[data-sha="graph.json sha256"]')).toHaveText(sha256("data/graph.json"));
  await expect(data.getByText("Release data_manifest.json sha256 (the record of the source database files):", { exact: true })).toBeVisible();
  await expect(data.locator('[data-sha="data_manifest.json sha256"]')).toHaveText(sha256("data/data_manifest.json"));
  await expect(data.getByText("The checksums detect accidental change only; they do not prove who produced the files.", { exact: true })).toBeVisible();
  expect(new URL(page.url()).hash, "opening the panel does not change the URL").toBe("");
});

test("a printed page keeps the full provenance, which the closed panel would not print", async ({ page }) => {
  await page.goto("./#q=card%3AARO%3A3000230");
  await expect(page.getByTestId("comparison")).toBeVisible();
  const print = page.getByTestId("provenance-print");
  await expect(print).toBeHidden(); // on screen the footer is one line
  await page.emulateMedia({ media: "print" });
  await expect(print).toBeVisible();
  await expect(print).toContainText(`Release ${record.version}, built ${record.date}.`);
  await expect(print).toContainText(sha256("data/graph.json"));
  await expect(print).toContainText(sha256("data/data_manifest.json"));
  for (const f of manifest.files) await expect(print).toContainText(f.release);
});

test("keyboard only from the footer: each button opens the panel at its section; Esc closes it and focus returns to it", async ({ page }) => {
  await page.goto("./");
  const footer = page.getByRole("contentinfo");
  const panel = page.getByRole("dialog", { name: "About and data" });
  for (const [name, heading] of [["Sources and checksums", "Sources and checksums"], ["About", "About chAMReDB"]] as const) {
    await footer.getByRole("link", { name: "Code" }).focus();
    await page.keyboard.press("Shift+Tab");
    if (name === "Sources and checksums") await page.keyboard.press("Shift+Tab");
    const button = footer.getByRole("button", { name });
    await expect(button).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("heading", { name: heading })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(button).toBeFocused();
  }
});

test("at 360 px the panel fills the width without sideways scroll, Close stays in view, and the page does not scroll sideways", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 700 });
  await page.goto("./");
  await openData(page);
  const panel = page.getByRole("dialog", { name: "About and data" });
  expect(await panel.evaluate((e) => e.scrollWidth - e.clientWidth)).toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await expect(panel.getByRole("button", { name: "Close" })).toBeInViewport(); // sticky, after the scroll to the data section
});

test("copy buttons put each checksum on the clipboard", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("./");
  const data = await openData(page);
  for (const [name, file] of [["graph.json", "data/graph.json"], ["data_manifest.json", "data/data_manifest.json"]] as const) {
    await data.getByRole("button", { name: `Copy ${name} sha256` }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(sha256(file));
    await expect(data.locator(`[data-copy-status="${name} sha256"]`)).toHaveText("Copied.");
  }
});

for (const scheme of ["light", "dark"] as const) {
  test(`${scheme}: a broken provenance.json is a visible alert in the footer (danger on the page background), the release id stays, the panel says so`, async ({ page }) => {
    const t = readThemes(readFileSync("public/theme.css", "utf8"))[scheme];
    await page.emulateMedia({ colorScheme: scheme });
    await page.route("**/provenance.json", (route) => route.fulfill({ status: 500, body: "" }));
    await page.goto("./");
    const alert = page.getByRole("contentinfo").getByRole("alert");
    await expect(alert).toContainText("Could not load the release provenance");
    expect(await alert.evaluate((el) => getComputedStyle(el).color)).toBe(rgb(t["--danger"])); // --danger on --bg: a tested pair
    await expect(page.getByTestId("footer-release")).toContainText(`Data: release ${record.version}`);
    await page.getByRole("contentinfo").getByRole("button", { name: "Sources and checksums" }).click();
    await expect(page.getByTestId("provenance")).toContainText("Could not load the release provenance");
  });
}

test("a malformed provenance.json (a field missing) is the footer alert, not a crash", async ({ page }) => {
  const built = JSON.parse(readFileSync("dist-release/provenance.json", "utf8"));
  delete built.databases;
  await page.route("**/provenance.json", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(built) }));
  await page.goto("./#q=card%3AARO%3A3000230");
  await expect(page.getByRole("contentinfo").getByRole("alert")).toContainText("malformed");
  await expect(page.getByTestId("comparison")).toBeVisible(); // the app still works
});
