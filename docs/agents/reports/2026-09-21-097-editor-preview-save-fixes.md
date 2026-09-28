# 工作完成報告

- **日期**：2026-09-21
- **任務**：effects 編輯器子任務 5t — 修正預覽與存檔 4 項
- **Agent**：opencode

## 摘要

依使用者回報修正特效編輯器預覽／存檔 4 項問題：

1. **[開始預覽]／[发送到 viewer]／[清屏] 訊息未顯示於預覽面板結果區**：`previewStart()`／`previewSend()`／`previewClear()` 原先以 `setWarnings` 把狀態訊息寫入程式碼區 `#ed-warnings`（與 [檢查格式] 同區）。改以 `setTestResult` 顯示於預覽面板結果區 `#ed-preview-test-result`（與 [測試特效] 結果同區、與 [檢查格式] 的 warnings 分區）。
2. **[測試特效] 對 canvas gradient 特效誤報未通過**：`makeTestCtx()` 的 Proxy 一般 getter 原本對任意方法回傳 `function(){ calls.push(prop); return undefined; }`，導致使用 `ctx.createRadialGradient(...)`／`createLinearGradient(...)` 的特效（chrono-vortex／aurora／fire-dragon）拿到 `undefined` 後呼叫 `grad.addColorStop(...)` 拋 TypeError，被 `runEffectTest` 誤判「運行：錯誤／未通過」。重寫 `makeTestCtx`：新增 `chainable()`（可鏈式 Proxy，繪製方法回傳可繼續呼叫的 stub 而非 `undefined`）、`canvasObj`（800×450）、`gradStub`（`addColorStop`/width/height/data），並特判 `canvas`／`measureText`／`getImageData`；無 Proxy 的 fallback 亦回傳 `gradStub`。
3. **[新增特效] 後無法 [開始預覽]**：新特效尚未落盤（無 `viewer.js` 檔案），`previewStart`→`injectPlugin(id)`→`loadScript` 抓磁碟 404。新增 `previewViewerSource(id)`（staged `pendingCode` → viewer tab textarea → `null` 回退磁碟）；`injectPlugin(id, content)` 加 `content` 參數，提供時以 `new Function('window','document',content)` 評估 in-editor source 註冊（否則維持 `loadScript` 抓磁碟）；`previewStart` 改傳 `previewViewerSource(id)` → viewer tab 顯示 server 模板的新特效可直接 [開始預覽]。
4. **[存檔] 後列表 icon 未更新**：`save()` 成功後清 `pluginCache`（rev 隨檔案內容而變，清 cache 確保 `loadConsolePlugins` 重抓）＋補 `refreshListIcons()` → 存檔（含 console.js 插件 icon／manifest icon 變更）後列表 icon 立即刷新。

`__rtxEditor` version `'5s'`→`'5t'`。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `editor/app.js` | 修改 | ①`previewStart`／`previewSend`／`previewClear` 全部 `setWarnings`→`setTestResult`；②`makeTestCtx` 重寫（`chainable()` Proxy＋`canvasObj`＋`gradStub`＋`canvas`/`measureText`/`getImageData` 特判，fallback 亦回 `gradStub`）修復 gradient 特效 smoke run；③新增 `previewViewerSource(id)`、`injectPlugin(id, content)` 加 `content` 參數（提供時以 `new Function` 評估 in-editor source 註冊）、`previewStart` 改傳 `previewViewerSource(id)`；④`save()` 成功後清 `pluginCache`＋補 `refreshListIcons()`；version `'5s'`→`'5t'` |
| `tests/test_editor.mjs` | 修改 | 5 項 preview 訊息斷言 `warnings`→`previewTestResult`（請先選定特效／已清屏×2／已发送／send 失敗）、version 斷言改 `'5t'`；新增 5t 3 項：gradient 特效 smoke run 通過（ctx stub 不拋錯）、新增特效→開始預覽（`injectPlugin` 以 in-editor source 註冊＋running）、[保存] 後 manifest icon 變更→列表 icon 更新；測試數 75→78 |
| `tests/e2e/editor.spec.js` | 修改 | 发送 測試狀態訊息斷言 `#ed-warnings`→`#ed-preview-test-result`；editor.spec.js 維持 36 |
| `README.md` | 修改 | 測試數量 node 184→187、`test_editor` 75→78；E2E 描述補 [開始預覽]／[发送到 viewer]／[清屏] 狀態訊息顯示於預覽面板結果區（`#ed-preview-test-result`、與 [檢查格式] 的 warnings 不同區） |
| `docs/HOW_TO_ADD_EFFECT.md` | 修改 | 即時預覽 bullet 補 4 項修正（結果區訊息、gradient 特效可通過、新增特效可開始預覽、存檔後刷新 icon） |
| `docs/agents/CALL_GRAPH.md` | 修改 | EditorPage class 加 `previewViewerSource()`；TEX 節點 75→78＋5t（gradient smoke run／previewViewerSource＋injectPlugin／save icon 刷新／preview 訊息斷言）；TP 節點補 5t（发送 訊息改結果區）；現況表補 5t |
| `docs/agents/TODO.md` | 修改 | 測試數量 `test_editor` 75→78；新增子任務 5t 完成項目 |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：
  - `python -m pytest tests/ -q`
  - `node --test tests/test_effects.mjs tests/test_console.mjs tests/test_effect_examples.mjs tests/test_effect_catalog.mjs tests/test_editor.mjs`
  - `npx playwright test`
- 結果：全綠——`pytest` 153 passed；node 187 passed（`test_editor` 78）；Playwright E2E 64 passed。

## Git Commit

- Commit：`7e91c8622b129df64b76450e77dbc4f5e2ba97a7` — `fix(editor): 預覽按鈕訊息改顯示預覽面板結果區＋gradient 特效 smoke run 修正＋新增特效可開始預覽＋存檔後刷新列表 icon`

## 後續待辦

- 本次發現：先前中斷的 Playwright E2E（zip 匯入用例）會在 `effects/` 遺留空目錄 `effects/imported-fx/`（未登記於 `effects.json`），導致 `tests/test_effect_catalog.mjs`「特效 catalog 必須與 manifest、資料夾、viewer plugins 與 console plugins 一致」失敗（`1 !== 0`）。本次已 `rmdir` 移除；當次完整 E2E 執行有正確清理、未再遺留。建議與 096 之 fixture 還原問題一併處理：為 E2E 加全域 `globalTeardown`／`afterAll` 統一清理匯入特效目錄（`effects/<imported-id>/`）與 `tests/fixtures/effects.json`，避免各用例內散落 snapshot/restore／清理因中途失敗而遺漏。
