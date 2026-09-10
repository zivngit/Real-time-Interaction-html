# 工作完成報告

- **日期**：2026-09-10
- **任務**：移除 console/viewer 展示用 index、examples 改為展示頁、`shared/app.js` 移至 `viewer/app.js`
- **Agent**：opencode

## 摘要

移除 standalone 展示頁 `console/index.html` 與 `viewer/index.html`，`examples/` 示範頁自此為本專案的 demo／showcase HTML 入口；viewer 嵌入運行時（embed runtime）`shared/app.js` 以 `git mv` 移至 `viewer/app.js`（內容未更動，git 偵測 100% rename），`shared/` 目錄隨之清空移除。server `GET /app.js` 改 serve `viewer/app.js`；`examples/index.html` 不再連結 standalone 頁，並改以 examples 為展示入口呈現；README 移除開啟 standalone 頁的說明、改指向 examples（啟用命令與示範頁 URL 見 README「嵌入示範頁」章節）；CALL_GRAPH 同步改以 examples 頁取代 standalone 頁、`shared/app.js` 改為 `viewer/app.js`。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `console/index.html` | 刪除 | standalone console 展示頁 |
| `viewer/index.html` | 刪除 | standalone viewer 預覽頁 |
| `viewer/app.js`（原 `shared/app.js`） | 移動 | viewer 嵌入運行時；`git mv` 保留 100% rename，內容未更動 |
| `shared/` | 刪除 | 移動後目錄清空，移除 |
| `server/main.py` | 修改 | `SHARED_APP_JS`→`VIEWER_APP_JS`（`viewer/app.js`）；`GET /app.js` 404 detail 改為 `viewer/app.js not found`；維持 `application/javascript`＋`Cache-Control: no-store` |
| `examples/index.html` | 修改 | 移除連結 standalone `viewer/index.html`／`console/index.html`；標題與說明改以 examples 為 demo／showcase 入口；保留「預設停用、需 `SERVE_EXAMPLES=1`」註記 |
| `tests/test_api.py` | 修改 | enabled examples 測試新增斷言 index 不含有 `/viewer/index.html`、`/console/index.html`（測試數維持 17 項） |
| `README.md` | 修改 | 移除開啟 `console/index.html`／`viewer/index.html` 的說明，改為指向 examples（預設停用、`SERVE_EXAMPLES=1` 啟用、demo 頁 URL 見既有「嵌入示範頁」章節）；保留其他網站嵌入說明 |
| `docs/agents/TODO.md` | 修改 | 新增已完成項（2026-09-10）：移除 standalone 展示頁、examples 改為 demo/showcase、`shared/app.js` 移至 `viewer/app.js` |
| `docs/agents/CALL_GRAPH.md` | 修改 | `console/index.html`／`viewer/index.html` 改以 examples 頁（embed-console／embed-viewer／embed-both）呈現；`shared/app.js` 改為 `viewer/app.js`；序列註記改述 examples 頁載入 server 資產；未完成節點表補 `viewer/style.css` 無頁面引用；測試數量維持 17／13／39 |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：`node --test tests/test_effects.mjs tests/test_console.mjs`、`python -m pytest tests/ -q`
- 結果：node 52 項通過（effects 13＋console 39）、pytest 17 項通過（2 項 warnings）

## Git Commit

- Commit：`8ca80bd22ee726415ee19a4433d8e4cb5be7d9ef` — `refactor: 移除展示用 index 並改用 examples（shared/app.js 移至 viewer）`

## 後續待辦

- 請用戶於瀏覽器手動驗證：
  - 預設 server（未設定 `SERVE_EXAMPLES`）：`/examples` 仍回 404
  - 設定 `SERVE_EXAMPLES=1` 後：examples 各頁可載入
  - `/app.js` 回傳內容為 `viewer/app.js`
  - embed-viewer／embed-console／embed-both 示範頁仍可正常發送並渲染特效
