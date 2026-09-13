# Real-time Interaction html

即時網頁特效互動系統。將「console 操作端」與「viewer 顯示端」拆成可嵌入元件：console 送出特效、位置與參數，FastAPI server 負責驗證、限頻與廣播，多個 viewer 透過 SSE 接收事件，並在宿主網頁上以 canvas 疊層即時渲染。

## 專案特色

- **可嵌入 viewer**：只要一行 `<script>` 即可在任意網頁加上即時特效顯示層，canvas 不擋宿主網頁操作。
- **可嵌入 console**：以浮動按鈕＋面板控制特效，支援選特效、調參數、清屏、拖曳移動位置；console 可將特效放在「主要」與「次要」兩個區塊，並以 `localStorage` 記憶個人布局。
- **manifest 驅動特效**：特效清單集中在 `effects/effects.json`；正式 manifest 支援 version 1／2，version 2 以 `currentEffects`／`alternateEffects` 定義 console 雙區布局，個別特效可用 `enabled: false` 停用；新增特效主要新增 manifest entry 與 `effects/<id>/viewer.js`，不需改 server／console 核心。
- **manifest 手動重載**：`POST /api/effects/reload` 重新讀取 manifest 與插件 fingerprint；viewer 透過 SSE `manifest` 自動更新，console 於［連線設定］展開後點「重載」或頁面重新整理套用。
- **params schema 驗證**：server 依 manifest 參數型別驗證，無效值回退預設值。
- **多 viewer 廣播**：console 送出事件後，server 以 SSE 推送給所有已連線 viewer。
- **相對座標**：使用 viewport 0–100 百分比座標，viewer 自行換算成 canvas 像素。
- **可選存取金鑰**：server 可設定 `ACCESS_KEY`；未設定時全開放。POST API 使用 `X-Access-Key` header；SSE 使用 `?key=` query。
- **全域限頻**：`POST /api/effect` 使用滑動視窗限制（20/s）。
- **完整自動化測試**：pytest 測 server API、node 測 viewer／console 邏輯、Playwright 測真實瀏覽器 E2E。

## 系統架構

```mermaid
flowchart LR
    C["console<br/>嵌入宿主網頁的控制面板"]
    S["FastAPI server<br/>驗證、限頻、廣播"]
    V["viewer<br/>嵌入宿主網頁的 canvas 疊層"]
    M[("effects/effects.json<br/>特效 manifest")]
    P["effects/<id>/viewer.js<br/>effects/<id>/console.js"]

    C -->|"POST /api/effect<br/>POST /api/clear<br/>POST /api/effects/reload"| S
    S -->|"SSE /api/stream<br/>effect / clear / ping / manifest"| V
    M --> S
    S -->|"GET /api/effects"| C
    S -->|"GET /api/effects"| V
    S -->|"serve viewer.js / console.js"| P
```

主要流程：

1. viewer 載入 `effects/effects.json`，再動態載入各特效 `viewer.js`。
2. console 載入 `effects/effects.json`，建立特效按鈕與參數 UI。
3. 使用者選特效並點擊畫面，console 送出 `POST /api/effect`。
4. server 驗證 effect、params、金鑰與限頻後，廣播 SSE 事件。
5. viewer 收到事件後，在 canvas 疊層上渲染特效。
6. 使用者點清屏時，console 送出 `POST /api/clear`，viewer 清除目前特效。
7. manifest 或特效插件變更後，以 `POST /api/effects/reload` 手動重載；viewer 收到 SSE `manifest` 後自動更新插件，console 需展開［連線設定］後點［重載］，或重新整理頁面。

## 目錄結構

