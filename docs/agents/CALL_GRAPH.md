# Real-time Interaction html 函式呼叫關係圖

> 最後更新：2026-09-15

## 1. 整體架構

```mermaid
flowchart LR
    C["examples/embed-console.html（＋embed-both.html）<br/>console/icons.js + console/app.js + console/style.css<br/>#rtx-fx-current / #rtx-fx-alternate / #rtx-fx-layout-btn<br/>examples/theme.css + examples/theme.js<br/>（選用載入 /effects/{id}/console.js 插件）"]
    S["server/main.py（app／routes）<br/>server/config.py + security.py + params.py + relay.py + static_files.py + logging.py<br/>server/effects.py（FastAPI）<br/>effects/effects.json（manifest，可被 RTX_EFFECTS_MANIFEST 覆寫）"]
    V["examples/embed-viewer.html（＋embed-both.html）<br/>viewer/app.js（Effects 未載入時動態載入 viewer/effects.js<br/>載入 /api/effects 後動態載入各 /effects/{id}/viewer.js）<br/>examples/theme.css + examples/theme.js"]
    E["examples/index.html＋theme.css/theme.js<br/>（demo／showcase 索引，opt-in：SERVE_EXAMPLES=1）"]
    LS[("localStorage<br/>rtx.srvUrl / rtx.srvKey / rtx.fx.layout.v2")]
    ET[("localStorage<br/>examples-theme")]
    C -->|"POST /api/effect、POST /api/clear、POST /api/effects/reload"| S
    C -->|"GET /api/effects"| S
    C -->|"GET /console/style.css、/console/icons.js、/console/app.js (no-store)"| S
    C -->|"GET /effects/{id}/console.js (no-store，選用)"| S
    S -->|"GET /api/stream<br/>(SSE: effect / clear / ping / manifest)"| V
    V -->|"GET /viewer/app.js、/viewer/effects.js (no-store)"| S
    V -->|"GET /api/effects、/effects/{id}/viewer.js (no-store)"| S
    S -->|"GET /examples/*（no-store，opt-in）"| E
    E -->|"連結 embed-*.html"| C
    E -->|"連結 embed-*.html"| V
    LS -.-> C
    ET -.-> C
    ET -.-> V
    ET -.-> E
```

## 2. server 路由與請求驗證

> 節點依管線階層由上至下排列（進入點 → 驗證 → 廣播/串流），同階層以 subgraph 分組，錯誤回應與簡單回應各置獨立分組，避免關係線交錯。

```mermaid
flowchart TD
    subgraph entry["HTTP 進入點"]
        direction LR
        PE["POST /api/effect"]
        PC["POST /api/clear"]
        PR["POST /api/effects/reload"]
        ST["GET /api/stream"]
        H["GET /health"]
        LE["GET /api/effects"]
        JS["GET /viewer/app.js / /viewer/effects.js / /console/app.js / /console/icons.js / /console/style.css"]
        EF["GET /effects/effects.json / /effects/{id}/viewer.js / /effects/{id}/console.js"]
        EX["GET /examples / /examples/ / /examples/{path}"]
    end

    subgraph guard["驗證"]
        CK["check_key（server/security.py；POST 用 X-Access-Key、SSE 用 ?key=）"]
        VE{"effect 在 EFFECTS 中？"}
        NP["normalize_params（server/params.py；schema 驗證，無效值回退預設）"]
        RL["RateLimiter.check（server/relay.py；滑動視窗 20/s）"]
        RRL["reload_limiter.check（server/relay.py；滑動視窗 1/s）"]
        RE{"catalog fingerprint 變更？"}
        EN{"examples_enabled（server/static_files.py）：SERVE_EXAMPLES 啟用？"}
        EP{"effect_asset（server/static_files.py）：effect_id 合法＋檔案存在？"}
    end

    subgraph push["廣播 / SSE 串流"]
        BC["broadcast（server/relay.py）：put_nowait 至各訂閱 queue"]
        SUB["add_subscriber（server/relay.py）：_subscribers.add(queue)"]
        GEN["event_stream（server/relay.py）：retry: 3000 → queue.get(timeout=15s)"]
        PING["yield event: ping（心跳）"]
        MSG["yield event: effect / clear / manifest"]
        DIS["remove_subscriber（server/relay.py）：_subscribers.discard(queue)（finally）"]
    end

    subgraph err["錯誤回應"]
        direction LR
        E401["HTTP 401 invalid access key"]
        E400["HTTP 400 unknown effect／manifest 驗證失敗"]
        E429["HTTP 429 rate limit exceeded（Retry-After: 1）"]
        E404["HTTP 404 examples 停用／effects 資產不存在"]
    end

    subgraph plain["簡單回應"]
        direction LR
        OK["200 {ok, ts}"]
        LOK["200 {rev, version, effects, currentEffects, alternateEffects}"]
        RLOK["200 {ok, changed, rev, effects}"]
        FR["FileResponse（server/static_files.py；no-store）"]
    end

    PE --> CK
    PC --> CK
    PR --> CK
    ST --> CK
    CK -- "金鑰不符" --> E401
    CK -- "effect 請求" --> VE
    CK -- "clear 請求" --> RL
    CK -- "reload 請求" --> RRL
    CK -- "stream 請求" --> SUB
    VE -- "否" --> E400
    VE -- "是" --> NP
    NP --> RL
    RL -- "超限" --> E429
    RL --> BC
    RRL -- "超限" --> E429
    RRL --> RE
    RE -- "否" --> RLOK
    RE -- "是（reload_effects → _apply_catalog → broadcast manifest）" --> RLOK
    SUB --> GEN
    GEN -- "15s 逾時" --> PING
    GEN -- "收到訊息" --> MSG
    GEN -. "循環：get → yield → get" .-> GEN
    GEN -. "斷線 → finally" .-> DIS
    H --> OK
    LE --> LOK
    JS --> FR
    EF --> EP
    EP -- "否" --> E404
    EP -- "是（解析路徑於 effects/ 內）" --> FR
    EX --> EN
    EN -- "否" --> E404
    EN -- "是（解析路徑於 examples/ 內）" --> FR
```

