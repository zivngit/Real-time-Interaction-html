// @ts-check
import { test, expect } from "@playwright/test";
import { ensurePanelOpen, selectEffect, trackPageErrors } from "./helpers.js";

const LAYOUT_KEY = "rtx.fx.layout.v2";

const EFFECTS = {
  particle: { label: "粒子爆散", params: {} },
  ripple: { label: "漣漪圈", params: {} },
  firework: { label: "煙火", params: {} },
  text: { label: "浮現文字", params: {} },
};

function zoneIds(page, zone) {
  return page
    .locator(`${zone} .rtx-fx`)
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-fx")));
}

async function loadConsole(page, payload, stored = null) {
  const effectsResponse = page.waitForResponse(
    (resp) => resp.url().endsWith("/api/effects") && resp.ok()
  );
  await page.addInitScript(
    ([key, value]) => {
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    },
    [LAYOUT_KEY, stored]
  );
  await page.route(/\/api\/effects$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    })
  );
  await page.goto("/examples/embed-console.html");
  await effectsResponse;
  await ensurePanelOpen(page);
}

test("v2 payload renders current and alternate zones", async ({ page }) => {
  const errors = trackPageErrors(page);
  await loadConsole(page, {
    rev: "rev-v2",
    version: 2,
    currentEffects: ["particle", "ripple"],
    alternateEffects: ["firework", "text"],
    effects: EFFECTS,
  });

  await expect(page.locator("#rtx-fx-alternate")).toBeHidden();
  await expect(page.locator("#rtx-fx-layout-btn")).toHaveAttribute("aria-expanded", "false");
  expect(await zoneIds(page, "#rtx-fx-current")).toEqual(["particle", "ripple"]);
  expect(await zoneIds(page, "#rtx-fx-alternate")).toEqual(["firework", "text"]);

  await page.locator("#rtx-fx-layout-btn").click();
  await expect(page.locator("#rtx-fx-alternate")).toBeVisible();
  await expect(page.locator("#rtx-fx-layout-btn")).toHaveAttribute("aria-expanded", "true");

  const alternateStyle = await page.locator("#rtx-fx-alternate").evaluate((el) => {
    const cs = getComputedStyle(el);
    return { borderStyle: cs.borderStyle, backgroundColor: cs.backgroundColor };
  });
  expect(alternateStyle.borderStyle).toBe("dashed");
  expect(alternateStyle.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");

  expect(errors).toHaveLength(0);
});

test("v2 payload appends omitted enabled effects to alternate", async ({ page }) => {
  const errors = trackPageErrors(page);
  await loadConsole(page, {
    rev: "rev-v2",
    version: 2,
    currentEffects: ["particle"],
    alternateEffects: ["ripple"],
    effects: EFFECTS,
  });

  expect(await zoneIds(page, "#rtx-fx-current")).toEqual(["particle"]);
  expect(await zoneIds(page, "#rtx-fx-alternate")).toEqual(["ripple", "firework", "text"]);
  expect(errors).toHaveLength(0);
});

test("v1 payload falls back to all enabled effects in current", async ({ page }) => {
  const errors = trackPageErrors(page);
  await loadConsole(page, {
    rev: "rev-v1",
    effects: EFFECTS,
  });

  expect(await zoneIds(page, "#rtx-fx-current")).toEqual(["particle", "ripple", "firework", "text"]);
  expect(await zoneIds(page, "#rtx-fx-alternate")).toEqual([]);
  await expect(page.locator("#rtx-fx-alternate")).toBeHidden();
  expect(errors).toHaveLength(0);
});

test("stored layout wins over v2 payload and persists sanitized state", async ({ page }) => {
  const errors = trackPageErrors(page);
  const stored = JSON.stringify({
    version: 2,
    current: ["text", "particle"],
    alternate: ["ripple", "firework"],
  });
  await loadConsole(
    page,
    {
      rev: "rev-v2",
      version: 2,
      currentEffects: ["particle", "ripple"],
      alternateEffects: ["firework", "text"],
      effects: EFFECTS,
    },
    stored
  );

  expect(await zoneIds(page, "#rtx-fx-current")).toEqual(["text", "particle"]);
  expect(await zoneIds(page, "#rtx-fx-alternate")).toEqual(["ripple", "firework"]);
  expect(await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)), LAYOUT_KEY)).toEqual({
    version: 2,
    current: ["text", "particle"],
    alternate: ["ripple", "firework"],
  });
  expect(errors).toHaveLength(0);
});

