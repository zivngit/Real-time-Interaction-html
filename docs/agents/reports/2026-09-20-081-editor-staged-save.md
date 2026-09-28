# 工作完成報告

- **日期**：2026-09-20
- **任務**：effects 編輯器子任務 5d — 特效列表操作改為 staged（按[保存]才寫入）
- **Agent**：opencode（effects 編輯器專案 implementer）

## 摘要

依 `docs/temp/effects-editor/sub_agents/sub_agent_5/task_5d/PLAN.md` 完成 CHECK.md 項 8a、8b：fx-list 所有列表操作改為 staged（只改本地 state＋dirty、不發 server 請求），按[保存]統一 `PUT /api/editor/manifest` 寫入：

1. **staged 化（CHECK 項 8a）**：`setEnabled()`（個別啟用/停用）、`removeEffect()`（移除＋是否連同刪插件檔）、`batchApply()`／`batchMove()`（批次啟用/停用/改 category/移區）、`commitMove()`（拖曳同區排序／跨區移動）、`newEffect()`（新增 entry）、`doImportEntry()`（單項 effects.json 匯入，見偏差 1）一律只改本地 `state.manifest`＋`setDirty(true)`＋UI 重繪，不再發 PUT/DELETE。`[匯入 effects.zip]`（`POST /api/editor/import`）依 PLAN 維持立即 server 操作。
2. **刪除 staged 化**：`removeEffect()` 雙層確認（是否移除／是否連同刪除 `effects/<id>/` 檔案）後本地移除，並 push 至 `state.pendingDeletes`（結構見「給 5e/5f 的交接」）；列表於原區 append `［待刪·含檔案］`／`［待刪］` 列（`.fx-item.pending-delete`，含 `↺` 還原按鈕 `undoPendingDelete()`，dragover 跳過待刪列）。
3. **[保存] 統一寫入（CHECK 項 8b）**：`save()` 的 PUT body 為 `{manifest: buildManifest(), baseRev: state.baseRev, deleteRemoved}`——`deleteRemoved` 為 `deleteFiles: true` 的 pendingDeletes id **陣列**（無待刪時 `false`）。`server/editor.py` `ManifestBody.deleteRemoved` 由 bool 擴為 `bool | list[str]`：`true`＝刪全部 removed ids、`false`＝不刪、`list[str]`＝只刪列出且在 removed ids 中的 id（PLAN 預期「單一旗標不夠」的最小改動方案，見偏差 2）。200→`loadManifest()` 重抓（清 `pendingDeletes`＋dirty）＋`save succeeded`；409→重抓＋`409 conflict`；429 依 `Retry-After` 重試；400/401/network 顯示訊息（皆維持 2c 行為）。未保存關閉的 dirty 警告為 2b 既有 `beforeunload` 行為，staged 操作皆觸發 dirty 故覆蓋完整。
4. **[重載] 與 staged 互動**：`reloadManifest()` 於 `state.dirty` 時 `confirm('有未保存變更，重載將遺失。放棄變更並重載？')`——取消則不發任何請求；確認才 `POST /api/effects/reload`＋重抓（`loadManifest()` 清 staged）。
5. **渲染一致性**：`selectItem(id)` 同 id 跳過 `renderMeta`／`renderParams`（保留 staged DOM 編輯不重繪）；`renderList()` 保留目前選取（不跳回首項）。凡「選取項內容被非 selectItem 路徑改動」的情境（`loadManifest()` 重抓且選取不變、`newEffect()`、`doImportEntry()` 匯入選取項）皆明確補 `renderMeta`／`renderParams`，避免 `buildManifest()` 把 stale DOM 值（如舊 label）寫回 manifest（E2E 單項匯入測試抓到並修正）。
6. `window.__rtxEditor` version `'5c'`→`'5d'`，新增 `undoPendingDelete(index)` 匯出。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `editor/app.js` | 修改 | `state` 加 `pendingDeletes: []`；`setEnabled`／`removeEffect`（改 push `pendingDeletes`、新增 `buildPendingItem` 待刪列）／`batchApply`／`batchMove`／`commitMove`（本地改 layout、無變化不設 dirty）／`newEffect`（本地加 entry＋選取＋補 meta/params 重繪）／`doImportEntry`（本地合併 entry，匯入選取項時補重繪）全改 staged；新增 `undoPendingDelete(index)`；`save()` PUT body 帶 `deleteRemoved`（pendingDeletes 中 `deleteFiles: true` 的 id 陣列或 `false`）；`loadManifest()` 清 `pendingDeletes`＋dirty、選取不變時補 `renderMeta`／`renderParams`；`selectItem()` 同 id 跳過重繪；`renderList()` 保留選取＋append 待刪列；dragover 跳過 `.pending-delete`；`reloadManifest()` dirty 時 `confirm` 中斷；version `'5d'`＋`undoPendingDelete` 匯出（2402 行） |
| `server/editor.py` | 修改 | `ManifestBody.deleteRemoved: bool | list[str] = False`；`put_manifest()` 依契約算 `delete_ids`（true→全部 removed ids、false→不刪、list→只刪列出且在 removed ids 的 id）（727 行） |
| `editor/index.html` | 修改 | fx-list hint 文案改為「所有操作為暫存（staged），按[保存]才寫入 server」（168 行） |
| `editor/style.css` | 修改 | 新增 `.fx-item.pending-delete`（淡色＋虛線邊）、`.rm.restore`（↺ 還原按鈕樣式）（743 行） |
| `tests/test_editor.mjs` | 修改 | 45→53 項：5c 單項匯入 2 項改 staged 斷言（本地合併＋dirty、無 PUT、[保存]才 PUT）；新增 5d 8 項（setEnabled staged、removeEffect staged＋`undoPendingDelete` 還原、deleteFiles 保存送 `deleteRemoved` 陣列／無待刪送 `false`、batchApply/batchMove staged、commitMove staged、newEffect staged＋PUT 新 entry、[重載] dirty confirm guard、[保存] 409 重抓清 staged）；harness fake `GET /api/editor/manifest` 改回傳 payload 深拷貝（避免 staged 就地修改污染「server」側 fixture，見偏差 4）；helper `itemRmBtn()`／`itemSwitchInput()`（1966 行） |
| `tests/e2e/editor.spec.js` | 修改 | 28 項（計數不變）：2d 3 項（拖曳/批次/新增+刪除）與 5c 單項匯入 1 項改 staged 流程——操作後斷言無 PUT/DELETE（`countMutations()` 計數）＋磁碟 fixture 不變→[保存]→斷言 manifest 變更與 `effects/<id>/` 目錄建立/刪除；helper `countMutations(page)`／`zoneIds(page, sel)`（1319 行） |
| `tests/test_editor_api.py` | 修改 | 65→67 項：新增 `test_put_manifest_delete_removed_list_only_named`（list 只刪列出的 removed id、其餘目錄保留）、`test_put_manifest_delete_removed_list_ignores_non_removed`（list 含非 removed id 被忽略）（846 行） |
| `docs/agents/TODO.md` | 修改 | 新增「子任務 5d」進度子項（106 行） |
| `docs/agents/CALL_GRAPH.md` | 修改 | ED 節點補 `deleteRemoved` 契約（true/false/list[str]）；EDOP 節點補 deleteRemoved 刪目錄；`EditorPage` class state 加 `pendingDeletes`、加 `undoPendingDelete(index)`；EDP 節點加 5d 說明；TED 65→67、TEX 45→53（5d 描述）、TP editor.spec.js 28 項補 5d staged 流程描述；§7 `editor/` 行加 5d（511 行） |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：`npm run test`（5d 大改 E2E，依 PLAN 跑全套）
- 結果：全綠
  - `python -m pytest tests/ -q`：141 passed（含 editor 67 項；2 warnings 為既有 httpx/anyio deprecation）
  - `node --test`（5 支 mjs）：162 passed（含 `test_editor.mjs` 53 項）
  - `npx playwright test`（全部 10 支 spec）：56 passed（含 `editor.spec.js` 28 項）