```text
project/
├── server/                  # FastAPI 中繼 server
│   ├── main.py              # API、SSE、存取金鑰、限頻、examples
│   ├── effects.py           # manifest 讀取、schema 驗證、catalog `rev` 與手動重載
│   ├── requirements.txt     # 執行依賴
│   └── requirements-dev.txt # 測試依賴
├── effects/                 # 正式特效插件與 manifest
│   ├── effects.json         # 正式特效清單
│   ├── particle/            # 粒子爆散
│   ├── ripple/              # 漣漪圈
│   ├── firework/            # 煙火
│   ├── text/                # 浮現文字
│   ├── slash/               # slash 特效
│   ├── vortex/              # vortex 特效
│   ├── chrono-vortex/       # chrono-vortex 特效
│   ├── tear-slash/          # tear-slash 特效
│   ├── rocket/              # rocket 特效
│   ├── pixel-melt/          # pixel-melt 特效
│   ├── hyper-warp/          # hyper-warp 特效
│   ├── aurora/              # aurora 特效
│   ├── fire-dragon/         # fire-dragon 特效
│   ├── orbital-strike/      # orbital-strike 特效
│   └── magic-circle/        # magic-circle 特效
├── viewer/                  # viewer 嵌入腳本
│   ├── app.js               # SSE 接收、canvas 管理、特效引擎載入
│   └── effects.js           # Effects registry、座標換算、render loop
├── console/                 # console 嵌入 UI
│   ├── app.js               # 控制面板、特效選擇、參數、POST 行為
│   ├── icons.js             # SVG icons
│   └── style.css            # console 樣式
├── examples/                # opt-in 示範頁與新增特效範例
│   ├── index.html
│   ├── embed-viewer.html
│   ├── embed-console.html
│   ├── embed-both.html
│   ├── theme.css            # examples 淺色／深色主題
│   ├── theme.js             # examples 主題切換與 localStorage 記憶
│   └── effects/             # sample-burst、effect-interface 參考範例
├── tests/                   # 自動化測試
│   ├── conftest.py          # pytest path 設定
│   ├── test_api.py          # pytest：server API／manifest／SSE
│   ├── test_effects.mjs     # node：viewer 特效引擎
│   ├── test_console.mjs     # node：console DOM 行為
│   ├── test_effect_examples.mjs
│   ├── test_effect_catalog.mjs
│   ├── fixtures/effects.json # v1 測試 manifest（固定原四特效）
│   ├── fixtures/effects-v2.json # v2 測試 manifest（layout 與 enabled 行為）
│   └── e2e/                 # Playwright 瀏覽器 E2E
├── docs/
│   ├── HOW_TO_ADD_EFFECT.md # 新增特效指南
│   └── agents/              # AI 協作流程、任務追蹤、架構圖與工作報告
└── playwright.config.js     # Playwright E2E 設定
```

## 快速開始

建立虛擬環境並啟動 server：

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r server/requirements.txt
python -m uvicorn server.main:app --port 8000
```

Linux／macOS 啟用 venv：

```bash
source .venv/bin/activate
```

如需執行測試，安裝測試依賴：

```bash
pip install -r server/requirements-dev.txt
npm install
```

## 嵌入 viewer

在目標網頁加入：

```html
<script src="http://<server-host>:8000/viewer/app.js"></script>
```

viewer 會建立 canvas 疊層，並自動連線 server SSE。SSE `open` 與 `manifest` 事件會依 `rev` 重新載入特效插件；manifest 更新時不會清除目前進行中的特效。若 server 設定 `ACCESS_KEY`，需於 URL 加 `?key=<access-key>` 或依嵌入情境提供金鑰。

## 嵌入 console

在控制端網頁加入：

```html
<link rel="stylesheet" href="http://<server-host>:8000/console/style.css">
<script src="http://<server-host>:8000/console/icons.js"></script>
<script src="http://<server-host>:8000/console/app.js" data-key="..."></script>
```

也可在載入 `console/app.js` 前定義：

```js
window.CONTROL_CONFIG = {
  url: "http://<server-host>:8000",
  key: "<access-key>"
};
```

console 面板於［連線設定］下拉面板內提供 SVG［重載］按鈕，手動呼叫 `POST /api/effects/reload` 後重新套用 manifest 與 console 插件。console 不透過 SSE 自動重載；重新整理頁面亦會取得最新 `rev` 與特效清單。

console 特效按鈕以 `#rtx-fx-current`（主要）與 `#rtx-fx-alternate`（次要）兩個區塊呈現；`#rtx-fx-layout-btn` 可展開或收合次要區塊。拖曳特效按鈕或呼叫 `window.__rtxConsoleLayout.move(effectId, "current" | "alternate", beforeId)` 可移動特效，個人布局寫入 `localStorage` key `rtx.fx.layout.v2`。layout 優先序為個人 `localStorage`、server 正規化 layout、v1／fallback 全 current；manifest reload 後會移除未知、停用或重複 effect IDs。

## 示範頁（examples，opt-in）

`examples/` 預設停用。啟用後可瀏覽嵌入示範頁：

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

- `http://localhost:8000/examples/`
- `http://localhost:8000/examples/embed-viewer.html`
- `http://localhost:8000/examples/embed-console.html`
- `http://localhost:8000/examples/embed-both.html`

各示範頁右上角提供淺色／深色主題切換；選擇會儲存在 `localStorage`，未手動切換時跟随系統偏好。

