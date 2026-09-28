// @ts-check
// E2E globalTeardown：移除 global-setup 建立的隔離特效目錄。
import { rmSync } from "node:fs";
import { TEST_EFFECTS_DIR } from "./e2e-paths.js";

export default function globalTeardown() {
  rmSync(TEST_EFFECTS_DIR, { recursive: true, force: true });
  console.log(`[e2e globalTeardown] removed ${TEST_EFFECTS_DIR}`);
}
