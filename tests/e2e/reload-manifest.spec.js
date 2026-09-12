// @ts-check
import { test, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { ensurePanelOpen, TEST_EFFECTS } from "./helpers.js";

const ROOT = process.cwd();
const KEY = "reload-e2e-key";
const RELOADED_EFFECTS = TEST_EFFECTS.filter((effect) => effect !== "firework");

let child = null;
let tempDir = null;
let manifestPath = "";
let base = "";
let serverLog = "";

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen({ host: "127.0.0.1", port: 0 }, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("failed to allocate free port"));
        return;
      }
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForServer() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30000) {
    try {
      const res = await fetch(base + "/health");
      if (res.ok) return;
    } catch (err) {
      // server is still starting
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`isolated uvicorn server did not become ready\n${serverLog}`);
}

function stopServer() {
  if (child) {
    child.kill();
    child = null;
  }
}

test.beforeAll(async () => {
  const port = await getFreePort();
  base = `http://127.0.0.1:${port}`;
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rtx-reload-"));
  manifestPath = path.join(tempDir, "effects.json");
  fs.copyFileSync(path.join(ROOT, "tests", "fixtures", "effects.json"), manifestPath);

  const venvPython = path.join(
    ROOT,
    process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python"
  );
  const python = fs.existsSync(venvPython) ? venvPython : "python";

  child = spawn(
    python,
    ["-m", "uvicorn", "server.main:app", "--host", "127.0.0.1", "--port", String(port)],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        ACCESS_KEY: KEY,
        RTX_EFFECTS_MANIFEST: manifestPath,
        SERVE_EXAMPLES: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    }
  );
  child.stdout.on("data", (data) => {
    serverLog += data.toString();
  });
  child.stderr.on("data", (data) => {
    serverLog += data.toString();
  });

  await waitForServer();
});

test.afterAll(async () => {
  stopServer();
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("viewer auto-updates manifest; consoles require manual reload or refresh", async ({ browser }) => {
  const viewerCtx = await browser.newContext();
  await viewerCtx.addInitScript(({ url, key }) => {
    window.EFFECT_DISPLAY = { url, key };
  }, { url: base, key: KEY });
  const viewer = await viewerCtx.newPage();

  const consoleACtx = await browser.newContext();
  await consoleACtx.addInitScript(({ url, key }) => {
    localStorage.setItem("rtx.srvUrl", url);
    localStorage.setItem("rtx.srvKey", key);
  }, { url: base, key: KEY });
  const consoleA = await consoleACtx.newPage();

  const consoleBCtx = await browser.newContext();
  await consoleBCtx.addInitScript(({ url, key }) => {
    window.CONTROL_CONFIG = { url, key };
  }, { url: base, key: KEY });
  const consoleB = await consoleBCtx.newPage();

  try {
    const viewerConnected = viewer.waitForEvent("console", (msg) =>
      msg.text().includes("[effects] 已連線")
    );
    await viewer.goto(base + "/examples/embed-viewer.html", { waitUntil: "domcontentloaded" });
    await viewerConnected;
    await viewer.waitForFunction(
      (count) => window.Effects && Object.keys(window.Effects.registry).length >= count,
      TEST_EFFECTS.length,
      { timeout: 10000 }
    );
    expect(await viewer.evaluate(() => "firework" in window.Effects.registry)).toBe(true);

    const aEffects = consoleA.waitForResponse((resp) => resp.url().endsWith("/api/effects") && resp.ok());
    await consoleA.goto(base + "/examples/embed-console.html", { waitUntil: "domcontentloaded" });
    const aData = await (await aEffects).json();
    expect(Object.keys(aData.effects).sort()).toEqual([...TEST_EFFECTS].sort());
    await consoleA.evaluate(() => window.__rtxConsoleReady.then(() => true));
    await expect(consoleA.locator("#rtx-fx-firework")).toHaveCount(1);

    const bEffects = consoleB.waitForResponse((resp) => resp.url().endsWith("/api/effects") && resp.ok());
    await consoleB.goto(base + "/examples/embed-console.html", { waitUntil: "domcontentloaded" });
    const bData = await (await bEffects).json();
    expect(Object.keys(bData.effects).sort()).toEqual([...TEST_EFFECTS].sort());
    await consoleB.evaluate(() => window.__rtxConsoleReady.then(() => true));
    await expect(consoleB.locator("#rtx-fx-firework")).toHaveCount(1);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    delete manifest.effects.firework;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

    const reloadRes = await fetch(base + "/api/effects/reload", {
      method: "POST",
      headers: { "X-Access-Key": KEY },
    });
    expect(reloadRes.ok).toBe(true);
    const reloadBody = await reloadRes.json();
    expect(reloadBody.changed).toBe(true);
    expect(reloadBody.effects.sort()).toEqual([...RELOADED_EFFECTS].sort());

    await viewer.waitForFunction(
      () => window.Effects && !("firework" in window.Effects.registry) && "particle" in window.Effects.registry,
      undefined,
      { timeout: 10000 }
    );

    await new Promise((resolve) => setTimeout(resolve, 500));
    await expect(consoleA.locator("#rtx-fx-firework")).toHaveCount(1);
    await expect(consoleB.locator("#rtx-fx-firework")).toHaveCount(1);

    await ensurePanelOpen(consoleA);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await consoleA.locator("#rtx-reload-btn").click();
    await consoleA.locator("#rtx-fx-firework").waitFor({ state: "detached", timeout: 10000 });
    await expect(consoleA.locator("#rtx-fx-particle")).toHaveCount(1);

    await consoleB.reload({ waitUntil: "domcontentloaded" });
    await consoleB.evaluate(() => window.__rtxConsoleReady.then(() => true));
    await consoleB.locator("#rtx-fx-firework").waitFor({ state: "detached", timeout: 10000 });
    await expect(consoleB.locator("#rtx-fx-particle")).toHaveCount(1);
  } finally {
    await viewerCtx.close();
    await consoleACtx.close();
    await consoleBCtx.close();
  }
});
