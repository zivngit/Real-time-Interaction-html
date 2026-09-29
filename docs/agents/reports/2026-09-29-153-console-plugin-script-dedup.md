# 工作完成報告

- **日期**：2026-09-29
- **任務**：前端記憶體治理 Phase 1（console）：插件 `<script>` 節點去重與回收（S1）
- **Agent**：opencode

## 摘要

依 `docs/temp/frontend-memory/FRONTEND_MEMORY_PLAN.md` 之 S1（Phase 1）治理 console 前端風險 M1：console 無 SSE，初始載入與手動「重載特效表」皆全量重注入各特效 `console.js` `<script>` 節點且從不移除，`document.head` 節點數隨重載次數無界累積。本次僅改 console（editor 留後續），實作與 viewer S1（152）一致：

- `loadScriptTag(url, effectId, rev)` 對有 `effectId` 的插件 script 設定 `data-rtx-effect="<id>"` 與 `data-rtx-rev="<rev>"`，並以 `inflightConsolePlugins` map 追蹤進行中節點；onload/onerror 以 identity check 清理 map，避免平行載入誤刪較新 entry。
- 新增 `pruneConsolePlugins()`：每次 `loadConsolePlugins` 注入前移除所有已完成插件 script 舊節點（保留進行中者防競態；stale in-flight 節點留待下次 prune），使 `document.head` 插件節點數 ≈ 有 `consoleUrl` 之特效數、不隨重載次數累積。
- `loadEffects()` 初載與 `reloadEffectsTable()` 手動重載皆經 `applyManifest → loadConsolePlugins` 觸發 prune；registry 重置、載入失敗僅 log 回退 schema 渲染等語意不變。
- vm 測試 harness 補 `remove()` 與 `head.querySelectorAll("script[data-rtx-effect]")`；新增 vm 測試驗證手動重載後節點數 3→2 且新節點帶 `data-rtx-rev`。
- E2E `tests/e2e/multi-console-reload.spec.js` 以既有兩 server fixture 驗證：Console A 初載 3 個插件 script（particle/ripple/text，firework 無 `consoleUrl`）、移除 `ripple` 手動重載後 2；Console B 移除 `firework`（無 `consoleUrl`）重載後仍 3。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `console/app.js` | 修改 | `loadScriptTag` 改為 `loadScriptTag(url, effectId, rev)`：插件 script 帶 `data-rtx-effect`／`data-rtx-rev` 並追蹤 in-flight；新增 `pruneConsolePlugins()`；`loadConsolePlugins` 注入前先移除已完成舊插件 script 節點（保留 in-flight） |
| `tests/test_console.mjs` | 修改 | harness 補 `el.remove()` 與 `head.querySelectorAll`（支援 `tag[attr]` 選擇器）；新增「manual reload prunes stale console plugin script nodes」測試（節點數 3→2、新節點 `data-rtx-rev=rev-2`、無 ripple）；vm 測試 72→73 項 |
| `tests/e2e/multi-console-reload.spec.js` | 修改 | 新增 `script[data-rtx-effect]` 節點數斷言：Console A 初載 3、移除 `ripple` 重載後 2；Console B 初載 3、移除 `firework` 重載後 3 |
| `docs/agents/CALL_GRAPH.md` | 修改 | console 初始化 Note 補 `pruneConsolePlugins()` 與插件 script 標記說明；`reloadEffectsTable` 步驟補 prune；Console class diagram 加 `loadScriptTag(url, effectId, rev)`／`pruneConsolePlugins()` |
| `docs/agents/TODO.md` | 修改 | 前端記憶體治理 viewer／console S1 改為簡短 [x] 項；後續 [ ] 項收縮為「Phase 1 剩餘 editor、Phase 2（S2＋S3）、Phase 3（S4＋S5）」 |

> 註：本報告檔本身未列入上方表格。`docs/temp/frontend-memory/` 規劃與改動紀錄文件未受 git 追蹤，不列入異動表。

## 測試與驗證

- 執行命令：`npm run test:unit`
- 結果：通過；pytest 159 項通過＋Node 238 項通過（2026-09-29）

- 執行命令：`npx playwright test multi-console-reload`
- 結果：通過；1 項通過（5.3s，含新節點數斷言 3→2／3→3）

- 執行命令：`npx playwright test`
- 結果：通過；Playwright E2E 87 項通過（2026-09-29 實跑）

## Git Commit

- Commit：`28884f15e9e5300cc1921345fe9e9647a39172df` — `feat(console): 插件 script 節點以 id 標記並回收防止 DOM 累積`

## 後續待辦

- 前端記憶體治理後續（依 `docs/temp/frontend-memory/FRONTEND_MEMORY_PLAN.md`）：Phase 1 剩餘 editor 插件 script 去重回收（S1）、Phase 2 editor 預覽 fetch 文字＋`new Function` 與 `Effects.registry` 收斂（S2＋S3）、Phase 3 ETag 條件請求＋可觀測性（S4＋S5）
