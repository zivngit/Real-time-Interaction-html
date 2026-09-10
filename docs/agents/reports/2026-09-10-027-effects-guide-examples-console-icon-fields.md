# 工作完成報告

- **日期**：2026-09-10
- **任務**：新增特效指南、特效範例與 console plugin `iconID`／`iconSVG`
- **Agent**：opencode

## 摘要

本次工作補齊 effects plugin 架構的實用文件與範例，並把 console plugin 的 icon 設定從單一 `icon` 欄位改為更明確的 `iconID`／`iconSVG` 兩個欄位。

主要內容：

- 新增 `docs/HOW_TO_ADD_EFFECT.md`，說明如何正式加入新特效、manifest 欄位、params schema、server 驗證行為、viewer plugin 介面，以及 console plugin 如何正確傳遞 params 給 server。
- 新增 `examples/effects/sample-burst/` 完整範例，展示可選 manifest 欄位與各種 params 型別；新增 `examples/effects/effect-interface/` 最小介面參考。兩個資料夾都不是正式 server manifest，server 啟動時仍只讀取根目錄 `effects/effects.json`。
- console plugin 註冊介面改為 `window.RTX_EFFECT_CONSOLE.register(id, { iconID, iconSVG, render })`。
- icon 解析優先序改為：plugin `iconSVG` → plugin `iconID` → manifest `icon` → `RTX_EFFECT_ICONS[type]` → `RTX_EFFECT_ICONS.generic` → 內建 fallback icon。
- 舊 console plugin `icon` 欄位不再讀取；`effects/particle/console.js`、`effects/ripple/console.js`、`effects/text/console.js` 已同步改為 `iconID`。
- `docs/HOW_TO_ADD_EFFECT.md` 第 8 節補充 `paramsFor()` 如何依 `rtx-p-<paramKey>` 讀取輸入項、各 params 型別的正確 UI 寫法，以及 `editable: false`／`array` 不渲染、server 使用 `default` 的行為。
- `docs/temp/PLAN_EFFECTS_JSON.md` 已在本機更新（`docs/temp/` 被 `.gitignore` 忽略，不納入此次 commit）。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `docs/HOW_TO_ADD_EFFECT.md` | 新增 | 新增特效指南：manifest、params schema、server 驗證、viewer/console plugin 介面、`iconID`／`iconSVG`、server params 傳遞說明 |
| `examples/effects/sample-burst/effects.json` | 新增 | 完整範例 manifest：展示可選 manifest 欄位與各種 params 型別／可選欄位 |
| `examples/effects/sample-burst/viewer.js` | 新增 | sample-burst viewer plugin 範例；註冊 `window.Effects.register("sample-burst", ...)` |
| `examples/effects/sample-burst/console.js` | 新增 | sample-burst console plugin 範例；示範 `iconID`＋`iconSVG`，並依 `api.fields` 建立 `rtx-p-*` 輸入項 |
| `examples/effects/effect-interface/effects.json` | 新增 | 最小 manifest 介面參考 |
| `examples/effects/effect-interface/viewer.js` | 新增 | 最小 viewer plugin 介面參考 |
| `examples/effects/effect-interface/console.js` | 新增 | 最小 console plugin 介面參考；示範 `iconSVG` 與 `rtx-p-duration` 輸入項 |
| `console/app.js` | 修改 | console plugin icon 解析改為 `iconSVG`／`iconID`；舊 `icon` 欄位不再讀取；有效 plugin icon 不標記 `generic` |
| `effects/particle/console.js` | 修改 | `icon` 改為 `iconID: "particle"` |
| `effects/ripple/console.js` | 修改 | `icon` 改為 `iconID: "ripple"` |
| `effects/text/console.js` | 修改 | `icon` 改為 `iconID: "text"` |
| `tests/test_console.mjs` | 修改 | 新增 `iconSVG`／`iconID` 解析、優先序、fallback、舊 `icon` 不生效等測試；console 測試共 51 項 |
| `tests/test_effect_examples.mjs` | 新增 | 驗證 examples manifests、viewer plugins、console plugins、`iconID`／`iconSVG`、`rtx-p-*` 輸入項；共 16 項 |
| `README.md` | 修改 | 更新 console plugin 註冊說明、新增特效指南連結、examples 參考、測試命令 |
| `docs/agents/TODO.md` | 修改 | 記錄新增特效指南與範例、console plugin icon 欄位變更、測試數量 |
| `docs/agents/CALL_GRAPH.md` | 修改 | 更新 ConsolePlugin 介面、icon 解析優先序、測試節點與 examples 未接線說明 |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：`python -m pytest tests/ -q`
- 執行命令：`node --test tests/test_effects.mjs tests/test_console.mjs tests/test_effect_examples.mjs`
- 結果：pytest 33 項通過（2 項 warnings）；node 84 項通過（effects 17、console 51、effect examples 16）

## Git Commit

- Commit：`56ba156a9c48438250d4254cdd45ae2cb4bbb793` — `feat(effects): 新增特效指南、範例與 console plugin iconID/iconSVG`

## 後續待辦

- 若要正式啟用 `sample-burst`，需將 `examples/effects/sample-burst/` 複製至 `effects/sample-burst/`，並在根目錄 `effects/effects.json` 登記。
- 外部或舊版 console plugin 若仍使用單一 `icon` 欄位，需遷移至 `iconID`／`iconSVG`。
- 請用戶於瀏覽器手動驗證 examples 嵌入頁（需 `SERVE_EXAMPLES=1`）：
  - `http://localhost:8000/examples/embed-console.html`
  - `http://localhost:8000/examples/embed-viewer.html`
  - `http://localhost:8000/examples/embed-both.html`