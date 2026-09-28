// @ts-check
import { expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import path from "node:path";

export const TEST_EFFECTS = ["particle", "ripple", "firework", "text"];

export const FIXTURE_PATH = path.resolve(process.cwd(), "tests/fixtures/effects.json");

/** 同步 sleep（Windows 檔案鎖定短暫競態時重試用）。 */
function syncSleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** writeFileSync 遇 Windows 檔案鎖定（UNKNOWN/EBUSY/EPERM）時重試。 */
function writeFileSyncRetry(filePath, data, attempts = 12, delay = 80) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      writeFileSync(filePath, data);
      return;
    } catch (e) {
      lastErr = e;
      syncSleep(delay);
    }
  }
  throw lastErr;
}

/** 回傳 fixture 檔原始 bytes（供 snapshot/restore）。 */
export function snapshotFixture() {
  return readFileSync(FIXTURE_PATH);
}

/** 寫回原始 bytes 恢復 fixture。 */
export function restoreFixture(bytes) {
  writeFileSyncRetry(FIXTURE_PATH, bytes);
}

/** 以 manifest 物件覆寫 fixture 檔。 */
export function writeFixture(manifest) {
  writeFileSyncRetry(FIXTURE_PATH, JSON.stringify(manifest, null, 2) + "\n");
}

/** 讀取 fixture 檔並 parse 為物件。 */
export function readFixture() {
  return JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
}

/** 等全域 mutation rate limit（1/s）滑動窗過期。 */
export async function waitRateLimit(ms = 1100) {
  await new Promise((r) => setTimeout(r, ms));
}

/** 解開 zip bytes 回傳 name→Buffer 的 Map（支援 STORED／DEFLATE）。 */
export function readZipEntries(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  let eocd = -1;
  const minOffset = Math.max(0, b.length - 22 - 65536);
  for (let i = b.length - 22; i >= minOffset; i--) {
    if (b.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("zip EOCD not found");
  const count = b.readUInt16LE(eocd + 10);
  let offset = b.readUInt32LE(eocd + 16);
  const out = new Map();
  for (let i = 0; i < count; i++) {
    if (b.readUInt32LE(offset) !== 0x02014b50) throw new Error("bad central directory");
    const method = b.readUInt16LE(offset + 10);
    const compSize = b.readUInt32LE(offset + 20);
    const nameLen = b.readUInt16LE(offset + 28);
    const extraLen = b.readUInt16LE(offset + 30);
    const commentLen = b.readUInt16LE(offset + 32);
    const localOffset = b.readUInt32LE(offset + 42);
    const name = b.toString("utf8", offset + 46, offset + 46 + nameLen);
    if (b.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("bad local header");
    const localNameLen = b.readUInt16LE(localOffset + 26);
    const localExtraLen = b.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const raw = b.subarray(dataStart, dataStart + compSize);
    out.set(name, method === 8 ? inflateRawSync(raw) : Buffer.from(raw));
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

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
  await expect(page.locator("#rtx-panel")).toHaveCSS("transform", "none");
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