// @ts-check
// E2E 共用路徑。
// 測試特效（manifest＋4 特效檔）集中在 tests/fixtures/（自給自足、不依賴正式 effects/）；
// 隔離工作目錄（tmp/e2e-effects/）由 pre-server-copy 自 tests/fixtures/ 複製 manifest 引用的特效，
// webServer 以 RTX_EFFECTS_DIR 指向它，讓 E2E 只動 tmp/、不碰正式 effects/。
import path from "node:path";

const ROOT = process.cwd();

export const FIXTURE_EFFECTS_DIR = path.resolve(ROOT, "tests", "fixtures");
export const TEST_EFFECTS_DIR = path.resolve(ROOT, "tmp", "e2e-effects");
export const FIXTURE_MANIFEST_PATH = path.resolve(ROOT, "tests", "fixtures", "effects.json");
