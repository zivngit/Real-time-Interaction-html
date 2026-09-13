// @ts-check
import { expect } from "@playwright/test";

export const TEST_EFFECTS = ["particle", "ripple", "firework", "text"];

export function trackPageErrors(page) {
  const errors = [];
  page.on("pageerror", (err) => errors.push(err));
  return errors;
}

export async function ensurePanelOpen(page) {
  const fab = page.locator("#rtx-fab");
  await expect(fab).toBeVisible();
  if ((await fab.getAttribute("aria-expanded")) === "false") {
    await fab.click();
  }
  await expect(fab).toHaveAttribute("aria-expanded", "true");
}

export async function openConsolePage(page) {
  const effectsResponse = page.waitForResponse(
    (resp) => resp.url().endsWith("/api/effects") && resp.ok()
  );
  await page.goto("/examples/embed-console.html");
  const resp = await effectsResponse;
  const data = await resp.json();
  expect(Object.keys(data.effects).sort()).toEqual([...TEST_EFFECTS].sort());

  await ensurePanelOpen(page);
  for (const effect of TEST_EFFECTS) {
    await expect(page.locator(`#rtx-fx-${effect}`)).toBeVisible();
  }
  await expect(page.locator("#rtx-fx-current .rtx-fx")).toHaveCount(TEST_EFFECTS.length);
}

export async function openViewerPage(page) {
  const connected = page.waitForEvent("console", (msg) =>
    msg.text().includes("[effects] 已連線")
  );
  await page.goto("/examples/embed-viewer.html");
  await connected;
  await expect(page.locator("canvas")).toBeVisible();
}

export async function selectEffect(page, effectId) {
  await ensurePanelOpen(page);
  const btn = page.locator(`#rtx-fx-${effectId}`);
  if (!(await btn.isVisible())) {
    const layoutBtn = page.locator("#rtx-fx-layout-btn");
    if ((await layoutBtn.getAttribute("aria-expanded")) === "false") {
      await layoutBtn.click();
    }
  }
  await btn.click();
  await expect(btn).toHaveClass(/selected/);
}

export async function clickEffectAt(page, x, y) {
  const effectRequest = page.waitForRequest(
    (req) => req.url().endsWith("/api/effect") && req.method() === "POST"
  );
  await page.mouse.click(x, y);
  const req = await effectRequest;
  return JSON.parse(req.postData() || "{}");
}

export async function clearScreen(page) {
  const clearRequest = page.waitForRequest(
    (req) => req.url().endsWith("/api/clear") && req.method() === "POST"
  );
  await page.locator("#rtx-clear-btn").click();
  const req = await clearRequest;
  return req;
}

export async function ensureParamsOpen(page) {
  const btn = page.locator("#rtx-params-btn");
  await expect(btn).toBeVisible();
  if ((await btn.getAttribute("aria-expanded")) === "false") {
    await btn.click();
  }
  await expect(btn).toHaveAttribute("aria-expanded", "true");
}

export function canvasHasPixelsNear(page, xRatio, yRatio, sampleSize = 96) {
  return page.evaluate(
    ({ xRatio, yRatio, sampleSize }) => {
      const canvas = document.querySelector("canvas");
      if (!canvas || canvas.width === 0 || canvas.height === 0) return false;
      const ctx = canvas.getContext("2d");
      const cx = Math.floor(xRatio * canvas.width);
      const cy = Math.floor(yRatio * canvas.height);
      const half = Math.floor(sampleSize / 2);
      const x0 = Math.max(0, cx - half);
      const y0 = Math.max(0, cy - half);
      const w = Math.min(sampleSize, canvas.width - x0);
      const h = Math.min(sampleSize, canvas.height - y0);
      if (w <= 0 || h <= 0) return false;
      const data = ctx.getImageData(x0, y0, w, h).data;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 0) return true;
      }
      return false;
    },
    { xRatio, yRatio, sampleSize }
  );
}