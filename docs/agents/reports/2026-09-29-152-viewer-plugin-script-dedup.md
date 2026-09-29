# 工作完成報告

- **日期**：2026-09-29
- **任務**：前端記憶體治理 Phase 1（viewer）：插件 `<script>` 節點去重與回收（S1）
- **Agent**：opencode

## 摘要

依 `docs/temp/frontend-memory/FRONTEND_MEMORY_PLAN.md` 之 S1（Phase 1）治理 viewer 前端風險 M1：每次 SSE `manifest`（rev 變）全量重注入各特效 `viewer.js` `<script>` 節點且從不移除，`document.head` 節點數隨重載次數無界累積。本次僅改 viewer（console/editor 留後續）：

- `loadScript(src, effectId, rev)` 對有 `effectId` 的插件 script 設定 `data-rtx-effect="<id>"` 與 `data-rtx-rev="<rev>"`，並以 `inflightEffectScripts` map 追蹤進行中節點；onload/onerror 以 identity check 清理 map，避免平行載入誤刪較新 entry。
- 新增 `pruneEffectScripts()`：每次 `loadViewerPlugins` 注入前移除所有已完成插件 script 舊節點（保留進行中者防競態；stale in-flight 節點留待下次 prune），使 `document.head` 插件節點數 ≈ 啟用特效數、不隨重載次數累積。
- `start()` 載入 `/viewer/effects.js` 不帶 `effectId`，不受標記與 prune 影響；registry 行為（`Effects.reset()`）、active effects 與 SSE 語意皆不變。
- E2E `tests/e2e/reload-manifest.spec.js` 連續兩次改 manifest（移除 `firework`、`ripple`）驗證 `script[data-rtx-effect]` 節點數 4→3→2（含 `waitRateLimit()` 避開 1/s reload 限頻）。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `viewer/app.js` | 修改 | `loadScript` 改為 `loadScript(src, effectId, rev)`：插件 script 帶 `data-rtx-effect`／`data-rtx-rev` 並追蹤 in-flight；新增 `pruneEffectScripts()`；`loadViewerPlugins` 注入前先移除已完成舊插件 script 節點（保留 in-flight）；載入失敗 log 改用 `effects[id].viewerUrl` |
| `tests/e2e/reload-manifest.spec.js` | 修改 | 新增 `script[data-rtx-effect]` 節點數斷言：initial 4、移除 `firework` reload 後 3、移除 `ripple` reload 後 2；新增第二次 reload 流程（寫 manifest、`waitRateLimit()`、POST `/api/effects/reload`、registry 斷言） |
| `docs/agents/CALL_GRAPH.md` | 修改 | 即時互動序列（viewer 注記與 `loadViewerPlugins` 步驟）與 Viewer class diagram 補 `loadScript(src, effectId, rev)`／`pruneEffectScripts()` 與插件 script 節點回收說明 |
| `docs/agents/TODO.md` | 修改 | 新增 [x] 項「前端記憶體治理 Phase 1（viewer，S1）」與 [ ] 項後續待辦（Phase 1 剩餘 console／editor、Phase 2、Phase 3） |

> 註：本報告檔本身未列入上方表格。`docs/temp/frontend-memory/FRONTEND_MEMORY_PLAN.md` 未受 git 追蹤、僅為規劃文件，不列入異動表。

## 測試與驗證

- 執行命令：`npm run test:unit`
- 結果：通過；pytest 159 項通過＋Node 237 項通過（2026-09-29）

- 執行命令：`npx playwright test reload-manifest`
- 結果：通過；1 項通過（3.9s，含新節點數斷言 4→3→2）

- 執行命令：`npx playwright test`
- 結果：通過；Playwright E2E 87 項通過（2026-09-29 實跑）

## Git Commit

- Commit：`8231138f735873884544ff2df08f9c8a9b34072f` — `feat(viewer): 插件 script 節點以 id 標記並回收防止 DOM 累積`

## 後續待辦

- 前端記憶體治理後續（依 `docs/temp/frontend-memory/FRONTEND_MEMORY_PLAN.md`）：Phase 1 剩餘 console／editor 插件 script 去重回收（S1）、Phase 2 editor 預覽 fetch 文字＋`new Function` 與 `Effects.registry` 收斂（S2＋S3）、Phase 3 ETag 條件請求＋可觀測性（S4＋S5）
