# 工作完成報告

- **日期**：2026-09-30
- **任務**：前端記憶體治理 Phase 2（editor）：code 預覽 rev-keyed cache（E5）＋`previewViewerSource` codeLoaded guard
- **Agent**：opencode

## 摘要

依 `docs/temp/frontend-memory/FRONTEND_MEMORY_PLAN_EDITOR.md` §3 E5，為 `editor/app.js` 的 code 預覽顯示路徑加 rev-keyed cache（`codeCache`），使切換特效時「同 id＋同 rev」由 cache 同步顯示、免重複 GET；並修 `previewViewerSource` 在 viewer tab 只要 textarea 非空就回傳的 race——加 `state.codeLoaded` 守護，避免「切到新特效後 fetch 未完成就按 [測試特效]」以新 id 執行舊特效代碼。

- `editor/app.js` 新增 `codeCache`（`{ id + '/' + filename → { content, rev } }`）於 `codeFilePath()` 前。
- `editor/app.js` `loadCodeFile()`：staged `pendingCode` 優先（不變）；計算 `crev = (spec && (filename === 'viewer.js' ? spec.viewerRev : spec.consoleRev)) || state.rev || ''`；`codeCache` hit 且 `cached.rev === crev` 直接 `showCode(cached.content)` 免 GET；miss 才 fetch，成功與 404 模板路徑皆寫入 `codeCache`。
- `editor/app.js` `previewViewerSource(id)`：staged 優先（不變）；否則僅 `activeTab() === 'viewer'`、`els.code.value` 非空、**且 `state.codeLoaded.id === id && state.codeLoaded.filename === 'viewer.js'`** 才回 textarea，否則 `null`（落回 `loadScript` 磁碟路徑）。
- rev 為 SHA-256：rev 相同⇒內容必然相同，完全防杜過期內容；外部改動／他人保存經 SSE manifest 事件更新 rev 後，下次切換自動回落 fetch——失效點全為既有機制，不需新增。記憶體有界（特效數×KB 級），不增 `<script>` 節點。
- `window.__rtxEditor` expose 補 `previewViewerSource`、`codeCache`（`loadCodeFile` 原已 expose）。
- 測試：`tests/test_editor.mjs` 新增 5 項 E5（132→137）——①同 id 同 rev 切回免重抓（A→B→A 僅 1 次 GET）；②rev 變化（`spec.viewerRev`／`state.rev`）觸發重抓；③staged 優先於 cache（staged 顯示、切回不重抓、cache 不被 staged 覆蓋）；④`previewViewerSource` guard（`codeLoaded` 對齊才回 textarea，stale／manifest tab／staged 皆正確）；⑤viewer 200 空內容→`null`。node vm cross-realm 注意：`codeCache` 值為 VM realm 物件，`deepStrictEqual` 因 prototype 非 reference-equal 失敗，改逐屬性 `assert.equal` 斷言。
- 行為不變：`selectItem()`／tab 切換仍調 `loadCodeFile()`；`onCodeSaved`／預覽／mini-console 路徑不經 `codeCache`；無 server 改動（與 E2 正交）。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `editor/app.js` | 修改 | 新增 `codeCache`；`loadCodeFile()` 加 rev-keyed cache（staged 優先、`crev` 計算、hit 免 GET、fetch／模板路徑寫入 cache）；`previewViewerSource()` 加 `state.codeLoaded` guard（id＋filename 對齊才信任 textarea）；`window.__rtxEditor` expose 補 `previewViewerSource`、`codeCache` |
| `tests/test_editor.mjs` | 修改 | 新增 5 項 E5 測試（同 rev 切回免重抓、rev 變化重抓、staged 優先於 cache、`previewViewerSource` guard、空內容 null）；132→137 項 |
| `README.md` | 修改 | 測試計數：node 243→248（`test_editor` 132→137） |
| `docs/agents/CALL_GRAPH.md` | 修改 | EditorPage class 加 `codeCache` 狀態、`EditorPage ..> Effects` 邊補 `previewViewerSource` guard、`EditorPage ..> Server` code 預覽 GET 邊補 `codeCache` 說明、test_editor 132→137＋E5 語意 |
| `docs/agents/TODO.md` | 修改 | 計數（`test_editor` 132→137）；[x]「Phase 2（editor，E5）」；後續項收縮為「Phase 2 剩餘（E2＝S2、E3＝S3）、Phase 3（S5 可觀測性）」 |

> 註：本報告檔本身未列入上方表格。`docs/temp/frontend-memory/` 規劃與改動紀錄文件未受 git 追蹤，不列入異動表。

## 測試與驗證

- 執行命令：`npm run test:unit`
- 結果：通過；pytest 161 項通過＋Node 248 項通過（243＋5 新 E5；2026-09-30 實跑）

- 執行命令：`npx playwright test`
- 結果：通過；Playwright E2E 88 項通過（既有 88 項、無新增；guard 不影響既有預覽流程，2026-09-30 實跑）

## Git Commit

- Commit：`d1b2b1bd079b7d0a05f91f50c5419f488e937bf8` — `feat(editor): code 預覽 rev-keyed cache（codeCache）與 previewViewerSource codeLoaded guard（Phase 2 editor E5）`

## 後續待辦

- 前端記憶體治理後續（依 `docs/temp/frontend-memory/FRONTEND_MEMORY_PLAN.md`／`FRONTEND_MEMORY_PLAN_EDITOR.md`）：Phase 2 剩餘（E2＝S2：preview 未-staged 路徑改 fetch 文字＋`new Function`、E3＝S3：`Effects.registry`／`consoleRegistry` rev 變化收斂）、Phase 3 可觀測性（S5）；editor 端靜態資產 ETag 條件請求（S4 剩餘）
