// @ts-check
import { test, expect } from "@playwright/test";
import { openConsolePage, openViewerPage, trackPageErrors, TEST_EFFECTS } from "./helpers.js";

test("examples index lists embed pages", async ({ page }) => {
  const errors = trackPageErrors(page);
  await page.goto("/examples/");
  await expect(page.getByRole("heading", { name: /examples/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "embed-viewer.html" })).toBeVisible();
  await expect(page.getByRole("link", { name: "embed-console.html" })).toBeVisible();
  await expect(page.getByRole("link", { name: "embed-both.html" })).toBeVisible();
  await expect(page.getByRole("link", { name: "/editor" })).toBeVisible();
  expect(errors).toHaveLength(0);
});

test("embed-console loads console and test manifest effects", async ({ page }) => {
  const errors = trackPageErrors(page);
  await openConsolePage(page);
  await expect(page.locator("#rtx-fab")).toBeVisible();
  await expect(page.locator("#rtx-fx-current .rtx-fx")).toHaveCount(TEST_EFFECTS.length);
  expect(errors).toHaveLength(0);
});

test("embed-console fx buttons use fixed grid layout", async ({ page }) => {
  const errors = trackPageErrors(page);
  await openConsolePage(page);
  await expect(page.locator("#rtx-fx-current")).toBeVisible();
  await expect(page.locator("#rtx-fx-current .rtx-fx")).toHaveCount(TEST_EFFECTS.length);
  await expect(page.locator("#rtx-fx-alternate")).toBeHidden();
  await expect
    .poll(() =>
      page.locator("#rtx-fx-current").evaluate((el) => getComputedStyle(el).display)
    )
    .toBe("grid");
  const grid = await page.locator("#rtx-fx-current").evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      display: cs.display,
      columns: cs.gridTemplateColumns.split(" ").filter(Boolean).length,
      overflowY: cs.overflowY,
    };
  });
  expect(grid.display).toBe("grid");
  expect(grid.columns).toBe(4);
  expect(grid.overflowY).toBe("auto");
  expect(errors).toHaveLength(0);
});

test("embed-viewer loads canvas and connects to stream", async ({ page }) => {
  const errors = trackPageErrors(page);
  await openViewerPage(page);
  await expect(page.locator("canvas")).toBeVisible();
  expect(errors).toHaveLength(0);
});

test("embed-both loads viewer canvas and console", async ({ page }) => {
  const errors = trackPageErrors(page);
  const connected = page.waitForEvent("console", (msg) =>
    msg.text().includes("[effects] 已連線")
  );
  await page.goto("/examples/embed-both.html");
  await connected;
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("#rtx-fab")).toBeVisible();
  expect(errors).toHaveLength(0);
});