- `git status`：E2E 跑完後工作樹乾淨（describe `beforeAll`/`afterEach` snapshot/restore fixture bytes＋刪 `createdFxDirs`＋`POST /api/effects/reload`，無污染殘留）

## 與規格的偏差

1. **單項 effects.json 匯入（`doImportEntry`）也改 staged**：PLAN 範圍列 5 類操作未含 5c 的單項匯入（當時為立即 PUT）。因其本質亦為「改 manifest entry」的列表操作，統一改為本地合併＋dirty、[保存]才 PUT（zip 匯入 `POST /api/editor/import` 維持立即，依 PLAN）。行為與 PLAN 精神一致，测试已固定。
2. **`deleteRemoved` 契約擴充**：既有契約為單一 bool（true＝刪全部被移除特效的目錄），無法表達「部分待刪含檔案、部分不含」。採 PLAN 預期的最小改動：`bool | list[str]`（list＝只刪列出的 removed ids）；client 只在有 `deleteFiles: true` 待刪時送陣列。server 端 list 會再與 removed ids 交集，防誤刪。
3. **`pendingDeletes` 結構超集**：PLAN 最小結構為 `{id, deleteFiles}`；實作補 `spec`／`zone`／`index`（移除前快照與位置）以支援 `↺` 還原（`undoPendingDelete`）與待刪列重繪，屬 UI 便利、不影響 PUT 契約（PUT 只用 `id`＋`deleteFiles`）。
4. **vm harness fake server 補深拷貝**：fake `GET /api/editor/manifest` 原回傳 payload 同一物件參照，staged 就地修改 `state.manifest` 會污染「server」側 fixture（409 重抓測試抓出）；改回傳深拷貝以模擬真實 server 每次 GET 回新 JSON。