## 3. 即時互動序列（console → server → viewer）

```mermaid
sequenceDiagram
    autonumber
    participant C as console（console/app.js）
    participant S as server（server/main.py）
    participant V as viewer（viewer/app.js）

    Note over C: examples/embed-console.html（＋embed-both.html）載入 /console/style.css＋/console/icons.js＋/console/app.js\n初始化 → loadEffects() fetch /api/effects\n成功 → loadConsolePlugins()（依 consoleUrl 動態載入 /effects/{id}/console.js，失敗僅 log 回退）→ renderEffects(meta, payload, persist) 以 server 正規化 currentEffects／alternateEffects 渲染 #rtx-fx-current／#rtx-fx-alternate（icon 優先序：插件 iconSVG → 插件 iconID → manifest icon → RTX_EFFECT_ICONS[type] → generic → fallback；未知特效 generic）\nlayout 優先序：localStorage rtx.fx.layout.v2 → server payload layout → v1／fallback 全 current；sanitizeLayout() 移除未知、重複、disabled 與 stale IDs\n#rtx-fx-layout-btn → toggle #rtx-fx-alternate.open 並同步 #rtx-fx-layout.fx-locked（次要區關閉時 fx-locked）\npointerdown .rtx-fx → fxDragEnabled()（#rtx-fx-alternate 未 .open 時直接回傳，不 preventDefault、click 維持有效）→ 移動超過 DRAG_SLOP_PX 8px 激活 fxDrag（.rtx-fx.dragging、zIndex 30、pointerEvents none）→ window pointermove：fxZoneAt 決定 target zone（fxElementFromPoint 僅用於 zone 判斷 fallback）→ fxStoreLayoutRects() 以 fxMeasureLayoutRect() 刷新 __fxLayoutRect → fxInsertionRef：dragged button 在 target zone 時，僅在 pointer 距 non-dragged button center 在 FX_DRAG_TRIGGER_PX 30px 內才回傳 reorder ref（before／after 以 pointer x 與該按鈕 center 比較、nextAfter 取 row-major 順序），否則回傳維持目前位置的 ref；dragged button 不在 target zone 時以 fxLayoutRect／__fxLayoutRect 在 4 欄 grid 做 row-major 插入 → fxReorderTo 即時 reorder（target 順序與目前順序相等時跳過 insertBefore 與 FLIP；插入 DOM 後再 fxStoreLayoutRects()）＋fxFollowCursor 先 fxMeasureLayoutRect() 再 translate/scale(1.08) → pointerup／pointercancel：fxReleaseDrag → syncLayoutFromDom()／saveLayout()／renderFxZone() 並抑制下一次 click；window.__rtxConsoleLayout.move(effectId, targetBlock, beforeId) → moveEffect() → syncLayoutFromDom()／saveLayout()／renderFxZone()；renderFxZone 重建前先 fxStoreLayoutRects()，再於重建與 pointer reorder 即時移動播放 180ms FLIP 動畫 fxCaptureRects／fxPlayMove，prefers-reduced-motion: reduce 時停用\n失敗/空表 → fallback 內建特效\nrenderParams()：已註冊 console 插件優先 plugin.render()，否則依 schema 渲染（editable:false 與 array 不顯示）\nparamsBtn / connBtn → bindToggle()（展開時 applyFabPos()）\napplyFabPos() → panelCandidates() 選最小重疊位置；FAB z-index 高於 panel
    Note over V: examples/embed-viewer.html（＋embed-both.html）載入 /viewer/app.js\n/viewer/app.js 若 Effects 未載入會動態載入 /viewer/effects.js\nfetch /api/effects → 並行動態載入各 /effects/{id}/viewer.js（單一失敗僅 log 並跳過該特效）
    Note over C: 手動重載：展開 #rtx-conn-panel → 點擊 SVG #rtx-reload-btn → POST /api/effects/reload → GET /api/effects → applyManifest(rev, resetRegistry=true)
    C->>S: POST /api/effects/reload
    S->>S: check_key → reload_limiter.check(1) → reload_effects（fingerprint 未變則 changed=false；驗證失敗回 400 並保留舊 catalog；v2 layout 中 disabled ID 正規化時過濾並記 warning，不視為驗證錯誤）
    S-->>V: SSE event: manifest（changed=true 時，含 rev/effects）
    V->>V: loadViewerPlugins：Effects.reset → 依 rev cache-busting 載入 viewer.js；不清除 active effects
    C->>C: reloadEffectsTable：GET /api/effects → loadConsolePlugins → renderEffects
    C->>C: 選特效 → selectEffect() → renderParams()
    C->>C: 點擊 → paramsFor() 讀取 rtx-p-* 輸入
    C->>S: POST /api/effect {effect, x, y, params}
    S->>S: check_key → effect 驗證 → normalize_params（schema 驗證）→ RateLimiter.check → broadcast
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
        +registry
        +register(type, factory)
        +reset()
        +createEffect(type, px, py, params)
        +stepEffect(effect, targetElapsed, maxStep)
        +toPixels(x, y, w, h)
        +toPercent(px, py, w, h)
        +clamp(v, lo, hi)
    }
    class EffectPlugin {
        <<effects/<id>/viewer.js>>
        +factory(x, y, params) → Effect
    }
    class ConsolePlugin {
        <<effects/<id>/console.js（選用）>>
        +iconID（RTX_EFFECT_ICONS key）
        +iconSVG（raw SVG 字串）
        +render(container, api)
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
        +loadViewerPlugins(effects, rev)
    }
    class EffectCatalog {
        <<server/effects.py>>
        +MANIFEST
        +EFFECTS
        +MANIFEST_REV
        +MANIFEST_VERSION
        +MANIFEST_CURRENT_EFFECTS
        +MANIFEST_ALTERNATE_EFFECTS
        +load_manifest()
        +reload_effects()
    }
    class ServerConfig {
        <<server/config.py>>
        +ACCESS_KEY
        +RATE_LIMIT_PER_SEC
        +LOG_LEVEL / LOG_FILE / LOG_FILE_MAX_BYTES / LOG_FILE_BACKUP_COUNT
    }
    class Security {
        <<server/security.py>>
        +check_key()
    }
    class Params {
        <<server/params.py>>
        +normalize_params(effect_id, raw, effects)
    }
    class Relay {
        <<server/relay.py>>
        +add_subscriber(queue)
        +remove_subscriber(queue)
        +broadcast(msg)
        +event_stream(queue, is_disconnected)
    }
    class RateLimiter {
        <<server/relay.py>>
        +reset()
        +check(limit_per_sec)
    }
    class StaticFiles {
        <<server/static_files.py>>
        +file_response(path, media_type, detail)
        +effect_asset(effect_id, filename, client)
        +examples_enabled()
        +examples_response(path)
    }
    class Logging {
        <<server/logging.py>>
        +configure_logging(level, file_path, max_bytes, backup_count)
        +client_host(request)
        +resolve_level(level)
    }
    class Server {
        <<server/main.py>>
        +list_effects()
        +reload_manifest()
        +post_effect()
        +post_clear()
        +stream()
    }
    class Console {
        +fxLayoutState
        +saveCfg()
        +applyFabPos()
        +panelCandidates()
        +panelSize()
        +clampPanelPos(x, y, w, h)
        +overlapArea(a, b)
        +isSvgString(v)
        +resolvedPluginIcon(type)
        +iconFor(type, meta)
        +hasIconFor(type, meta)
        +uiIcon(name)
        +genericFields(params)
        +fieldDefs(type)
        +renderParams()
        +selectEffect(type)
        +fallbackLayout(effectKeys)
        +storedLayout()
        +saveLayout()
        +normalizeLayout(data)
        +sanitizeLayout(layout, effectKeys)
        +zoneTypes(zone)
        +fxCaptureRects()
        +fxLayoutRect(btn)
        +fxMeasureLayoutRect(btn)
        +fxStoreLayoutRects()
        +fxPlayMove(rects, skipBtn)
        +fxNextFrame(fn)
        +fxElementFromPoint(x, y)
        +fxZoneAt(x, y)
        +fxInsertionRef(zone, x, y, dragged)
        +fxReorderTo(x, y)
        +fxFollowCursor(x, y)
        +fxReleaseDrag()
        +fxEndPointer()
        +syncLayoutFromDom(preRects)
        +moveEffect(effectId, targetBlock, beforeId)
        +makeFxButton(type, zone)
        +renderFxZone(preRects)
        +renderEffects(meta, payload, persist)
        +normalizeEffects(data)
        +loadEffects()
        +loadConsolePlugins(meta, rev)
        +applyManifest(meta, rev, payload, resetRegistry)
        +reloadEffectsTable()
        +bindToggle(btn, box)
        +headers()
        +paramsFor()
        +post(path, body)
    }
    Viewer ..> Effects : toPixels / createEffect / stepEffect
    EffectPlugin ..> Effects : register(type, factory)
    Effects ..> Effect : 依 manifest 動態建立 effects/*/viewer.js 特效
    Console ..> ConsolePlugin : 選用 render／iconID／iconSVG（缺失時 schema 渲染／manifest icon）
    Console ..> Server : POST /api/effect / POST /api/clear / POST /api/effects/reload
    Server ..> EffectCatalog : 讀取 EFFECTS / MANIFEST / MANIFEST_REV / MANIFEST_VERSION / MANIFEST_CURRENT_EFFECTS / MANIFEST_ALTERNATE_EFFECTS / MANIFEST_PATH；reload_effects()
    Server ..> ServerConfig : ACCESS_KEY / RATE_LIMIT_PER_SEC
    Server ..> Security : check_key()
    Server ..> Params : normalize_params()
    Server ..> Relay : add_subscriber / broadcast / event_stream
    Server ..> RateLimiter : rate_limiter.check() / reload_limiter.check(1)
    Server ..> StaticFiles : file_response / effect_asset / examples_response
    Server ..> Logging : configure_logging() / client_host()
    Logging ..> ServerConfig : LOG_LEVEL / LOG_FILE / LOG_FILE_MAX_BYTES / LOG_FILE_BACKUP_COUNT
    Params ..> EffectCatalog : effects 參數缺省時讀取 EFFECTS
    EffectCatalog ..> EffectPlugin : manifest 宣告 /effects/<id>/viewer.js
    Server ..> Viewer : SSE effect / clear / ping / manifest
```