test("layout move hook reorders zones and persists layout", async ({ page }) => {
  const errors = trackPageErrors(page);
  await loadConsole(page, {
    rev: "rev-v2",
    version: 2,
    currentEffects: ["particle", "ripple"],
    alternateEffects: ["firework", "text"],
    effects: EFFECTS,
  });

  const results = await page.evaluate(() => {
    const api = window.__rtxConsoleLayout;
    api.move("firework", "current", null);
    const moveTransform = document.querySelector("#rtx-fx-firework").style.transform;
    return [
      moveTransform,
      api.move("text", "current", "ripple"),
      api.move("particle", "alternate", null),
      api.move("nope", "current", null),
      api.move("particle", "nope", null),
      api.move("particle", "current", "nope"),
    ];
  });

  expect(results[0]).not.toBe("");
  expect(results.slice(1)).toEqual([true, true, false, false, false]);
  expect(await zoneIds(page, "#rtx-fx-current")).toEqual(["text", "ripple", "firework"]);
  expect(await zoneIds(page, "#rtx-fx-alternate")).toEqual(["particle"]);
  expect(await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)), LAYOUT_KEY)).toEqual({
    version: 2,
    current: ["text", "ripple", "firework"],
    alternate: ["particle"],
  });
  expect(errors).toHaveLength(0);
});

test("fx move hook animates neighboring fx buttons in the target zone", async ({ page }) => {
  const errors = trackPageErrors(page);
  await loadConsole(page, {
    rev: "rev-v2",
    version: 2,
    currentEffects: ["particle", "ripple"],
    alternateEffects: ["firework", "text"],
    effects: EFFECTS,
  });

  const transforms = await page.evaluate(() => {
    const api = window.__rtxConsoleLayout;
    api.move("firework", "current", "particle");
    return {
      firework: document.querySelector("#rtx-fx-firework").style.transform,
      particle: document.querySelector("#rtx-fx-particle").style.transform,
      ripple: document.querySelector("#rtx-fx-ripple").style.transform,
      text: document.querySelector("#rtx-fx-text").style.transform,
    };
  });

  expect(transforms.firework).not.toBe("");
  expect(transforms.particle).not.toBe("");
  expect(transforms.ripple).not.toBe("");
  expect(transforms.text).toBe("");
  expect(await zoneIds(page, "#rtx-fx-current")).toEqual(["firework", "particle", "ripple"]);
  expect(await zoneIds(page, "#rtx-fx-alternate")).toEqual(["text"]);
  expect(errors).toHaveLength(0);
});

async function fxDragState(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return {
      transform: el.style.transform,
      zIndex: el.style.zIndex,
      pointerEvents: el.style.pointerEvents,
    };
  }, selector);
}

async function assertFxDragging(page, selector) {
  const state = await fxDragState(page, selector);
  expect(state.zIndex).toBe("30");
  expect(state.pointerEvents).toBe("none");
  expect(state.transform).toContain("translate(");
  expect(state.transform).toContain("scale(1.08)");
}

async function pointerDragFx(page, selector, target, checkSelector = selector) {
  const from = await page.locator(selector).boundingBox();
  const startX = from.x + from.width / 2;
  const startY = from.y + from.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(
    startX + (target.x - startX) / 2,
    startY + (target.y - startY) / 2,
    { steps: 4 }
  );
  await assertFxDragging(page, checkSelector);
  await page.mouse.move(target.x, target.y, { steps: 4 });
  await assertFxDragging(page, checkSelector);
  await page.mouse.up();
  await page.waitForTimeout(300);
}