## 特效插件

正式特效清單位於 `effects/effects.json`。目前正式 manifest 為 `version: 2`，包含 15 個啟用特效；`currentEffects` 目前列出全部 15 個特效，`alternateEffects` 為空。個別特效可加 `enabled: false` 停用；停用時不進入 `GET /api/effects`、不被 viewer 載入、不被 `POST /api/effect` 接受，也不檢查該特效的 `viewer.js` 是否存在。

- `particle`、`ripple`、`firework`、`text`
- `slash`、`vortex`、`chrono-vortex`、`tear-slash`
- `rocket`、`pixel-melt`、`hyper-warp`
- `aurora`、`fire-dragon`、`orbital-strike`、`magic-circle`

每個特效至少需要：

- `effects/<id>/viewer.js`：註冊 `window.Effects.register(id, factory)`
- `effects/effects.json` 中的 manifest entry：宣告 `viewer`、`params` schema、icon 等資訊

選配：

- `effects/<id>/console.js`：自訂 console 參數 UI、icon、渲染邏輯

修改 `effects/effects.json` 或特效插件後，可呼叫 `POST /api/effects/reload` 手動重載；server 會以 manifest 與 `viewer.js`／`console.js` 內容計算 `rev`。未變更時 `changed` 為 `false`；驗證失敗時保留舊 catalog 並回傳 `400`。

新增特效請參考 `docs/HOW_TO_ADD_EFFECT.md`；完整範例在 `examples/effects/sample-burst/`，最小介面參考 `examples/effects/effect-interface/`。

API／E2E 自動測試預設使用 `tests/fixtures/effects.json`，只包含原四特效：`particle`、`ripple`、`firework`、`text`。新特效加入正式 manifest 後，不會自動進入 API／E2E 預設測試；`tests/test_effect_catalog.mjs` 會自動納入正式 catalog 檢查。

## API 概述

| 路由 | 用途 |
| --- | --- |
| `GET /health` | 健康檢查 |
| `GET /api/effects` | 回傳 `rev`、`version`、清洗後啟用特效 manifest，以及正規化後的 `currentEffects`／`alternateEffects` |
| `POST /api/effects/reload` | 手動重載 manifest；變更時更新 catalog、廣播含 layout 的 SSE `manifest`，並回傳 `changed`、`rev` 與 effect id 清單 |
| `POST /api/effect` | 送出特效事件 |
| `POST /api/clear` | 清屏事件 |
| `GET /api/stream` | viewer SSE 串流（effect / clear / ping / manifest） |
| `GET /effects/effects.json` | 正式 manifest 檔案 |
| `GET /effects/{effect_id}/viewer.js` | 特效 viewer plugin |
| `GET /effects/{effect_id}/console.js` | 特效 console plugin（選用） |
| `GET /viewer/app.js`、`/viewer/effects.js` | viewer 嵌入資產 |
| `GET /console/app.js`、`/console/icons.js`、`/console/style.css` | console 嵌入資產 |

## 測試

Python API／server 測試：

```bash
python -m pytest tests/ -q
```

Node viewer／console 邏輯測試：

```bash
node --test tests/test_effects.mjs tests/test_console.mjs tests/test_effect_examples.mjs tests/test_effect_catalog.mjs
```

Playwright 瀏覽器 E2E：

```bash
npx playwright install chromium
npx playwright test
```

一次執行完整測試：

```bash
npm run test
```

目前測試數量：pytest 41 項、node 89 項（`test_console` 54、`test_effect_examples` 16、`test_effects` 18、`test_effect_catalog` 1）、Playwright E2E 14 項。

Playwright E2E 會自動啟動 server（port `8123`），並使用 `tests/fixtures/effects.json`，因此預設不會把新特效納入測試。`tests/e2e/reload-manifest.spec.js` 會另啟獨立 server 與 temp manifest，驗證 viewer 自動更新與 console 手動重載／重新整理。`tests/e2e/multi-console-reload.spec.js` 會另啟兩個獨立 server、temp manifest 與不同 `ACCESS_KEY`，驗證不同 server URL / key 的多 Console 端各自重載、被移除 effect 的 selected fallback，且互不影響。

## 文件

- `docs/HOW_TO_ADD_EFFECT.md`：新增特效指南
- `docs/agents/AGENTS.md`：AI 協作流程與交付規範
- `docs/agents/CALL_GRAPH.md`：系統架構與模組呼叫關係
- `docs/agents/TODO.md`：任務追蹤
- `docs/agents/reports/`：工作完成報告
