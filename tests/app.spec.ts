import { expect, test } from "@playwright/test";
import { CSP } from "../src/csp";

// Expected values: tests/fixtures/README.md (worked by hand).
const privacy = /searches never leave your browser/i;

type Page = import("@playwright/test").Page;

async function search(page: Page, id: string) {
  await page.getByLabel("Entry id").fill(id);
  await page.getByRole("button", { name: "Search" }).click();
}

// Collects off-origin requests and CSP console messages for a page.
function watchEgress(page: Page, ownOrigin: string) {
  const external: string[] = [];
  const cspMessages: string[] = [];
  const isExternal = (url: string) => !url.startsWith("data:") && new URL(url).origin !== ownOrigin;
  page.on("request", (r) => isExternal(r.url()) && external.push(r.url()));
  page.on("requestfailed", (r) => isExternal(r.url()) && external.push(r.url()));
  page.on("console", (m) => /content security policy/i.test(m.text()) && cspMessages.push(m.text()));
  return { external, cspMessages };
}

test("the built page carries the CSP, and the egress watcher can fire (negative control)", async ({ page, baseURL }) => {
  const { cspMessages } = watchEgress(page, new URL(baseURL!).origin);
  await page.goto("./");
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute("content", CSP);
  await page.evaluate(() => fetch("https://example.invalid/x").catch(() => {}));
  await expect.poll(() => cspMessages.length).toBeGreaterThan(0);
});

test("egress: renders hand-worked matches, offline, with no third-party traffic", async ({ page, context, baseURL }) => {
  const { external, cspMessages } = watchEgress(page, new URL(baseURL!).origin);

  await page.goto("./");
  await expect(page.getByText(privacy)).toBeVisible();
  await expect(page.getByLabel("Entry id")).toBeEnabled(); // index loaded

  await context.setOffline(true); // after first load, processing needs no network
  await search(page, "card:ARO:1000");

  const ncbi = page.getByRole("region", { name: "Matches in ncbi" });
  await expect(ncbi.getByRole("listitem")).toHaveCount(3);
  await expect(ncbi.getByRole("listitem").nth(0)).toContainText("WP_1.1");
  await expect(ncbi.getByRole("listitem").nth(0)).toContainText("97.0%");
  await expect(ncbi.getByRole("listitem").nth(0)).toContainText("Best");
  await expect(ncbi.getByRole("listitem").nth(1)).toContainText("Best"); // tie
  await expect(ncbi.getByRole("listitem").nth(2)).toContainText("90.0%"); // exactly at the threshold
  await expect(ncbi.getByRole("listitem").nth(2)).not.toContainText("Best");
  const resfinder = page.getByRole("region", { name: "Matches in resfinder" });
  await expect(resfinder.getByRole("listitem")).toHaveCount(1);
  await expect(resfinder).toContainText("blaX");
  await expect(resfinder).toContainText("100.0%");
  await expect(resfinder).not.toContainText("85.0%"); // below the 0.9 default

  expect(external).toEqual([]);
  expect(cspMessages).toEqual([]);
});

test("a database with no match at or above 0.9 has no group; coverage may exceed 100%", async ({ page }) => {
  await page.goto("./");
  await search(page, "card:ARO:2000");
  const ncbi = page.getByRole("region", { name: "Matches in ncbi" });
  await expect(ncbi).toContainText("92.0%");
  await expect(ncbi).toContainText("105.0%");
  await expect(page.getByRole("region", { name: "Matches in resfinder" })).toHaveCount(0);
});

test("a shared native id asks which entry is meant", async ({ page }) => {
  await page.goto("./");
  await search(page, "ARO:1000");
  await page.getByRole("button", { name: /resfinder:ARO:1000/ }).click();
  await expect(page.getByText("No matches with identity of at least 90% for resfinder:ARO:1000")).toBeVisible();
  await search(page, "ARO:1000");
  await page.getByRole("button", { name: /card:ARO:1000/ }).click();
  await expect(page.getByRole("region", { name: "Matches in ncbi" })).toBeVisible();
});

test("a name shared by two databases lists both; an alternative id finds its entry", async ({ page }) => {
  await page.goto("./");
  await search(page, "blaX");
  await expect(page.getByRole("button", { name: /card:ARO:1000 \(blaX\), matched on name/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /resfinder:blaX \(blaX\), matched on id/ })).toBeVisible();
  await search(page, "NG_1.1");
  await expect(page.getByText("NG_1.1 is the alternative id of ncbi:WP_1.1")).toBeVisible();
  await expect(page.getByRole("region", { name: "Matches in card" })).toContainText("97.0%");
});

test("the minimum identity slider reveals lower matches, not flagged best when a higher match exists", async ({ page }) => {
  await page.goto("./");
  await search(page, "card:ARO:1000");
  const slider = page.getByLabel("Minimum identity");
  await expect(slider).toHaveValue("90"); // default 90%
  const resfinder = page.getByRole("region", { name: "Matches in resfinder" });
  await expect(resfinder.getByRole("listitem")).toHaveCount(1);
  await slider.fill("80");
  await expect(resfinder.getByRole("listitem")).toHaveCount(2);
  await expect(resfinder.getByRole("listitem").nth(1)).toContainText("85.0%");
  await expect(resfinder.getByRole("listitem").nth(1)).not.toContainText("Best");
  await slider.fill("98"); // ncbi 97% matches drop out; the group disappears
  await expect(page.getByRole("region", { name: "Matches in ncbi" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Matches in resfinder" })).toBeVisible(); // blaX at 100%
});

test("a group whose top match is below 90% is not called Best and carries a warning; the slider persists", async ({ page }) => {
  await page.goto("./");
  await search(page, "card:ARO:2000");
  await expect(page.getByRole("region", { name: "Matches in resfinder" })).toHaveCount(0); // tetM is 88%
  await page.getByLabel("Minimum identity").fill("80");
  const resfinder = page.getByRole("region", { name: "Matches in resfinder" });
  await expect(resfinder).toContainText("88.0%");
  await expect(resfinder).toContainText("Highest identity shown");
  await expect(resfinder).toContainText("Weak evidence");
  await expect(resfinder.getByText("Best", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Matches in ncbi" }).getByText("Best", { exact: true })).toBeVisible(); // 92%
  await search(page, "card:ARO:1000"); // another entry keeps the slider at 80%
  await expect(page.getByLabel("Minimum identity")).toHaveValue("80");
});

test("shows the demo-data notice", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("note")).toContainText("not a ChamRedB release");
});

test("unknown id says so", async ({ page }) => {
  await page.goto("./");
  await search(page, "ARO:9999");
  await expect(page.getByRole("alert")).toContainText("No entry has the id, name, alternative id or duplicate allele id exactly ARO:9999");
});
