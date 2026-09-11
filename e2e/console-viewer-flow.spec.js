// @ts-check
import { test, expect } from "@playwright/test";
import {
  openConsolePage,
  openViewerPage,
  selectEffect,
  clickEffectAt,
  clearScreen,
  canvasHasPixelsNear,
  trackPageErrors,
} from "./helpers.js";

test("console click sends effect to viewer and clear resets viewer", async ({ page, context }) => {
  const viewer = await context.newPage();
  const consoleErrors = trackPageErrors(page);
  const viewerErrors = trackPageErrors(viewer);

  await openViewerPage(viewer);
  await openConsolePage(page);
  await selectEffect(page, "particle");

  const clickX = 700;
  const clickY = 360;
  const body = await clickEffectAt(page, clickX, clickY);

  expect(body.effect).toBe("particle");
  expect(body.x).toBeGreaterThan(0);
  expect(body.x).toBeLessThan(100);
  expect(body.y).toBeGreaterThan(0);
  expect(body.y).toBeLessThan(100);
  expect(typeof body.params).toBe("object");
  expect(body.params).not.toBeNull();

  await expect.poll(
    () => canvasHasPixelsNear(viewer, clickX / 1280, clickY / 720),
    { timeout: 5000, message: "viewer canvas should render particle near click point" }
  ).toBe(true);

  const cleared = viewer.waitForEvent("console", (msg) =>
    msg.text().includes("[effects] cleared")
  );
  await clearScreen(page);
  await cleared;

  expect(consoleErrors).toHaveLength(0);
  expect(viewerErrors).toHaveLength(0);
  await viewer.close();
});