test("pointer drag reorders fx buttons and persists layout", async ({ page }) => {
  const errors = trackPageErrors(page);
  await loadConsole(page, {
    rev: "rev-v2",
    version: 2,
    currentEffects: ["particle", "ripple"],
    alternateEffects: ["firework", "text"],
    effects: EFFECTS,
  });

  await page.locator("#rtx-fx-layout-btn").click();
  await expect(page.locator("#rtx-fx-alternate")).toBeVisible();

  const particle = "#rtx-fx-particle";
  const currentBox = await page.locator("#rtx-fx-current").boundingBox();
  const alternateBox = await page.locator("#rtx-fx-alternate").boundingBox();

  await pointerDragFx(page, particle, {
    x: currentBox.x + currentBox.width - 20,
    y: currentBox.y + currentBox.height / 2,
  });
  expect(await zoneIds(page, "#rtx-fx-current")).toEqual(["ripple", "particle"]);
  expect(await zoneIds(page, "#rtx-fx-alternate")).toEqual(["firework", "text"]);

  await pointerDragFx(page, particle, {
    x: alternateBox.x + alternateBox.width - 20,
    y: alternateBox.y + alternateBox.height / 2,
  });
  expect(await zoneIds(page, "#rtx-fx-current")).toEqual(["ripple"]);
  expect(await zoneIds(page, "#rtx-fx-alternate")).toEqual(["firework", "text", "particle"]);
  expect(await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)), LAYOUT_KEY)).toEqual({
    version: 2,
    current: ["ripple"],
    alternate: ["firework", "text", "particle"],
  });

  await pointerDragFx(page, particle, {
    x: currentBox.x + currentBox.width - 20,
    y: currentBox.y + currentBox.height / 2,
  });
  expect(await zoneIds(page, "#rtx-fx-current")).toEqual(["ripple", "particle"]);
  expect(await zoneIds(page, "#rtx-fx-alternate")).toEqual(["firework", "text"]);
  expect(await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)), LAYOUT_KEY)).toEqual({
    version: 2,
    current: ["ripple", "particle"],
    alternate: ["firework", "text"],
  });
  expect(errors).toHaveLength(0);
});

test("pointer drag inserts after a hovered fx button when on its right side", async ({ page }) => {
  const errors = trackPageErrors(page);
  const effectKeys = Array.from({ length: 8 }, (_, i) => `fx${i + 1}`);
  const effects = {};
  effectKeys.forEach((key) => {
    effects[key] = { label: key, params: {} };
  });
  await loadConsole(page, {
    rev: "rev-v2",
    version: 2,
    currentEffects: effectKeys,
    alternateEffects: [],
    effects,
  });

  const fourth = await page.locator("#rtx-fx-fx4").boundingBox();
  await pointerDragFx(page, "#rtx-fx-fx1", {
    x: fourth.x + fourth.width * 0.75,
    y: fourth.y + fourth.height / 2,
  });

  expect(await zoneIds(page, "#rtx-fx-current")).toEqual([
    "fx2",
    "fx3",
    "fx4",
    "fx1",
    "fx5",
    "fx6",
    "fx7",
    "fx8",
  ]);
  expect(errors).toHaveLength(0);
});

test("pointer drag selects target row from top using refreshed layout rects", async ({ page }) => {
  const errors = trackPageErrors(page);
  const effectKeys = Array.from({ length: 12 }, (_, i) => `fx${i + 1}`);
  const effects = {};
  effectKeys.forEach((key) => {
    effects[key] = { label: key, params: {} };
  });
  await loadConsole(page, {
    rev: "rev-v2",
    version: 2,
    currentEffects: effectKeys,
    alternateEffects: [],
    effects,
  });

  const start = await page.locator("#rtx-fx-fx2").boundingBox();
  const target = await page.locator("#rtx-fx-fx6").boundingBox();
  const upper = await page.locator("#rtx-fx-fx4").boundingBox();
  const startX = start.x + start.width / 2;
  const startY = start.y + start.height / 2;
  const targetX = target.x + target.width / 2;
  const boundaryY = (upper.y + upper.height + target.y) / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(targetX, boundaryY + 1, { steps: 24 });
  await assertFxDragging(page, "#rtx-fx-fx2");
  expect(await zoneIds(page, "#rtx-fx-current")).toEqual([
    "fx1",
    "fx3",
    "fx4",
    "fx5",
    "fx6",
    "fx2",
    "fx7",
    "fx8",
    "fx9",
    "fx10",
    "fx11",
    "fx12",
  ]);
  await page.mouse.up();
  await page.waitForTimeout(300);
  expect(errors).toHaveLength(0);
});