## Git Commit

- Commit：`b1da269` — `refactor(editor): 特效列表操作改為暫存，按保存統一寫入`

## 給 5e/5f 的交接

- **staged state 結構**（`window.__rtxEditor.state`）：
  - `pendingDeletes: [{id, deleteFiles, spec, zone, index}]`——`spec`/`zone`/`index` 為移除前快照（供 `↺` 還原與待刪列重繪）；PUT 契約只用 `id`＋`deleteFiles`。
  - 其他 staged 變更直接反映在 `state.manifest`（`effects`／`currentEffects`／`alternateEffects`／`enabled`／category…），`state.dirty` 為統一標記。
- **`save()` 最終 PUT body**：`{manifest: buildManifest(), baseRev: state.baseRev, deleteRemoved: string[] | false}`——`buildManifest()` 深拷貝 `state.manifest` 並把**選取項**的 meta（label/category/icon/viewer/console/enabled）與 params 自 DOM 合併回填（含 viewer/console 預設值填補）；`deleteRemoved` 為 `deleteFiles: true` 待刪 id 陣列（無則 `false`）。200→重抓清 staged；409→重抓（staged 全清，顯示 `409 conflict: manifest was changed, refetched latest`）；429 重試；400/401/network 顯示訊息。
- **[重載] 互動**：dirty 時 `confirm`（取消→不發請求、staged 保留；確認→`POST /api/effects/reload`＋重抓、staged 清）。
- **渲染規則**（5f 改列表 icon 時注意）：`selectItem` 同 id 不重繪 meta/params；待刪列為 `.fx-item.pending-delete`（子元素：`.name`→tag span→`.rm.restore` 按鈕），不經 `buildItem()` 建立（無 icon/switch/rm 結構）；`buildItem()` 子元素順序 chk→grip→icon→name→[off-tag]→switch→rm（5f 插 icon 相關邏輯請以此為準）。
- **5e 相關（.backup 含插件檔）**：server 端新特效模板建檔於 `put_manifest` 中 `_ensure_new_effect_files`（PUT manifest 含新 id 時建 `viewer.js`（預設）與必要時 `console.js` 模板）先於 `_validate_manifest`；`deleteRemoved` 刪除目錄與 manifest 寫入皆在 `.backup/` 備份邏輯之後的路徑上，5e 擴充備份內容時需涵蓋 `effects/<id>/` 插件檔與被刪目錄（可參考 `test_put_manifest_backup_retention` 與 `put_manifest` 現行流程）。

## 後續待辦

- 無（5e/5f 依 PLAN 續行；T1「5d/5f 各跑一次全套」本任務已跑 5d 全套全綠）。