## 6. 測試關係

```mermaid
flowchart LR
    TF["tests/fixtures/effects.json＋effects-v2.json<br/>v1／v2 測試 manifest"]
    TA["tests/test_api.py<br/>pytest＋TestClient（61）<br/>v1／v2 fixture manifest、enabled filtering、layout 正規化、disabled-in-layout 過濾回歸、SSE manifest 結構、temp reload manifest、caplog 事件 log（broadcast／SSE／rate_limited／auth_denied／manifest／params_fallback／asset_missing）"] --> M["server/main.py<br/>＋server/config.py、security.py、params.py、relay.py、static_files.py、effects.py"]
    TA --> TF
    TS["tests/test_server_logging.py<br/>pytest（12）<br/>configure_logging／client_host／resolve_level、env 覆蓋、idempotent、lifespan log"] --> LG["server/logging.py"]
    LG --> M
    TE["tests/test_effects.mjs<br/>node --test＋vm（18）"] --> S["viewer/effects.js ＋ effects/*/viewer.js"]
    TC["tests/test_console.mjs<br/>node --test＋vm DOM stub（72）<br/>v1／v2 payload、雙區渲染、layout button（含 fx-locked 同步）、fx move 動畫、次要區關閉時拖曳停用、pointer drag row-major insertion、slop／click suppression／pointercancel、move hook、localStorage"] --> K["console/app.js ＋ effects/*/console.js"]
    TX["tests/test_effect_examples.mjs<br/>node --test＋vm fake sandbox（16）"] --> X["examples/effects/*/effects.json ＋ viewer.js ＋ console.js"]
    TG["tests/test_effect_catalog.mjs<br/>node --test＋vm（2）<br/>正式 effects/effects.json、effects/*/viewer.js、選用 console.js"] --> S
    TG --> K
    TP["tests/e2e/*.spec.js<br/>Playwright E2E（28）<br/>預設 webServer port 8123<br/>fx-layout.spec.js 驗證 v2 雙區、move（含 FLIP 動畫與相鄰按鈕順移）、次要區關閉時拖曳停用（cursor pointer、click 仍可選、開啟後拖曳恢復）、pointer drag 往返（Playwright mouse，含 FLIP 動畫與相鄰按鈕順移）、hovered button 右半側 pointer drag 插入其後、從上方／下方接近 target row 的 refreshed layout pointer drag、空次要區 pointer drag、localStorage、reload fallback<br/>fx-drag-trigger-distance.spec.js 以 8 方向驗證 pointer 拖曳觸發距離（約 30px）與預期插入 order<br/>reload-manifest.spec.js 另啟獨立 server＋temp manifest<br/>multi-console-reload.spec.js 另啟兩個獨立 server／key＋selected fallback"] --> M
    TP --> K
    TP --> S
    TP --> TF
```

