# 工作完成報告

- **日期**：2026-09-29
- **任務**：前端記憶體治理 Phase 3（viewer＋server）：per-effect 插件 rev＋靜態資產 ETag 條件請求（S4）
- **Agent**：opencode

## 摘要

依 `docs/temp/frontend-memory/FRONTEND_MEMORY_PLAN.md` 之 S4（Phase 3）治理 viewer／server 靜態資產治理缺口：manifest 的 `rev` 為整個 catalog 的 fingerprint，任何特效變更都使所有 viewer 插件 URL 的 `?v=rev` 失效並重新下載＋執行全部插件（即使內容未變）。本次實作（範圍限 viewer＋server；console 的 per-effect rev 留後續）：

- `server/effects.py` `_sanitize_effect()`：每個特效 entry 新增 `viewerRev`（該特效 `viewer.js` 內容 SHA-256）與 `consoleRev`（有 `console.js` 時其 SHA-256，否則 `null`）；`GET /api/effects` 與 SSE `manifest` 事件隨之携带。
- `server/static_files.py`：`file_response`／`effect_asset` 主體與插件資產 `Cache-Control: no-store` → `no-cache`；新增 `request` 參數與 `_etag_matches()`／`_conditional()`，`If-None-Match` 命中 `ETag`（含 `*`、多值、`W/` 弱校驗）回 `304`（僅 `ETag`＋`Cache-Control`，空 body）。Starlette `FileResponse` 只算 ETag 不處理條件請求，故於本層實作。
- `server/main.py`：8 個靜態路由（viewer/console 主體、effects.json、`/effects/{id}/viewer.js|console.js`）改傳 `request`；editor 路由與 `examples_response` 維持 `no-store` 不變。
- `viewer/app.js` `loadViewerPlugins()`：`?v=` 改以 per-effect `spec.viewerRev || rev` 注入（`data-rtx-rev` 同值）；`currentRev`、prune、in-flight 追蹤等 S1 機制不變。未變插件因 ETag 304 只重驗證、不重新下載執行；僅內容變更的插件 200 重新注入。
- 測試：`tests/test_api.py` 8 項 no-store 斷言改 no-cache＋2 新測試（per-effect rev 對照 fixture SHA-256、靜態資產 If-None-Match 304）；`tests/e2e/reload-manifest.spec.js` 改用 temp 副本 effects 目錄（`fs.cpSync` 自 `tests/fixtures`），以 Playwright `response` 事件記錄插件請求：初載 4 個 200 且 `?v=` 等於 per-effect SHA-256；manifest reload 未變 → 重載的 3 個插件全 304；內容變更（append `text/viewer.js`）reload → `text` 200 新 rev、`particle` 304。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `server/effects.py` | 修改 | `_sanitize_effect()` 每 entry 加 `viewerRev`／`consoleRev`（插件檔內容 SHA-256，無 `console.js` 則 `null`） |
| `server/static_files.py` | 修改 | 新增 `NO_CACHE`、`_etag_matches()`、`_conditional()`；`file_response`／`effect_asset` 加 `request` 參數、`no-cache`＋`ETag`，`If-None-Match` 命中回 304；`effect_asset` 由 `no-store` 改 `no-cache`；`examples_response` 維持 `no-store` |
| `server/main.py` | 修改 | 8 個靜態路由加 `request: Request` 並傳入 `file_response`／`effect_asset` |
| `viewer/app.js` | 修改 | `loadViewerPlugins()` 以 per-effect `spec.viewerRev || rev` 做 `?v=` cache-busting（`data-rtx-rev` 同步） |
| `tests/test_api.py` | 修改 | 8 項 no-store 斷言改 no-cache；新增 `test_effects_list_includes_per_effect_rev`、`test_static_assets_support_conditional_requests`；pytest 61→63 項 |
| `tests/e2e/reload-manifest.spec.js` | 修改 | effects 目錄改 temp 副本（`fs.cpSync`）；`response` 事件收集插件請求；初載 200＋`?v=`=SHA-256、未變 reload 304、內容變更 200／304 混合與 rev 變更斷言 |
| `docs/agents/CALL_GRAPH.md` | 修改 | 靜態路由邊改 no-cache＋ETag；SSE manifest 事件補 per-effect rev；`loadViewerPlugins` 步驟補 `?v=viewerRev`＋304 重驗證；StaticFiles class 加 `request` 參數與 `_etag_matches`／`_conditional`；test_api 61→63、reload-manifest 描述補 ETag 304；最後更新 2026-09-29 |
| `docs/HOW_TO_ADD_EFFECT.md` | 修改 | §6 靜態路由說明改 no-cache＋ETag＋304；補 `viewerRev`／`consoleRev` 說明 |
| `docs/agents/TODO.md` | 修改 | Phase 3（viewer＋server，S4）列 [x]；後續項收縮為「Phase 1 剩餘 editor、Phase 2（S2＋S3）、Phase 3（S4 剩餘 console per-effect rev、S5 可觀測性）」 |

> 註：本報告檔本身未列入上方表格。`docs/temp/frontend-memory/` 規劃與改動紀錄文件未受 git 追蹤，不列入異動表。

## 測試與驗證

- 執行命令：`npm run test:unit`
- 結果：通過；pytest 161 項通過（159＋2 新）＋Node 238 項通過（2026-09-29）

- 執行命令：`npx playwright test tests/e2e/reload-manifest.spec.js`
- 結果：通過；1 項通過（5.1s，含 304/200 重驗證與 per-effect rev 斷言）

- 執行命令：`npx playwright test`
- 結果：通過；Playwright E2E 87 項通過（2026-09-29 實跑）

## Git Commit

- Commit：`ece63b2551b4496b34c0ccf9f77410e4077b838c` — `feat(viewer): 插件 per-effect rev 與靜態資產 ETag 條件請求（S4）`

## 後續待辦

- 前端記憶體治理後續（依 `docs/temp/frontend-memory/FRONTEND_MEMORY_PLAN.md`）：Phase 1 剩餘 editor 插件 script 去重回收（S1）、Phase 2 editor 預覽 fetch 文字＋`new Function` 與 `Effects.registry` 收斂（S2＋S3）、Phase 3 console per-effect `consoleRev` 運用（S4 剩餘）＋可觀測性（S5）
