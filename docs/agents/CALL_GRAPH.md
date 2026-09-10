# Real-time Interaction html 函式呼叫關係圖

> 最後更新：2026-09-10

## 1. 整體架構

```mermaid
flowchart LR
    C["console/index.html<br/>console/icons.js + console/app.js + console/style.css"]
    S["server/main.py<br/>server/effects.py（FastAPI）"]
    V["viewer/index.html<br/>viewer/effects.js + shared/app.js + viewer/style.css"]
    LS[("localStorage<br/>rtx.srvUrl / rtx.srvKey")]
    C -->|"POST /api/effect、POST /api/clear"| S
    C -->|"GET /api/effects"| S
    S -->|"GET /api/stream<br/>(SSE: effect / clear / ping)"| V
    S -->|"GET /app.js、/effects.js (no-store)"| V
    S -->|"GET /icons.js、/console.js、/console.css (no-store)"| C
    LS -.-> C
```

## 2. server 路由與請求驗證

> 節點依管線階層由上至下排列（進入點 → 驗證 → 廣播/串流），同階層以 subgraph 分組，錯誤回應與簡單回應各置獨立分組，避免關係線交錯。

```mermaid
flowchart TD
    subgraph entry["HTTP 進入點"]
        direction LR
        PE["POST /api/effect"]
        PC["POST /api/clear"]
        ST["GET /api/stream"]
        H["GET /health"]
        LE["GET /api/effects"]
        JS["GET /app.js / /effects.js / /icons.js / /console.js / /console.css"]
    end

    subgraph guard["驗證"]
        CK["_check_key（X-Access-Key / ?key）"]
        VE{"effect 在 EFFECTS 中？"}
        RL["_rate_limit（滑動視窗 20/s）"]
    end

    subgraph push["廣播 / SSE 串流"]
        BC["_broadcast：put_nowait 至各訂閱 queue"]
        SUB["_subscribers.add(queue)"]
        GEN["generate（循環）：retry: 3000 → queue.get(timeout=15s)"]
        PING["yield event: ping（心跳）"]
        MSG["yield event: effect / clear"]
        DIS["_subscribers.discard(queue)（finally）"]
    end

    subgraph err["錯誤回應"]
        direction LR
        E401["HTTP 401 invalid access key"]
        E400["HTTP 400 unknown effect"]
        E429["HTTP 429 rate limit exceeded"]
    end

    subgraph plain["簡單回應"]
        direction LR
        OK["200 {ok, ts}"]
        LOK["200 EFFECTS 目錄"]
        FR["FileResponse（no-store）"]
    end

    PE --> CK
    PC --> CK
    ST --> CK
    CK -- "金鑰不符" --> E401
    CK -- "effect 請求" --> VE
    CK -- "clear 請求" --> RL
    CK -- "stream 請求" --> SUB
    VE -- "否" --> E400
    VE -- "是" --> RL
    RL -- "超限" --> E429
    RL --> BC
    SUB --> GEN
    GEN -- "15s 逾時" --> PING
    GEN -- "收到訊息" --> MSG
    GEN -. "循環：get → yield → get" .-> GEN
    GEN -. "斷線 → finally" .-> DIS
    H --> OK
    LE --> LOK
    JS --> FR
```

## 3. 即時互動序列（console → server → viewer）

