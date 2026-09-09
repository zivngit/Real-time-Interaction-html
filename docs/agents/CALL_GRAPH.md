# Real-time Interaction html 函式呼叫關係圖

## 模組責任

| 模組 | 主要責任 |
| --- | --- |
| `c/main.py` | 中繼後端（FastAPI）：驗證、限頻、SSE 廣播、提供 `/app.js`、`/effects.js` |
| `shared/effects.js` | 特效定義與動畫計算（particle/ripple/firework/text）、座標換算；browser/node 雙用（UMD） |
| `shared/app.js` | 顯示端嵌入腳本：canvas 疊層（pointer-events: none）、SSE 訂閱、rAF 渲染迴圈 |
| `a/index.html`＋`a/app.js` | 控制端：特效選擇、參數設定、點擊座標 → POST c |
| `b/index.html` | 顯示端獨立預覽頁（引用 shared/effects.js＋shared/app.js） |

## 1. 啟動與 c 端路由

```mermaid
flowchart TD
    A[uvicorn c.main:app] --> C[FastAPI app]
    C --> R1[POST /api/effect]
    C --> R2[POST /api/clear]
    C --> R3[GET /api/stream SSE]
    C --> R4[GET /api/effects]
    C --> R5[GET /app.js、/effects.js]
    C --> R6[GET /health]
    R1 --> P1[_check_key → _rate_limit → _broadcast]
    R2 --> P1
    P1 --> Q[(subscriber queues)]
    Q --> R3
```

## 2. 前端（a 控制、b 顯示）

```mermaid
flowchart TD
    A1[window click] --> A2[a/app.js post /api/effect]
    A3[清屏按鈕] --> A4[a/app.js post /api/clear]
    S1[SSE event: effect] --> B1[shared/app.js handleEffect]
    B1 --> B2[Effects.toPixels → Effects.createEffect]
    B2 --> B3[rAF tick：update / draw canvas]
    S2[SSE event: clear] --> B4[clearAll]
    S3[SSE event: ping] --> B5[lastPing 更新（離線偵測 log）]
```

## 3. 主要呼叫路徑（c）

| 路徑 | 說明 |
| --- | --- |
| `post_effect → _check_key → _rate_limit → _broadcast → queues → stream.generate` | 特效驗證並推送 |
| `post_clear → _check_key → _rate_limit → _broadcast → queues → stream.generate` | 清屏推送 |
| `stream → generate → queue.get(timeout=15) → event/ping` | SSE 串流；逾時發 ping 心跳 |
| `generate finally → _subscribers.discard` | 斷線清理訂閱 |

## 4. 測試關係

```mermaid
flowchart TD
    T1[tests/test_api.py] --> M[c/main.py]
    T2[tests/test_effects.mjs] --> S[shared/effects.js]
```

## 5. 未完成或未接線節點

| 節點 | 現況 |
| --- | --- |
| c 暫存最近 N 則（斷線重播） | 未實作（規格：預設不重播） |
| b 狀態回報（POST /api/status） | 未實作（規格：僅 log） |

執行測試：

```
python -m pytest tests/ -v
node --test tests/test_effects.mjs
```
