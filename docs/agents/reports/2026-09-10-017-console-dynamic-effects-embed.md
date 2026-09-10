# 工作完成報告

- **日期**：2026-09-10
- **任務**：console 動態特效表＋可嵌入 console（server 驅動特效清單、未知特效通用樣式、`GET /console.js`）
- **Agent**：opencode

## 摘要

本次將 `console` 從固定特效清單改為 server 驅動的可嵌入控制台：

- **動態特效表**：console 初始化時 `fetch` server `GET /api/effects`，依回傳特效表建立特效按鈕；未知特效使用 `generic` 樣式與通用參數。
- **載入失敗 fallback**：`/api/effects` 失敗、非 2xx、空表或格式錯誤時，fallback 至內建特效表（`particle`／`ripple`／`firework`／`text`），不影響 console 可用。
- **未知特效通用參數**：未定義 `fields` 時依型別自動產生輸入欄位——`number`→`number`、`#hex` 字串→`color`、其他字串→`text`、boolean→`text`（送出時轉回 boolean）、array/object 略過。
- **可嵌入 console**：`console/app.js` 改為 self-contained，可透過 server `GET /console.js` 嵌入其他網頁；新增 scoped style `#rtx-console-style`、unique `rtx-*` IDs/classes、double-load guard（`if (document.getElementById("rtx-console")) return;`）。
- **設定優先序**：`window.CONTROL_CONFIG.url/key` > script origin／`data-key`（僅在由 `/console.js` 載入時）> `localStorage.rtx.srvUrl/srvKey` > 預設值。
- 保留原有行為：FAB 切換、拖曳面板、viewport clamp、點擊 host body 送出 `POST /api/effect`、清屏 `POST /api/clear`、0–100 座標百分比。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `console/app.js` | 修改 | 改為 self-contained 可嵌入 console；新增 `loadEffects`／`normalizeEffects`／`renderEffects`／`genericFields`／`fieldDefs`／`selectEffect`；支援 `window.CONTROL_CONFIG`、script `data-key`、fallback 特效表、unique IDs、scoped style、double-load guard |
| `console/index.html` | 修改 | 改為薄 shell 頁面（僅載入 `app.js`），移除原內嵌 UI／CSS／JS |
| `server/main.py` | 修改 | 新增 `GET /console.js`，回傳 `console/app.js`（`application/javascript`、`Cache-Control: no-store`），檔案不存在時回 404 |
| `tests/test_api.py` | 修改 | 新增 `test_serves_console_js`（驗證 `/console.js` 回應內容、Content-Type、no-store） |
| `tests/test_console.mjs` | 修改 | 重寫為 34 項 vm 測試；涵蓋動態特效表、fallback、未知特效通用欄位、設定優先序、toggle/drag、POST behavior |
| `README.md` | 修改 | 更新 console／viewer 嵌入方式、`GET /console.js` 用法、`window.CONTROL_CONFIG`、動態特效說明、測試命令 |
| `docs/agents/TODO.md` | 修改 | 新增 2026-09-10 已完成項目（動態特效表、可嵌入 console）；更新 console vm 測試數為 34 項 |
| `docs/agents/CALL_GRAPH.md` | 修改 | 更新 `GET /console.js`、`GET /api/effects`、console 初始化 sequence、Console class methods、測試數量 |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：`node --test tests/test_effects.mjs tests/test_console.mjs`、`python -m pytest tests/ -q`
- 結果：node 47 項通過（effects 13＋console 34）、pytest 13 項通過（2 項 warnings）

## Git Commit

- Commit：`c16e18468ce043906f140f596f29a60b9d470ef1` — `feat(console): 動態特效表與可嵌入 console（/console.js、未知特效通用樣式、CONTROL_CONFIG）`

## 後續待辦

- 請用戶於瀏覽器手動驗證：
  - `console/index.html` 獨立開啟時，特效清單依 server `/api/effects` 動態建立
  - 將 `<script src="http://<server-host>:8000/console.js" data-key="..."></script>` 嵌入其他網頁時，console 可正常顯示與操作
  - 未知特效自動顯示通用樣式與參數
  - 參數／連線設定面板展開、FAB 拖曳、送出特效、清屏皆正常
