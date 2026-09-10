# 工作完成報告

- **日期**：2026-09-10
- **任務**：console 特效分組＋［參數］／［連線設定］展開面板
- **Agent**：opencode

## 摘要

重組 console 控制面板：特效按鈕依類別分組（爆散：particle/firework、漣漪：ripple、文字：text）；新增［參數］按鍵，於面板內線性展開 `#paramsPanel`，`renderParams()` 依目前選定特效渲染參數輸入（`#p-<key>`，預設值來自 `console/app.js` 內建 `PARAM_DEFS`，自足不匯入 `shared/effects.js`）；連線輸入 `#srvUrl`／`#srvKey` 移入 `#connPanel`，預設收合、以［連線設定］按鍵展開。收合/展開統一由 `bindToggle(btnId, panelId)` 處理（`.open` toggle＋`aria-expanded`，展開時呼叫 `applyFabPos()` 重新 clamp 面板）。`paramsFor()` 改為通用讀取已渲染之 `p-*` 輸入（number → `Number`、其餘字串），點擊視窗時隨特效一併發送。測試 stub 支援 `document.createElement` 動態節點（id 註冊至 `created`、`_children`／`innerHTML` 子元素追蹤），靜態元素 id 改為預先註冊，未知 id 回傳 `null`；vm 冒煙測試新增 4 項，共 15 項。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `console/index.html` | 修改 | 面板寬 260→280px；新增 `.fxGroup`／`.fxGroupTitle`／`.collapsible`／`.actionBtn`／number input 樣式；`#fxButtons` 改為分組（爆散／漣漪／文字）；新增操作列 `#paramsBtn`／`#connBtn`／`#clearBtn`、`#paramsPanel`＋`#paramsBody`、`#connPanel`（收合 `#srvUrl`／`#srvKey`）；移除舊固定連線區與單一 color/text 輸入 |
| `console/app.js` | 修改 | 新增 `PARAM_DEFS`（各特效 key/label/type/def/min/max/step）；新增 `renderParams()`（初始與特效選定後呼叫）；新增 `bindToggle(btnId, panelId)` 綁定 params/conn；`paramsFor()` 改為通用讀取 `p-*` 輸入 |
| `tests/test_console.mjs` | 修改 | stub：`makeEl` 加 `_children`／`appendChild`／`innerHTML` setter、`createElement` id 註冊＋`created` 查詢、靜態 id 預先註冊、未知 id 回 `null`、env 加 `node(id)`；既有測試改用 `p-color`／`p-content` 並驗證完整 params；新增 4 項（params/conn toggle、參數欄位隨特效渲染、點擊發送目前輸入值），共 15 項 |
| `docs/agents/CALL_GRAPH.md` | 修改 | 第 3 節序列加 console 內部操作（renderParams／bindToggle／paramsFor）；第 5 節 classDiagram 加 Console 類別（saveCfg/applyFabPos/renderParams/bindToggle/headers/paramsFor/post）與 `Console ..> Server` 關係；第 6 節 console 測試數 11→15 |
| `docs/agents/TODO.md` | 修改 | 第二階段新增本次 console UI 完成項（2026-09-10） |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：`node --test tests/test_effects.mjs tests/test_console.mjs`、`python -m pytest tests/ -q`
- 結果：全綠——node 28 passed（console 15＋effects 13）、pytest 12 passed。

## Git Commit

- Commit：`734c53e` — `feat(console): 特效分組（爆散/漣漪/文字）＋參數與連線設定展開面板`

## 後續待辦

- 請用戶於瀏覽器重新開啟 `console/index.html` 手動驗證：特效分組切換、［參數］依特效展開並可調參、［連線設定］收合/展開、點擊視窗以目前參數值發送。