```mermaid
sequenceDiagram
    autonumber
    participant C as console（console/app.js）
    participant S as server（server/main.py）
    participant V as viewer（shared/app.js）

    Note over C: console/index.html 載入 console/style.css＋console/icons.js＋console/app.js\n嵌入時載入 /console.css＋/icons.js＋/console.js\n初始化 → loadEffects() fetch /api/effects\n成功 → renderEffects() 動態建立特效按鈕（未知特效 generic）\n失敗/空表 → fallback 內建特效\nparamsBtn / connBtn → bindToggle()（展開時 applyFabPos()）\napplyFabPos() → panelCandidates() 選最小重疊位置；FAB z-index 高於 panel
    Note over V: viewer/index.html 載入 viewer/style.css＋viewer/effects.js＋shared/app.js\n嵌入時 /app.js 若 Effects 未載入會動態載入 /effects.js
    C->>C: 選特效 → selectEffect() → renderParams()
    C->>C: 點擊 → paramsFor() 讀取 rtx-p-* 輸入
    C->>S: POST /api/effect {effect, x, y, params}
    S->>S: _check_key → effect 驗證 → _rate_limit → _broadcast
    S-->>V: SSE event: effect
    V->>V: handleEffect：Effects.toPixels → Effects.createEffect → born/elapsed
    V->>V: spawn → tick（rAF＋setInterval 100ms）
    C->>S: POST /api/clear
    S-->>V: SSE event: clear
    V->>V: clearAll：active=[]＋clearRect＋log
    S-->>V: SSE event: ping（15s 無事件時）
    V->>V: lastPing 更新（逾 45s 未收到 ping → log 一次）
    Note over V: EventSource open/error → 連線狀態切換 log
```

## 4. viewer 特效渲染生命週期

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Active : handleEffect → createEffect → spawn
    Active --> Active : tick：stepEffect（牆時計時、子步 ≤50ms）→ 移除完成特效 → clearRect → 重繪 active
    Active --> Idle : 全部 done() 或 clearAll
    note right of Active
        rAF 前台平滑；setInterval 100ms 背景補幀
        牆時計時：elapsed 推進至 now-born，不依賴幀率
    end note
```

## 5. 模組依賴與主要呼叫路徑

```mermaid
classDiagram
    class Effects {
        +EFFECTS
        +createEffect(type, px, py, params)
        +stepEffect(effect, targetElapsed, maxStep)
        +toPixels(x, y, w, h)
        +toPercent(px, py, w, h)
        +clamp(v, lo, hi)
    }
    class Effect {
        +update(dt)
        +done()
        +draw(ctx)
        +born
        +elapsed
    }
    class Viewer {
        +boot()
        +resize()
        +tick()
        +spawn()
        +clearAll()
        +handleEffect(msg)
    }
    class EffectCatalog {
        <<server/effects.py>>
        +EFFECTS
    }
    class Server {
        +post_effect()
        +post_clear()
        +stream()
        +_check_key()
        +_rate_limit()
        +_broadcast()
    }
    class Console {
        +saveCfg()
        +applyFabPos()
        +panelCandidates()
        +panelSize()
        +clampPanelPos(x, y, w, h)
        +overlapArea(a, b)
        +iconFor(type)
        +genericFields(params)
        +fieldDefs(type)
        +renderParams()
        +selectEffect(type)
        +renderEffects(meta)
        +normalizeEffects(data)
        +loadEffects()
        +bindToggle(btn, box)
        +headers()
        +paramsFor()
        +post(path, body)
    }
    Viewer ..> Effects : toPixels / createEffect / stepEffect
    Effects ..> Effect : 建立（particle / firework / ripple / text）
    Console ..> Server : POST /api/effect / POST /api/clear
    Server ..> EffectCatalog : 讀取 EFFECTS
    Server ..> Viewer : SSE effect / clear / ping
```

## 6. 測試關係

```mermaid
flowchart LR
    TA["tests/test_api.py<br/>pytest＋TestClient（15）"] --> M["server/main.py"]
    TE["tests/test_effects.mjs<br/>node --test（13）"] --> S["viewer/effects.js"]
    TC["tests/test_console.mjs<br/>node --test＋vm DOM stub（38）"] --> K["console/app.js"]
```

## 7. 未完成或未接線節點

| 節點 | 現況 |
| --- | --- |
| server 暫存最近 N 則（斷線重播） | 未實作（規格：預設不重播） |
| viewer 狀態回報（POST /api/status） | 未實作（規格：僅 log） |

執行測試：

```
python -m pytest tests/ -v
node --test tests/test_effects.mjs tests/test_console.mjs
```
