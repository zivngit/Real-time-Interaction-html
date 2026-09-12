// @ts-check
import { test, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { ensurePanelOpen, TEST_EFFECTS } from "./helpers.js";

const ROOT = process.cwd();
const KEY_A = "multi-console-a-key";
const KEY_B = "multi-console-b-key";
const INITIAL_A = "A 初始粒子";
const RELOADED_A = "A 重載粒子";
const INITIAL_B = "B 初始粒子";
const RELOADED_B = "B 重載粒子";
const REMOVED_A = "ripple";
const REMOVED_B = "firework";

let childA = null;
let childB = null;
let tempDir = null;
let baseA = "";
let baseB = "";
let manifestPathA = "";
let manifestPathB = "";

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

function writeManifest(name, label) {
  const fixture = path.join(ROOT, "tests", "fixtures", "effects.json");
  const raw = JSON.parse(fs.readFileSync(fixture, "utf8"));
  raw.effects.particle.label = label;
  const target = path.join(tempDir, `effects-${name}.json`);
  fs.writeFileSync(target, JSON.stringify(raw, null, 2) + "\n", "utf8");
  return target;
}

async function waitForServer(base, getLog) {
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
  throw new Error(`isolated uvicorn server did not become ready for ${base}\n${getLog()}`);
}

async function startServer(name, key, label) {
  const port = await getFreePort();
  const base = `http://127.0.0.1:${port}`;
  const manifestPath = writeManifest(name, label);

  const venvPython = path.join(
    ROOT,
    process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python"
  );
  const python = fs.existsSync(venvPython) ? venvPython : "python";

  const server = {
    base,
    manifestPath,
    log: "",
    child: spawn(
      python,
      ["-m", "uvicorn", "server.main:app", "--host", "127.0.0.1", "--port", String(port)],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          ACCESS_KEY: key,
          RTX_EFFECTS_MANIFEST: manifestPath,
          SERVE_EXAMPLES: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      }
    ),
  };
  server.child.stdout.on("data", (data) => {
    server.log += data.toString();
  });
  server.child.stderr.on("data", (data) => {
    server.log += data.toString();
  });

  await waitForServer(base, () => server.log);
  return server;
}

function stopServer(child) {
  if (child) {
    child.kill();
  }
}

test.beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rtx-multi-reload-"));
  const a = await startServer("a", KEY_A, INITIAL_A);
  childA = a.child;
  baseA = a.base;
  manifestPathA = a.manifestPath;

  const b = await startServer("b", KEY_B, INITIAL_B);
  childB = b.child;
  baseB = b.base;
  manifestPathB = b.manifestPath;
});

