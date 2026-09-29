# 工作完成報告

- **日期**：2026-09-29
- **任務**：前端記憶體治理 Phase 3（console）：console 插件 per-effect `consoleRev` cache-busting（S4 剩餘）
- **Agent**：opencode

## 摘要

依 `docs/temp/frontend-memory/FRONTEND_MEMORY_PLAN.md` 之 S4 剩餘項，將 console 端 console 插件的 `?v=` cache-buster 由 catalog 級 global `rev` 改為 per-effect `consoleRev`（server 端 `consoleRev` 與 ETag/304 已於 154 就緒）：console 手動重載（`reloadEffectsTable`）時，未變 console 插件因 ETag 304 只重驗證、不重新下載執行；僅內容變更的插件 200 重新注入。無 `consoleRev` 時 fallback manifest `rev`（與 viewer 相同契約）。

- `console/app.js` `normalizeEffects()`：每 entry 加 `consoleRev: e.consoleRev || null`。
- `console/app.js` `loadConsolePlugins()`：`?v=` 改以 per-effect `spec.consoleRev || rev` 注入（`data-rtx-rev` 同值）；`pruneConsolePlugins()`／in-flight 追蹤等 S1 機制不變。
- 測試：`tests/test_console.mjs` 新增 per-effect `consoleRev`＋fallback 測試（particle 有 `consoleRev` 斷言 `?v=<consoleRev>`、ripple 無則 fallback `?v=<manifest rev>`；`data-rtx-rev` 同值）；`tests/e2e/reload-manifest.spec.js` 於 consoleA 手動重載後讀取 `script[data-rtx-effect]` 節點（particle＋text），斷言每節點 `data-rtx-rev` 等於該 `console.js` 內容 SHA-256。
- 文件同步：`CALL_GRAPH.md`（console 靜態路由邊加 `?v=consoleRev`、console 流程備註與 `reloadEffectsTable` 步驟補 per-effect rev＋304、test_console 74 項）、`HOW_TO_ADD_EFFECT.md`（per-effect cache-busting 改 viewer／console 雙端）、`README.md`（測試計數：pytest 161、node 239）、`TODO.md`（Phase 3 console S4 列 [x]、後續項收縮為 Phase 1 剩餘 editor、Phase 2、S5）。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `console/app.js` | 修改 | `normalizeEffects()` 加 `consoleRev`；`loadConsolePlugins()` 以 per-effect `spec.consoleRev || rev` 做 `?v=` cache-busting（`data-rtx-rev` 同步） |
| `tests/test_console.mjs` | 修改 | 新增「console plugins use per-effect consoleRev for cache-busting and fall back to global rev」；node vm 測試 73→74 項 |
| `tests/e2e/reload-manifest.spec.js` | 修改 | consoleA 手動重載後斷言 console 插件節點（particle＋text）`data-rtx-rev` 等於 `console.js` 內容 SHA-256 |
| `docs/agents/CALL_GRAPH.md` | 修改 | console 靜態路由邊加 `?v=consoleRev`；console 初始化備註與 `reloadEffectsTable` 步驟補 per-effect `?v=consoleRev`（缺時 fallback）＋ETag 304；test_console 74 項、reload-manifest 描述補 console per-effect rev |
| `docs/HOW_TO_ADD_EFFECT.md` | 修改 | per-effect cache-busting 說明改 viewer／console 雙端（`?v=viewerRev`／`?v=consoleRev`） |
| `README.md` | 修改 | 測試計數更新：pytest 159→161（`test_api` 61→63）、node 237→239（`test_console` 72→74） |
| `docs/agents/TODO.md` | 修改 | Phase 3（console，S4 剩餘）列 [x]；後續項收縮為「Phase 1 剩餘 editor、Phase 2（S2＋S3）、Phase 3（S5 可觀測性）」；node vm 計數 74 項；多 viewer 負載項補 server SSE 背壓說明（無界 `asyncio.Queue`，`server/main.py:155`、`server/relay.py:30`） |

> 註：本報告檔本身未列入上方表格。`docs/temp/frontend-memory/` 規劃與改動紀錄文件未受 git 追蹤，不列入異動表。

## 測試與驗證

- 執行命令：`npm run test:unit`
- 結果：通過；pytest 161 項通過＋Node 239 項通過（238＋1 新；2026-09-29 實跑）

- 執行命令：`npx playwright test tests/e2e/reload-manifest.spec.js`
- 結果：通過；1 項通過（7.9s，含 console 插件 per-effect `consoleRev`＝`console.js` SHA-256 斷言）

- 執行命令：`npx playwright test`
- 結果：通過；Playwright E2E 87 項通過（3.6m，2026-09-29 實跑）

## Git Commit

- Commit：`3556e58` — `feat(console): 插件 per-effect consoleRev cache-busting（S4 剩餘）`

## 後續待辦

- 前端記憶體治理後續（依 `docs/temp/frontend-memory/FRONTEND_MEMORY_PLAN.md`）：Phase 1 剩餘 editor 插件 script 去重回收（S1）、Phase 2 editor 預覽 fetch 文字＋`new Function` 與 `Effects.registry` 收斂（S2＋S3）、Phase 3 可觀測性（S5）