test("pointer drag selects target row from bottom using refreshed layout rects", async ({ page }) => {
  const errors = trackPageErrors(page);
  const effectKeys = Array.from({ length: 12 }, (_, i) => `fx${i + 1}`);
  const effects = {};
  effectKeys.forEach((key) => {
    effects[key] = { label: key, params: {} };
  });
  await loadConsole(page, {
    rev: "rev-v2",
    version: 2,
    currentEffects: effectKeys,
    alternateEffects: [],
    effects,
  });

  const start = await page.locator("#rtx-fx-fx10").boundingBox();
  const target = await page.locator("#rtx-fx-fx6").boundingBox();
  const lower = await page.locator("#rtx-fx-fx10").boundingBox();
  const startX = start.x + start.width / 2;
  const startY = start.y + start.height / 2;
  const targetX = target.x + target.width / 2;
  const boundaryY = (target.y + target.height + lower.y) / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(targetX, boundaryY - 1, { steps: 24 });
  await assertFxDragging(page, "#rtx-fx-fx10");
  expect(await zoneIds(page, "#rtx-fx-current")).toEqual([
    "fx1",
    "fx2",
    "fx3",
    "fx4",
    "fx5",
    "fx6",
    "fx10",
    "fx7",
    "fx8",
    "fx9",
    "fx11",
    "fx12",
  ]);
  await page.mouse.up();
  await page.waitForTimeout(300);
  expect(errors).toHaveLength(0);
});

test("empty alternate zone can accept a dragged fx button and persist layout", async ({ page }) => {
  const errors = trackPageErrors(page);
  await loadConsole(page, {
    rev: "rev-v2",
    version: 2,
    currentEffects: ["particle", "ripple", "firework", "text"],
    alternateEffects: [],
    effects: EFFECTS,
  });

  await page.locator("#rtx-fx-layout-btn").click();
  await expect(page.locator("#rtx-fx-alternate")).toBeVisible();
  const alternateBox = await page.locator("#rtx-fx-alternate").boundingBox();
  expect(alternateBox).not.toBeNull();
  expect(alternateBox.height).toBeGreaterThanOrEqual(52);

  await pointerDragFx(page, "#rtx-fx-particle", {
    x: alternateBox.x + alternateBox.width / 2,
    y: alternateBox.y + alternateBox.height / 2,
  });
  expect(await zoneIds(page, "#rtx-fx-current")).toEqual(["ripple", "firework", "text"]);
  expect(await zoneIds(page, "#rtx-fx-alternate")).toEqual(["particle"]);
  expect(await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)), LAYOUT_KEY)).toEqual({
    version: 2,
    current: ["ripple", "firework", "text"],
    alternate: ["particle"],
  });

  const currentBox = await page.locator("#rtx-fx-current").boundingBox();
  await pointerDragFx(page, "#rtx-fx-particle", {
    x: currentBox.x + currentBox.width - 20,
    y: currentBox.y + currentBox.height / 2,
  });
  expect(await zoneIds(page, "#rtx-fx-current")).toEqual(["ripple", "firework", "text", "particle"]);
  expect(await zoneIds(page, "#rtx-fx-alternate")).toEqual([]);
  expect(await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)), LAYOUT_KEY)).toEqual({
    version: 2,
    current: ["ripple", "firework", "text", "particle"],
    alternate: [],
  });
  expect(errors).toHaveLength(0);
});

test("missing selected effect falls back to first current effect after reload", async ({ page }) => {
  const errors = trackPageErrors(page);
  let reloaded = false;
  const v2Payload = {
    rev: "rev-v2",
    version: 2,
    currentEffects: ["particle"],
    alternateEffects: ["text"],
    effects: EFFECTS,
  };
  const v1Payload = {
    rev: "rev-v3",
    version: 1,
    effects: {
      particle: EFFECTS.particle,
      ripple: EFFECTS.ripple,
    },
    currentEffects: ["particle", "ripple"],
    alternateEffects: [],
  };

  const effectsResponse = page.waitForResponse(
    (resp) => resp.url().endsWith("/api/effects") && resp.ok()
  );
  await page.addInitScript((key) => {
    window.localStorage.removeItem(key);
  }, LAYOUT_KEY);
  await page.route(/\/api\/effects\/reload$/, (route) => {
    reloaded = true;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(v1Payload),
    });
  });
  await page.route(/\/api\/effects$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(reloaded ? v1Payload : v2Payload),
    })
  );
  await page.goto("/examples/embed-console.html");
  await effectsResponse;
  await ensurePanelOpen(page);

  await selectEffect(page, "text");
  const connBtn = page.locator("#rtx-conn-btn");
  if ((await connBtn.getAttribute("aria-expanded")) === "false") {
    await connBtn.click();
  }
  await page.locator("#rtx-reload-btn").click();

  await expect(page.locator("#rtx-fx-particle")).toHaveClass(/selected/);
  await expect(page.locator("#rtx-fx-text")).toHaveCount(0);
  expect(await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)), LAYOUT_KEY)).toEqual({
    version: 2,
    current: ["particle"],
    alternate: ["ripple"],
  });
  expect(errors).toHaveLength(0);
});