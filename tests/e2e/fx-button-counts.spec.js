// @ts-check
import { test, expect } from "@playwright/test";
import { ensurePanelOpen, trackPageErrors } from "./helpers.js";

const FX_BUTTON_COUNTS = [1, 8, 20, 50];

function buildEffects(count) {
  const effects = {};
  for (let i = 1; i <= count; i += 1) {
    effects[`fx-${String(i).padStart(2, "0")}`] = {
      label: `Fx ${i}`,
      params: {},
    };
  }
  return effects;
}

test("fx buttons are clickable for 1, 8, 20, and 50 effects", async ({ page }) => {
  const errors = trackPageErrors(page);
  let currentCount = 0;

  await page.addInitScript(() => {
    window.localStorage.removeItem("rtx.fx.layout.v2");
  });
  await page.route(/\/api\/effects$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        rev: "fx-button-counts",
        effects: buildEffects(currentCount),
      }),
    })
  );

  for (const count of FX_BUTTON_COUNTS) {
    currentCount = count;
    await page.goto("/examples/embed-console.html");

    const buttons = page.locator("#rtx-fx-current .rtx-fx");
    await expect(buttons).toHaveCount(count);
    await ensurePanelOpen(page);

    for (let i = 0; i < count; i += 1) {
      await buttons.nth(i).click();
      await expect(buttons.nth(i)).toHaveClass(/selected/);
      await expect(page.locator("#rtx-fx-current .rtx-fx.selected")).toHaveCount(1);
    }
  }

  expect(errors).toHaveLength(0);
});
