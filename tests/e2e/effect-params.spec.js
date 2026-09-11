// @ts-check
import { test, expect } from "@playwright/test";
import { openConsolePage, selectEffect, ensureParamsOpen, clickEffectAt, trackPageErrors } from "./helpers.js";

const CLICK_X = 700;
const CLICK_Y = 360;

test("particle count input is sent in POST body", async ({ page }) => {
  const errors = trackPageErrors(page);
  await openConsolePage(page);
  await selectEffect(page, "particle");
  await ensureParamsOpen(page);

  await page.locator("#rtx-p-count").fill("123");
  const body = await clickEffectAt(page, CLICK_X, CLICK_Y);

  expect(body.effect).toBe("particle");
  expect(body.params.count).toBe(123);
  expect(errors).toHaveLength(0);
});

test("ripple maxRadius input is sent in POST body", async ({ page }) => {
  const errors = trackPageErrors(page);
  await openConsolePage(page);
  await selectEffect(page, "ripple");
  await ensureParamsOpen(page);

  await page.locator("#rtx-p-maxRadius").fill("350");
  const body = await clickEffectAt(page, CLICK_X, CLICK_Y);

  expect(body.effect).toBe("ripple");
  expect(body.params.maxRadius).toBe(350);
  expect(errors).toHaveLength(0);
});

test("text content input is sent in POST body", async ({ page }) => {
  const errors = trackPageErrors(page);
  await openConsolePage(page);
  await selectEffect(page, "text");
  await ensureParamsOpen(page);

  await page.locator("#rtx-p-content").fill("Playwright");
  const body = await clickEffectAt(page, CLICK_X, CLICK_Y);

  expect(body.effect).toBe("text");
  expect(body.params.content).toBe("Playwright");
  expect(errors).toHaveLength(0);
});

test("firework editable:false array param is not rendered", async ({ page }) => {
  const errors = trackPageErrors(page);
  await openConsolePage(page);
  await selectEffect(page, "firework");
  await ensureParamsOpen(page);

  await expect(page.locator("#rtx-p-colors")).toHaveCount(0);
  await expect(page.locator("#rtx-p-count")).toBeVisible();

  await page.locator("#rtx-p-count").fill("64");
  const body = await clickEffectAt(page, CLICK_X, CLICK_Y);

  expect(body.effect).toBe("firework");
  expect(body.params.count).toBe(64);
  expect(body.params).not.toHaveProperty("colors");
  expect(errors).toHaveLength(0);
});