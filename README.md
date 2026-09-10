# Real-time Interaction html

> 本專案使用 `docs/agents` 模板，規範 AI 助理 (Agents) 的協作流程與文件維護標準。

## 模板結構

```
project/
├── .gitignore              # Git 忽略規則（IDE、Python 建置產物、暫存）
├── README.md               # 專案說明與模板使用方式
├── docs/
│   ├── agents/
│   │   ├── AGENTS.md       # AI 助理最高行為準則（工作流程、測試與交付標準）
│   │   ├── TODO.md         # 任務追蹤清單
│   │   ├── CALL_GRAPH.md   # 系統架構、模組依賴與函式呼叫路徑
│   │   └── reports/        # 每次任務的工作完成報告
│   │       └── REPORT_TEMPLATE.md   # 報告格式範本
│   └── temp/               # 暫存目錄（草稿、暫時性檔案）
└── (程式碼)
```

## 使用方法

1. 依專案實際技術棧，調整 `AGENTS.md` 中的測試與提交規範。
2. Agent 執行任務時，遵循 `AGENTS.md` 定義的 SOP：
   **Plan → Execute & Test → Document → Commit & Report**。

## Agent 工作週期 (SOP)

| 步驟 | 動作 | 對應文件 |
| --- | --- | --- |
| 1. Plan | 讀取任務、理解需求、確認架構限制 | `TODO.md`、`CALL_GRAPH.md` |
| 2. Execute & Test | 撰寫程式碼並通過測試 | 程式碼與測試 |
| 3. Document | 同步更新架構圖與任務狀態 | `CALL_GRAPH.md`、`TODO.md` |
| 4. Commit & Report | 產生 Git commit 與工作完成報告 | Git、`reports/` |

## 執行方式

```
python -m venv .venv                                  # 首次：建立虛擬環境
.venv\Scripts\activate                                # Windows（Linux/macOS：source .venv/bin/activate）
pip install -r server/requirements-dev.txt            # 含測試依賴
python -m uvicorn server.main:app --port 8000   # server 中繼（專案根目錄執行）
```

- demo／showcase 頁：使用 `examples/` 示範頁（預設停用；以 `SERVE_EXAMPLES=1` 啟用並重新啟動 server 後，開啟下方「嵌入示範頁」章節所列之示範頁 URL）
- viewer 嵌入其他網頁：`<script src="http://<server-host>:8000/viewer/app.js"></script>`
- console 嵌入其他網頁：`<link rel="stylesheet" href="http://<server-host>:8000/console/style.css">`＋`<script src="http://<server-host>:8000/console/icons.js"></script>`＋`<script src="http://<server-host>:8000/console/app.js" data-key="..."></script>`（可先定義 `window.CONTROL_CONFIG = { url, key }`）
- 存取金鑰（可選）：server 設定環境變數 `ACCESS_KEY`；console 可於面板填入、嵌入用 `data-key="..."` 或 `window.CONTROL_CONFIG.key`

## 特效結構（effects 插件架構）

`effects/effects.json` 是唯一特效清單（manifest），server、viewer、console 皆由其驅動：

- `effects/<id>/viewer.js`：特效繪製實作，執行時註冊 `window.Effects.register(id, factory)`
- `effects/<id>/console.js`（選用）：自訂 console 參數 UI，註冊 `window.RTX_EFFECT_CONSOLE.register(id, { iconID, iconSVG, render })`；`iconID` 為 `RTX_EFFECT_ICONS` 的 key、`iconSVG` 為 raw SVG 字串（有效 `iconSVG`／`iconID` 優先於 manifest `icon`）；缺省时 console 依 schema 自動渲染
- `params` schema 型別：`integer`／`number`／`string`／`color`／`boolean`／`select`／`array`；`editable: false` 不顯示輸入項；`POST /api/effect` 的 params 由 server 依 schema 驗證（無效值回退預設值）

相關 server 路由（皆 `Cache-Control: no-store`）：

- `GET /effects/effects.json`
- `GET /effects/{effect_id}/viewer.js`
- `GET /effects/{effect_id}/console.js`

新增特效：在 `effects/effects.json` 加一個 entry ＋ 建立 `effects/<id>/viewer.js` 即可；server／console 程式碼不需修改。詳見 `docs/HOW_TO_ADD_EFFECT.md`；完整範例參考 `examples/effects/sample-burst/`、最小介面參考 `examples/effects/effect-interface/`（兩者非正式 manifest）。

## 嵌入示範頁（examples，opt-in）

`examples/` 提供宿主網頁嵌入示範頁（viewer／console／兩者），**預設停用**；須設定環境變數 `SERVE_EXAMPLES=1`（接受 `1`／`true`／`yes`，不分大小寫）並重新啟動 server：

PowerShell：

```powershell
$env:SERVE_EXAMPLES = "1"
python -m uvicorn server.main:app --port 8000
```

cmd：

```cmd
set SERVE_EXAMPLES=1 && python -m uvicorn server.main:app --port 8000
```

啟用後可存取：

- `http://localhost:8000/examples/`（示範頁索引）
- `http://localhost:8000/examples/embed-viewer.html`（僅嵌入 viewer：`/viewer/app.js`）
- `http://localhost:8000/examples/embed-console.html`（僅嵌入 console：`/console/style.css`＋`/console/icons.js`＋`/console/app.js`）
- `http://localhost:8000/examples/embed-both.html`（同時嵌入 viewer 與 console）

未啟用時上述路線皆回 404。若 server 已設定 `ACCESS_KEY`，console 示範頁需將 `<script src="/console/app.js" data-key="">` 的 `data-key` 填入對應金鑰才能發送特效。

測試：

```
python -m pytest tests/ -q
node --test tests/test_effects.mjs tests/test_console.mjs tests/test_effect_examples.mjs
```

## 文件維護原則

- 每次改動都需對應一個具描述性的 Git commit。
- 每次改動都需編寫或更新測試，交付前確保全部通過。
- 文件異動（新增／修改／移動／刪除）須於 `reports/` 產出報告，格式遵循 `REPORT_TEMPLATE.md`。
- 暫存草稿放於 `docs/temp/`（已被 `.gitignore` 忽略，不納入版本控制）。
