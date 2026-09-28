// @ts-check
import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { TEST_EFFECTS_DIR } from "./tests/e2e/e2e-paths.js";

const baseURL = "http://127.0.0.1:8123";
const testManifest = path.resolve(process.cwd(), "tests/fixtures/effects.json");

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  globalTeardown: "./tests/e2e/global-teardown.js",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // pre-server-copy 先於 uvicorn 執行，確保隔離特效目錄（tmp/e2e-effects/）就緒。
    command:
      "node tests/e2e/pre-server-copy.mjs && python -m uvicorn server.main:app --port 8123 > e2e-server.log 2>&1",
    url: `${baseURL}/health`,
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      SERVE_EXAMPLES: "1",
      RTX_EFFECTS_MANIFEST: testManifest,
      // 特效檔案指向 global-setup 複製的隔離目錄，避免 E2E 改動正式 effects/。
      RTX_EFFECTS_DIR: TEST_EFFECTS_DIR,
    },
    stdout: "ignore",
    stderr: "ignore",
  },
});