## 7. 未完成或未接線節點

| 節點 | 現況 |
| --- | --- |
| server 暫存最近 N 則（斷線重播） | 未實作（規格：預設不重播） |
| viewer 狀態回報（POST /api/status） | 未實作（規格：僅 log） |
| examples/effects/*（sample-burst、effect-interface） | 僅為新增特效的參考範例（docs/HOW_TO_ADD_EFFECT.md），未登記於正式 manifest `effects/effects.json`，server 不服務 |

執行測試：

```
python -m pytest tests/ -q
node --test tests/test_effects.mjs tests/test_console.mjs tests/test_effect_examples.mjs tests/test_effect_catalog.mjs
npx playwright test
```

## 8. 日誌事件與輸出流

所有 log 由 `server` logger 樹（`server.<module>`）發出；handler 僅掛於 `server` logger（`configure_logging()`，`server/logging.py:27-52`，於 `server/main.py:15` import 階段呼叫）。輸出：console StreamHandler＋RotatingFileHandler（預設 `server.log`，`RTX_LOG_FILE` 設為空可停用檔案輸出）。

```mermaid
flowchart LR
    Env["RTX_LOG_LEVEL / RTX_LOG_FILE<br/>RTX_LOG_FILE_MAX_BYTES / RTX_LOG_FILE_BACKUP_COUNT"] --> Cfg["server/config.py"]
    Cfg --> Logging["server/logging.py<br/>configure_logging()"]
    Logging --> ServerLogger["logger: server.*<br/>層級／格式／handlers"]
    Lifecycle["server/main.py lifespan<br/>server_started / server_stopped（INFO）"] --> ServerLogger
    Auth["server/security.py check_key<br/>auth_denied（WARNING）"] --> ServerLogger
    Broadcast["server/relay.py broadcast<br/>effect／clear／manifest_broadcast（INFO）"] --> ServerLogger
    SSE["server/relay.py event_stream<br/>sse_connected / sse_disconnected（INFO）、sse_ping（DEBUG）"] --> ServerLogger
    Limit["server/relay.py RateLimiter.check<br/>rate_limited（WARNING）"] --> ServerLogger
    Manifest["server/effects.py<br/>manifest_loaded / manifest_reloaded（INFO）、manifest_layout_filtered（WARNING）"] --> ServerLogger
    ReloadFail["server/main.py reload_manifest<br/>manifest_reload_failed（ERROR）"] --> ServerLogger
    Params["server/params.py normalize_params<br/>params_fallback（DEBUG）"] --> ServerLogger
    Asset["server/static_files.py effect_asset<br/>asset_missing（WARNING）"] --> ServerLogger
    ServerLogger --> Console["console stdout"]
    ServerLogger --> File["RotatingFileHandler<br/>RTX_LOG_FILE（預設 server.log，5MB × 3）"]
```

安全規則：log 不含 `ACCESS_KEY` 值與 client 參數值；`client` 欄位為 host-only（`client_host()` 優先 `X-Forwarded-For` 第一跳）。
