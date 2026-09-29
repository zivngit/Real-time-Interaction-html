# 工作完成報告

- **日期**：2026-09-30
- **任務**：前端記憶體治理 Phase 1（editor）：插件 script 節點標記回收防 DOM 累積（S1）＋per-effect rev cache-busting
- **Agent**：opencode

## 摘要

依 `docs/temp/frontend-memory/FRONTEND_MEMORY_PLAN.md` 之 Phase 1 剩餘項（S1），為 `editor/app.js` 兩條插件載入路徑加上 script 節點標記與回收，使重覆預覽／存檔／重載不會讓舊 script 節點在 DOM 累積；並把 editor 端 cache-busting 由 global `rev` 改為 per-effect `viewerRev`／`consoleRev`（缺時 fallback manifest `rev`），與 viewer／console 契約一致。

- `editor/app.js` `loadScript(src, effectId, rev)`（簽名由單參改三參）：有 `effectId` 時節點帶 `data-rtx-effect`／`data-rtx-rev` 並記入 `inflightPreviewScripts`；注入前 `prunePreviewScripts()`（`document.body` preview 容器，移除已完成舊節點、保留 in-flight）；有 `rev` 時 `?v=<rev>`，無則沿用 `?t=<nowMs()>`；onload/onerror 以 identity check 移除 in-flight entry。
- `editor/app.js` `injectPlugin`（preview 路徑）：`loadScript(url, id, spec.viewerRev || state.rev)`。
- `editor/app.js` `loadConsolePlugin(id, spec, rev)`：`effRev = spec.consoleRev || rev`；`pluginCache` key 由 `id+'\u0000'+rev` 改 `id+'\u0000'+effRev`、`?v=effRev`；新節點帶 `data-rtx-effect`／`data-rtx-rev`、注入前 `pruneConsolePlugins()`（`document.head` mini-console 容器）並記入 `inflightConsolePlugins`；onload/onerror identity check。
- core `/viewer/effects.js` 經 `loadScript(src)` 無標記、不受 prune 影響；`pluginCache` 語意（同 id＋effRev 命中不重複載入）不變；editor 靜態資產維持 no-store（不接 ETag，S4 剩餘）。
- 測試：`tests/test_editor.mjs` 新增 4 項 S1（128→132）——preview 插件 `?v=viewerRev`（fallback `state.rev`）＋標記＋同 id 重注入取代＋core 不受 prune、preview（body）與 mini-console（head）同 id 並存各容器獨立 prune、console 插件優先用 `spec.consoleRev`（cache key／`?v=`／標記）、in-flight 節點保留；更新 2 項既有斷言（3b 重預覽／重注入 3→1 取代不疊加、5f 新 rev 取代舊節點 2→1）；`tests/e2e/editor.spec.js`（59→60）新增「重覆預覽／存檔／rev 變化：body 與 head 的 `script[data-rtx-effect]` 不累積」（phase A 首次預覽→B 停止再預覽→C 暫停＋暫存 viewer 代碼＋[保存] PUT manifest→D 外部改 viewer.js＋[重載]；含 `addInitScript` window error 捕捉＋phase marks 診斷輸出）。
- E2E 實作注意：切 viewer tab 後 `loadCodeFile()` 為 async，fetch 期間 `#ed-code` 仍為舊 effects.json 內容——需 `waitForResponse('/api/editor/effect/particle/viewer.js')`＋`expect.poll` 等確為 viewer.js 再操作；server GET 端點用 `read_text()`（universal newlines，CRLF→LF），故以 `viewerBytes.replace(/\r\n/g, '\n')` 比對。
- 文件同步：`README.md`（node 239→243、`test_editor` 128→132、E2E 87→88、`editor.spec.js` 59→60＋S1 項）、`docs/agents/TODO.md`（計數＋[x]「Phase 1（editor，S1）」＋後續項收縮）、`docs/agents/CALL_GRAPH.md`（EditorPage class 加 inflight map／prune 函式／`loadScript(src, effectId, rev)`、`pluginCache` key、兩條 Effects 邊 per-effect `?v=`＋標記＋prune、test_editor 132、E2E 88／editor.spec 60＋S1）、`docs/HOW_TO_ADD_EFFECT.md`（per-effect cache-busting 補 editor 端＋`data-rtx-effect`／prune 標記）。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `editor/app.js` | 修改 | `loadScript` 改三參簽名（標記＋in-flight＋`?v=<rev>`）；新增 `inflightPreviewScripts`／`prunePreviewScripts()`／`inflightConsolePlugins`／`pruneConsolePlugins()`；`injectPlugin` per-effect `viewerRev`；`loadConsolePlugin` `effRev = spec.consoleRev \|\| rev`（pluginCache key、`?v=`、標記、prune） |
| `tests/test_editor.mjs` | 修改 | 新增 4 項 S1 測試＋更新 2 項既有斷言；harness 補 `el.remove()` 與 `matchSel` 複合選擇器；128→132 項 |
| `tests/e2e/editor.spec.js` | 修改 | 新增 1 項 S1 計數穩定測試（body／head `script[data-rtx-effect]` 不累積）；59→60 項 |
| `README.md` | 修改 | 測試計數：node 239→243（`test_editor` 128→132）、Playwright E2E 87→88（`editor.spec.js` 59→60＋S1 說明） |
| `docs/agents/CALL_GRAPH.md` | 修改 | EditorPage class 加 S1 成員與 `loadScript(src, effectId, rev)`；`EditorPage ..> Effects`／console.js 邊 per-effect `?v=`＋標記＋prune；test_editor 132、E2E 88（editor.spec 60＋S1） |
| `docs/agents/TODO.md` | 修改 | 已知優先風險計數（E2E 88、editor.spec 60、test_editor 132）；[x]「Phase 1（editor，S1）」；後續項收縮為「Phase 2（S2＋S3）、Phase 3（S5 可觀測性）」 |
| `docs/HOW_TO_ADD_EFFECT.md` | 修改 | per-effect cache-busting 說明補 editor 端＋`data-rtx-effect`／prune 標記 |

> 註：本報告檔本身未列入上方表格。`docs/temp/frontend-memory/` 規劃與改動紀錄文件未受 git 追蹤，不列入異動表。

## 測試與驗證

- 執行命令：`npm run test:unit`
- 結果：通過；pytest 161 項通過＋Node 243 項通過（239＋4 新 S1；2026-09-30 實跑）

- 執行命令：`npx playwright test`
- 結果：通過；Playwright E2E 88 項通過（87＋1 新 editor S1；2026-09-30 實跑）

## Git Commit

- Commit：`ebafb5c` — `feat(editor): 插件 script 節點標記回收防 DOM 累積、per-effect rev cache-busting（Phase 1 editor S1）`

## 後續待辦

- 前端記憶體治理後續（依 `docs/temp/frontend-memory/FRONTEND_MEMORY_PLAN.md`）：Phase 2（S2＋S3：editor 預覽 fetch 文字＋`new Function` 與 `Effects.registry` 收斂）、Phase 3 可觀測性（S5）；editor 端靜態資產 ETag 條件請求（S4 剩餘）
