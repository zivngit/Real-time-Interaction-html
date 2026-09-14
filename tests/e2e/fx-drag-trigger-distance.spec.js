// @ts-check
import { test, expect } from "@playwright/test";
import { ensurePanelOpen } from "./helpers.js";

const LAYOUT_KEY = "rtx.fx.layout.v2";
const TARGET = "fx6";

const CASES = [
  { name: "left", start: "fx5" },
  { name: "right", start: "fx7" },
  { name: "top", start: "fx2" },
  { name: "bottom", start: "fx10" },
  { name: "top-left", start: "fx1" },
  { name: "top-right", start: "fx3" },
  { name: "bottom-left", start: "fx9" },
  { name: "bottom-right", start: "fx11" },
];

const EXPECTED_ORDERS = {
  left: ["fx1", "fx2", "fx3", "fx4", "fx6", "fx5", "fx7", "fx8", "fx9", "fx10", "fx11", "fx12"],
  right: ["fx1", "fx2", "fx3", "fx4", "fx5", "fx7", "fx6", "fx8", "fx9", "fx10", "fx11", "fx12"],
  top: ["fx1", "fx3", "fx4", "fx5", "fx6", "fx2", "fx7", "fx8", "fx9", "fx10", "fx11", "fx12"],
  bottom: ["fx1", "fx2", "fx3", "fx4", "fx5", "fx6", "fx10", "fx7", "fx8", "fx9", "fx11", "fx12"],
  "top-left": ["fx2", "fx3", "fx4", "fx5", "fx1", "fx6", "fx7", "fx8", "fx9", "fx10", "fx11", "fx12"],
  "top-right": ["fx1", "fx2", "fx4", "fx5", "fx6", "fx3", "fx7", "fx8", "fx9", "fx10", "fx11", "fx12"],
  "bottom-left": ["fx1", "fx2", "fx3", "fx4", "fx5", "fx9", "fx6", "fx7", "fx8", "fx10", "fx11", "fx12"],
  "bottom-right": ["fx1", "fx2", "fx3", "fx4", "fx5", "fx6", "fx11", "fx7", "fx8", "fx9", "fx10", "fx12"],
};

async function currentOrder(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("#rtx-fx-current .rtx-fx")].map((btn) => btn.getAttribute("data-fx"))
  );
}

test("fx drag trigger distance is uniform from eight directions", async ({ page }) => {
  test.setTimeout(180_000);

  const results = [];
  const effects = {};
  for (let i = 1; i <= 12; i += 1) effects[`fx${i}`] = { label: `fx${i}`, params: {} };

  await page.addInitScript(([key]) => window.localStorage.removeItem(key), [LAYOUT_KEY]);
  await page.route(/\/api\/effects$/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ rev: "trigger", version: 2, currentEffects: Object.keys(effects), alternateEffects: [], effects }) })
  );

  for (const c of CASES) {
    const effectsResponse = page.waitForResponse((resp) => resp.url().endsWith("/api/effects") && resp.ok());
    await page.goto("/examples/embed-console.html");
    await effectsResponse;
    await ensurePanelOpen(page);

    const targetBox = await page.locator(`#rtx-fx-${TARGET}`).boundingBox();
    const startBox = await page.locator(`#rtx-fx-${c.start}`).boundingBox();
    if (!targetBox || !startBox) throw new Error(`missing box for ${c.name}`);

    const targetCenter = { x: targetBox.x + targetBox.width / 2, y: targetBox.y + targetBox.height / 2 };
    const startCenter = { x: startBox.x + startBox.width / 2, y: startBox.y + startBox.height / 2 };
    const initialOrder = await currentOrder(page);

    await page.mouse.move(startCenter.x, startCenter.y);
    await page.mouse.down();

    const dx = targetCenter.x - startCenter.x;
    const dy = targetCenter.y - startCenter.y;
    const total = Math.hypot(dx, dy);
    const stepPx = 0.5;
    const overshootPx = 12;
    const pathLength = total + overshootPx;
    const steps = Math.max(1, Math.ceil(pathLength / stepPx));
    let trigger = null;

    const unitX = total ? dx / total : 0;
    const unitY = total ? dy / total : 0;
    for (let i = 1; i <= steps; i += 1) {
      const progress = i * stepPx;
      const x = startCenter.x + unitX * progress;
      const y = startCenter.y + unitY * progress;
      await page.mouse.move(x, y);
      const order = await currentOrder(page);
      if (order.join("|") !== initialOrder.join("|")) {
        trigger = {
          name: c.name,
          start: c.start,
          target: TARGET,
          x,
          y,
          pointerDistanceToTargetCenter: Math.hypot(targetCenter.x - x, targetCenter.y - y),
          pointerDistanceFromStart: Math.hypot(x - startCenter.x, y - startCenter.y),
          overshootBeyondTargetPx: Math.max(0, progress - total),
          steps: i,
          order,
        };
        break;
      }
    }

    await page.mouse.up();
    await page.waitForTimeout(300);

    expect(trigger, `no trigger observed for ${c.name}`).toBeTruthy();
    results.push(trigger);
  }

  expect(results).toHaveLength(CASES.length);
  for (const r of results) {
    expect(Math.abs(r.pointerDistanceToTargetCenter - 30), `${r.name} trigger distance ${r.pointerDistanceToTargetCenter}`).toBeLessThanOrEqual(0.5);
    expect(r.pointerDistanceToTargetCenter, `${r.name} trigger distance too early`).toBeGreaterThan(25);
    expect(r.order, `${r.name} insertion order`).toEqual(EXPECTED_ORDERS[r.name]);
  }
});