// @ts-check
// E2E webServer 前置：把 fixture manifest 引用的特效自 tests/fixtures/ 複製到 tmp/e2e-effects/，
// 確保 uvicorn 啟動前隔離目錄已就緒（來源為 tests/fixtures/，不碰正式 effects/）。
// 由 playwright.config.js 的 webServer command 以 `node tests/e2e/pre-server-copy.mjs && uvicorn …` 執行
// （獨立 .mjs，不依賴 Playwright 的 ESM 轉譯）。
import { cpSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FIXTURE_EFFECTS_DIR = path.resolve(ROOT, "tests", "fixtures");
const TEST_EFFECTS_DIR = path.resolve(ROOT, "tmp", "e2e-effects");
const FIXTURE_MANIFEST_PATH = path.resolve(ROOT, "tests", "fixtures", "effects.json");

rmSync(TEST_EFFECTS_DIR, { recursive: true, force: true });
mkdirSync(TEST_EFFECTS_DIR, { recursive: true });
const manifest = JSON.parse(readFileSync(FIXTURE_MANIFEST_PATH, "utf8"));
const effectIds = Object.keys(manifest.effects || {});
for (const id of effectIds) {
  cpSync(path.join(FIXTURE_EFFECTS_DIR, id), path.join(TEST_EFFECTS_DIR, id), { recursive: true });
}
console.log(`[e2e pre-server-copy] copied ${effectIds.length} effects -> ${TEST_EFFECTS_DIR}`);
