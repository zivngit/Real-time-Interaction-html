# 工作完成報告

- **日期**：2026-09-21
- **任務**：effects 編輯器子任務 5u — 新增特效 [存檔]（staged）後、尚未 [保存] 的 2 項修正
- **Agent**：opencode

## 摘要

依使用者回報修正：新增特效 [存檔]（staged）後、尚未 [保存] 的 2 項問題。此狀態下 `state.pendingCode` 已有 `viewer.js`／`console.js` 內容，但 server 檔案尚未建立（磁碟 404），`state.manifest` 的 entry 為本地 staged。

1. **不會更新 icon**：列表 icon 來源 `iconFor(id, spec)` 優先序為 `resolvedPluginIcon(id)`（console.js 插件）→ manifest icon → …，而 `resolvedPluginIcon` 讀 `consoleRegistry.registry[id]`——該 registry 原本只在 [保存]（`loadConsolePlugins` 抓磁碟）後才更新。新增 `applyStagedConsole(id, content)`（以 `new Function('window','document',content)` 執行 staged console.js、註冊進 `window.RTX_EFFECT_CONSOLE` registry、try/catch 不阻斷），`saveFile()` 於 [存檔] `console.js` 後呼叫 `applyStagedConsole`＋`refreshListIcons()` → 列表 icon 即依 staged 插件 iconID/iconSVG 更新（不必等 [保存]）。
2. **無法匯出 [console.js][viewer.js]**：`exportFile()` 的 viewer/console 分支原本一律 `fetch` 磁碟，新增特效尚未落盤 → 404 →「export failed 404」。新增 `exportSource(id, filename)` 依 **staged → 目前 tab textarea → 磁碟** 優先序解析內容，`exportFile()` 改用它 → 新增特效 [存檔] 後即可匯出 staged 內容（未落盤不失敗）。

`__rtxEditor` version `'5t'`→`'5u'`、新增 `applyStagedConsole`／`exportSource` 匯出。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `editor/app.js` | 修改 | 新增 `applyStagedConsole(id, content)`（`new Function` 執行 staged console.js 註冊進 registry、try/catch）；`saveFile()` [存檔] `console.js` 後改以 `applyStagedConsole`＋`refreshListIcons()` 更新列表 icon；新增 `exportSource(id, filename)`（staged→textarea→磁碟）；`exportFile()` viewer/console 分支改以 `exportSource` 取代一律 fetch 磁碟；version `'5t'`→`'5u'`、`__rtxEditor` 加 `applyStagedConsole`／`exportSource` 匯出 |
| `tests/test_editor.mjs` | 修改 | 新增 5u 2 項：[存檔] console.js 後列表 icon 更新（staged 插件註冊、尚未 [保存]）、`exportSource` staged→textarea→disk 解析（disk 404 不失敗）；runEffectTest 測試 version 斷言改 `'5u'`；測試數 78→80 |
| `README.md` | 修改 | 測試數量 node 187→189、`test_editor` 78→80 |
| `docs/HOW_TO_ADD_EFFECT.md` | 修改 | 程式碼編輯 bullet 補 [存檔] `console.js` 後列表 icon 更新（`applyStagedConsole`＋`refreshListIcons`）＋[匯出 viewer.js／console.js] 依 staged→textarea→磁碟 取內容（新增特效 [存檔] 後即可匯出、未落盤不失敗） |
| `docs/agents/CALL_GRAPH.md` | 修改 | EditorPage class 加 `applyStagedConsole()`／`exportSource()`；TEX 節點 78→80＋5u；現況表補 5u |
| `docs/agents/TODO.md` | 修改 | 測試數量 `test_editor` 78→80；新增子任務 5u 完成項目 |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：
  - `python -m pytest tests/ -q`
  - `node --test tests/test_effects.mjs tests/test_console.mjs tests/test_effect_examples.mjs tests/test_effect_catalog.mjs tests/test_editor.mjs`
  - `npx playwright test`
- 結果：全綠——`pytest` 153 passed；node 189 passed（`test_editor` 80）；Playwright E2E 64 passed（3a「console.js 載入＋匯出下載內容一致」改由 textarea 內容下載、內容一致仍通過）。

## Git Commit

- Commit：`8b583254d7518b71a3fafbf8bcc7d3484c684c58` — `fix(editor): 新增特效 [存檔]（staged）後更新列表 icon 且可匯出 console.js/viewer.js`

## 後續待辦

- 無（本次為 2 項行為修正，未引入新待辦）。