test.afterAll(async () => {
  stopServer(childA);
  stopServer(childB);
  childA = null;
  childB = null;
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

test("multiple consoles with different server URL and key reload independently with selected-effect fallback", async ({ browser }) => {
  const consoleACtx = await browser.newContext();
  await consoleACtx.addInitScript(({ url, key }) => {
    localStorage.setItem("rtx.srvUrl", url);
    localStorage.setItem("rtx.srvKey", key);
  }, { url: baseA, key: KEY_A });
  const consoleA = await consoleACtx.newPage();

  const consoleBCtx = await browser.newContext();
  await consoleBCtx.addInitScript(({ url, key }) => {
    window.CONTROL_CONFIG = { url, key };
  }, { url: baseB, key: KEY_B });
  const consoleB = await consoleBCtx.newPage();

  try {
    const aEffects = consoleA.waitForResponse(
      (resp) => resp.url().startsWith(baseA) && resp.url().endsWith("/api/effects") && resp.ok()
    );
    await consoleA.goto(baseA + "/examples/embed-console.html", { waitUntil: "domcontentloaded" });
    const aInitial = await (await aEffects).json();
    expect(Object.keys(aInitial.effects).sort()).toEqual([...TEST_EFFECTS].sort());
    expect(aInitial.effects.particle.label).toBe(INITIAL_A);
    await consoleA.evaluate(() => window.__rtxConsoleReady.then(() => true));
    await expect(consoleA.locator("#rtx-srv-url")).toHaveValue(baseA);
    await expect(consoleA.locator("#rtx-srv-key")).toHaveValue(KEY_A);
    await expect(consoleA.locator("#rtx-fx-particle")).toHaveAttribute("aria-label", INITIAL_A);
    await ensurePanelOpen(consoleA);
    await consoleA.locator(`#rtx-fx-${REMOVED_A}`).click();
    await expect(consoleA.locator(`#rtx-fx-${REMOVED_A}`)).toHaveClass(/selected/);

    const bEffects = consoleB.waitForResponse(
      (resp) => resp.url().startsWith(baseB) && resp.url().endsWith("/api/effects") && resp.ok()
    );
    await consoleB.goto(baseB + "/examples/embed-console.html", { waitUntil: "domcontentloaded" });
    const bInitial = await (await bEffects).json();
    expect(Object.keys(bInitial.effects).sort()).toEqual([...TEST_EFFECTS].sort());
    expect(bInitial.effects.particle.label).toBe(INITIAL_B);
    await consoleB.evaluate(() => window.__rtxConsoleReady.then(() => true));
    await expect(consoleB.locator("#rtx-srv-url")).toHaveValue(baseB);
    await expect(consoleB.locator("#rtx-srv-key")).toHaveValue(KEY_B);
    await expect(consoleB.locator("#rtx-fx-particle")).toHaveAttribute("aria-label", INITIAL_B);
    await ensurePanelOpen(consoleB);
    await consoleB.locator(`#rtx-fx-${REMOVED_B}`).click();
    await expect(consoleB.locator(`#rtx-fx-${REMOVED_B}`)).toHaveClass(/selected/);

    const manifestA = JSON.parse(fs.readFileSync(manifestPathA, "utf8"));
    manifestA.effects.particle.label = RELOADED_A;
    delete manifestA.effects[REMOVED_A];
    fs.writeFileSync(manifestPathA, JSON.stringify(manifestA, null, 2) + "\n", "utf8");

    await ensurePanelOpen(consoleA);
    await consoleA.locator("#rtx-conn-btn").click();
    await consoleA.locator("#rtx-reload-btn").click();
    await expect(consoleA.locator("#rtx-fx-particle")).toHaveAttribute("aria-label", RELOADED_A, { timeout: 10000 });
    await expect(consoleA.locator(`#rtx-fx-${REMOVED_A}`)).toHaveCount(0);
    await expect(consoleA.locator("#rtx-fx-particle")).toHaveClass(/selected/);
    await expect(consoleB.locator("#rtx-fx-particle")).toHaveAttribute("aria-label", INITIAL_B);
    await expect(consoleB.locator(`#rtx-fx-${REMOVED_B}`)).toHaveClass(/selected/);

    const manifestB = JSON.parse(fs.readFileSync(manifestPathB, "utf8"));
    manifestB.effects.particle.label = RELOADED_B;
    delete manifestB.effects[REMOVED_B];
    fs.writeFileSync(manifestPathB, JSON.stringify(manifestB, null, 2) + "\n", "utf8");

    await ensurePanelOpen(consoleB);
    await consoleB.locator("#rtx-conn-btn").click();
    await consoleB.locator("#rtx-reload-btn").click();
    await expect(consoleB.locator("#rtx-fx-particle")).toHaveAttribute("aria-label", RELOADED_B, { timeout: 10000 });
    await expect(consoleB.locator(`#rtx-fx-${REMOVED_B}`)).toHaveCount(0);
    await expect(consoleB.locator("#rtx-fx-particle")).toHaveClass(/selected/);
    await expect(consoleA.locator("#rtx-fx-particle")).toHaveAttribute("aria-label", RELOADED_A);
    await expect(consoleA.locator(`#rtx-fx-${REMOVED_A}`)).toHaveCount(0);
    await expect(consoleA.locator("#rtx-fx-particle")).toHaveClass(/selected/);
  } finally {
    await consoleACtx.close();
    await consoleBCtx.close();
  }
});
