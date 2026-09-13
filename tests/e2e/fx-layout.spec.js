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
    return [
      api.move("firework", "current", null),
      api.move("text", "current", "ripple"),
      api.move("particle", "alternate", null),
      api.move("nope", "current", null),
      api.move("particle", "nope", null),
      api.move("particle", "current", "nope"),
    ];
  });

  expect(results).toEqual([true, true, true, false, false, false]);
  expect(await zoneIds(page, "#rtx-fx-current")).toEqual(["text", "ripple", "firework"]);
  expect(await zoneIds(page, "#rtx-fx-alternate")).toEqual(["particle"]);
  expect(await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)), LAYOUT_KEY)).toEqual({
    version: 2,
    current: ["text", "ripple", "firework"],
    alternate: ["particle"],
  });
  expect(errors).toHaveLength(0);
});

test("dragging fx button into alternate then back to current persists layout", async ({ page }) => {
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

  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await page.locator("#rtx-fx-particle").dispatchEvent("dragstart", { dataTransfer });
  await page
    .locator("#rtx-fx-alternate")
    .dispatchEvent("dragover", { clientX: -10, clientY: -10, dataTransfer });
  await page.locator("#rtx-fx-alternate").dispatchEvent("drop", { dataTransfer });
  await page.locator("#rtx-fx-particle").dispatchEvent("dragend");

  expect(await zoneIds(page, "#rtx-fx-current")).toEqual(["ripple"]);
  expect(await zoneIds(page, "#rtx-fx-alternate")).toEqual(["firework", "text", "particle"]);
  expect(await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)), LAYOUT_KEY)).toEqual({
    version: 2,
    current: ["ripple"],
    alternate: ["firework", "text", "particle"],
  });

  await page.locator("#rtx-fx-particle").dispatchEvent("dragstart", { dataTransfer });
  await page
    .locator("#rtx-fx-current")
    .dispatchEvent("dragover", { clientX: -10, clientY: -10, dataTransfer });
  await page.locator("#rtx-fx-current").dispatchEvent("drop", { dataTransfer });
  await page.locator("#rtx-fx-particle").dispatchEvent("dragend");

  expect(await zoneIds(page, "#rtx-fx-current")).toEqual(["ripple", "particle"]);
  expect(await zoneIds(page, "#rtx-fx-alternate")).toEqual(["firework", "text"]);
  expect(await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)), LAYOUT_KEY)).toEqual({
    version: 2,
    current: ["ripple", "particle"],
    alternate: ["firework", "text"],
  });
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

  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await page.locator("#rtx-fx-particle").dispatchEvent("dragstart", { dataTransfer });
  await page.locator("#rtx-fx-alternate").dispatchEvent("dragover", {
    clientX: alternateBox.x + alternateBox.width / 2,
    clientY: alternateBox.y + alternateBox.height / 2,
    dataTransfer,
  });
  await page.locator("#rtx-fx-alternate").dispatchEvent("drop", { dataTransfer });
  await page.locator("#rtx-fx-particle").dispatchEvent("dragend");

  expect(await zoneIds(page, "#rtx-fx-current")).toEqual(["ripple", "firework", "text"]);
  expect(await zoneIds(page, "#rtx-fx-alternate")).toEqual(["particle"]);
  expect(await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)), LAYOUT_KEY)).toEqual({
    version: 2,
    current: ["ripple", "firework", "text"],
    alternate: ["particle"],
  });

  await page.locator("#rtx-fx-particle").dispatchEvent("dragstart", { dataTransfer });
  await page
    .locator("#rtx-fx-current")
    .dispatchEvent("dragover", { clientX: -10, clientY: -10, dataTransfer });
  await page.locator("#rtx-fx-current").dispatchEvent("drop", { dataTransfer });
  await page.locator("#rtx-fx-particle").dispatchEvent("dragend");

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