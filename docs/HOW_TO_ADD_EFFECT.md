# 如何加入新特效

本專案的特效由專案根目錄的 `effects/effects.json`（manifest）集中驅動。正式新增一個特效時，只需修改該檔案並建立對應插件檔案，`server/`、`viewer/`、`console/` 的程式碼不需要修改。

## 用編輯器（推薦）

server 內建視覺化特效編輯器：`http://<server-host>:8000/editor/`。無須手動編輯 JSON，manifest／meta／params 編輯、`viewer.js`／`console.js` 代碼編輯與即時預覽都可在瀏覽器完成（詳見 README「特效編輯器」節）。

使用注意：

- 寫入端點需 `X-Access-Key`（首次輸入存 `localStorage`，與 server `ACCESS_KEY` 相同）；寫入受獨立限頻（1/s，快速儲存回 `429`），以舊 `baseRev` 儲存回 `409`。
- 讀取端點不需金鑰；category 為 console 分組欄位，現不在編輯器內編輯。

手動方式仍可照舊：直接改 `effects/effects.json` 與插件檔案後呼叫 `POST /api/effects/reload`（需 `X-Access-Key`）。以下各節為手動方式說明。

## 1. 需要修改的檔案

| 檔案 | 必要 | 說明 |
| --- | --- | --- |
| `effects/effects.json` | 是 | 在 `effects` 下新增一個 entry，key 為 effect ID |
| `effects/<effect_id>/viewer.js` | 是 | viewer 渲染插件，呼叫 `window.Effects.register("<effect_id>", factory)` |
| `effects/<effect_id>/console.js` | 否 | console 自訂參數 UI 插件，呼叫 `window.RTX_EFFECT_CONSOLE.register("<effect_id>", { iconID, iconSVG, render })` |

缺少 `console.js` 時，console 核心會依 `params` schema 自動渲染通用控制項。

正式 manifest 目前為 version 2；新增 enabled 特效時，除了 `effects` entry，也應把 effect ID 加入 `currentEffects` 或 `alternateEffects`。若兩者皆未加入，server 仍可將該特效正規化到 `alternateEffects`，但正式 catalog 測試會 warning。

## 2. 範例參考

| 資料夾 | 用途 |
| --- | --- |
| `examples/effects/sample-burst/` | 完整範例：展示所有可選 manifest 欄位與所有 params 型別、可選欄位 |
| `examples/effects/effect-interface/` | 最小介面參考：manifest、`viewer.js`、`console.js` 的最小可用形態 |

注意：這兩個資料夾**不是正式 server manifest**。server 啟動時只讀取根目錄的 `effects/effects.json`；範例資料夾內的 `effects.json` 只是仿照正式格式（單一 effect manifest）供查閱與複製。要正式啟用範例特效，需將檔案複製到 `effects/<effect_id>/` 並在根目錄 `effects/effects.json` 登記。

## 3. effect ID 規則

- 只允許 `[A-Za-z0-9_-]+`（見 `server/effects.py` 的 `EFFECT_ID_RE`）。
- 目錄名 `effects/<effect_id>/` 與 manifest 的 key 必須一致。
- `viewer`／`console` 欄位值只能是純檔名（不可含路徑分隔符）。
- `viewer` 檔（預設 `viewer.js`）對 `enabled: true` 或省略 `enabled` 的特效必須存在，否則 server 啟動失敗（fail-fast）。
- `enabled: false` 的特效不會被 server 載入為可發送 effect，也不會檢查 `effects/<effect_id>/viewer.js` 是否存在。
- `console` 檔（預設 `console.js`）可不存在；不存在時該特效視為無 console 插件（`/api/effects` 回傳 `consoleUrl: null`）。

## 4. manifest 欄位

```json
{
  "version": 2,
  "effects": {
    "<effect_id>": {
      "label": "顯示名稱",
      "category": "分組",
      "icon": "icon key",
      "viewer": "viewer.js",
      "console": "console.js",
      "params": {},
      "enabled": true
    }
  },
  "currentEffects": ["<effect_id>"],
  "alternateEffects": []
}
```

| 欄位 | 必要 | 說明 |
| --- | --- | --- |
| `version` | 是 | `1` 或 `2`；正式 `effects/effects.json` 目前為 `2` |
| `effects` | 是 | object，key 為 effect ID，不可為空 |
| `currentEffects` | version 2 必要 | 陣列；console「主要」區塊的 enabled effect ID 順序；不可含未知、停用、重複或與 `alternateEffects` 重複的 ID |
| `alternateEffects` | version 2 必要 | 陣列；console「次要」區塊的 enabled effect ID 順序；規則同 `currentEffects` |
| `label` | 否 | 預設使用 effect ID |
| `category` | 否 | console 分組用 |
| `icon` | 否 | `console/icons.js` 中 `RTX_EFFECT_ICONS` 的 key（現行：`particle`／`ripple`／`firework`／`text`／`generic`） |
| `viewer` | 否 | 預設 `viewer.js`；enabled 特效的檔案必須存在 |
| `console` | 否 | 預設 `console.js`；檔案不存在則視為無 console 插件 |
| `params` | 否 | 參數 schema；預設 `{}` |
| `enabled` | 否 | boolean；缺少視為 `true`。`false` 時該特效不進入 API catalog、不被 viewer 載入、不被 `POST /api/effect` 接受，也不檢查 `viewer.js` 是否存在 |

version 1 manifest 不得包含 `currentEffects` 或 `alternateEffects`；server 會將 version 1 正規化為「所有 enabled effects 放 `currentEffects`、`alternateEffects` 為空」。version 2 中，enabled effect 若未列入任一陣列，server 會自動追加到 `alternateEffects` 後段；正式 catalog 測試會對此 warning。

## 5. params schema

支援型別：`integer`／`number`／`string`／`color`／`boolean`／`select`／`array`。

共通欄位：

| 欄位 | 必要 | 說明 |
| --- | --- | --- |
| `type` | 是 | 上述任一型別 |
| `label` | 否 | console 顯示用 |
| `default` | 是 | 預設值 |
| `editable` | 否 | 預設 `true`；`false` 時 console 不顯示輸入項，server 忽略客戶端值並改用 `default` |

型別專屬欄位：

- `integer`／`number`：`min`、`max`、`step`
- `string`：`maxLength`
- `select`：`options` 必要，為 `[{ "value": ..., "label": ... }]`
- `array`：`items`（元素型別）、`minItems`、`maxItems`；建議初期只以 `editable: false` 使用

## 6. server 驗證行為

server 啟動時驗證 manifest（`version`、effect ID、`enabled` 型別、enabled 特效的 `viewer` 檔存在、version 2 的 `currentEffects`／`alternateEffects` 合法性）。`POST /api/effect` 收到的 `params` 會依 schema 正規化後才廣播：

| 情境 | 行為 |
| --- | --- |
| 缺參數 | 填 `default` |
| unknown param | 忽略 |
| `editable: false` | 忽略客戶端值，使用 `default` |
| `integer` | round 後 clamp 到 `min`／`max` |
| `number` | clamp 到 `min`／`max` |
| `string` | 非字串用 `default`；超過 `maxLength` 則截斷 |
| `color` | 不合 `#rrggbb`／`#rrggbbaa` 用 `default` |
| `boolean` | 非 boolean 用 `default` |
| `select` | 不在 `options.value` 用 `default` |
| `array` | 非 array 用 `default`；短於 `minItems` 用 `default`；超過 `maxItems` 截斷；元素值依 `items` 型別驗證 |

server 靜態路由 `GET /effects/{effect_id}/viewer.js` 與 `GET /effects/{effect_id}/console.js` 會服務插件檔（`Cache-Control: no-cache`＋`ETag`；客戶端以 `If-None-Match` 重驗證時內容未變回 `304`，禁止 path traversal）。`GET /api/effects` 與 SSE `manifest` 事件的每個特效另含 `viewerRev`／`consoleRev`（該特效插件檔內容的 SHA-256），viewer／console／editor 以此做 per-effect cache-busting（`?v=viewerRev`／`?v=consoleRev`），僅變更的插件才會實際重新下載與執行；插件 script 節點帶 `data-rtx-effect`／`data-rtx-rev` 標記、注入前移除已完成舊節點（prune、in-flight 保留），防重複載入時 DOM 累積。

修改 manifest 或特效插件後，可呼叫 `POST /api/effects/reload` 手動重載（POST 端僅可透過 `X-Access-Key` header 提供金鑰；不接受 `?key=` query 或 POST body 金鑰）。server 會重新讀取 manifest、驗證 schema、計算包含 manifest 與 `viewer.js`／`console.js` 內容的 fingerprint `rev`；fingerprint 未變時回傳 `changed: false`，驗證失敗時保留舊 catalog 並回傳 `400`。viewer 會依 SSE `manifest` 自動更新插件；console 需展開［連線設定］後點［重載］，或重新整理頁面。

## 7. viewer 插件（必要）

`effects/<effect_id>/viewer.js` 為 ES5-compatible IIFE，不使用 ES module、不引入外部 library：

```js
(function () {
  "use strict";

  if (typeof window === "undefined" || !window.Effects) return;

  window.Effects.register("<effect_id>", function (px, py, params) {
    return {
      update(dt) {},
      draw(ctx) {},
      done() {},
    };
  });
})();
```

- `px`／`py` 為畫素座標（由核心自 0–100 百分比座標轉換）。
- `params` 為 server 已正規化的值；插件可再對缺值加 defensive defaults。
- `update(dt)`：以 dt（ms，子步不超過 50ms）推進特效狀態。
- `draw(ctx)`：繪製到 2d canvas（每幀先由核心 clearRect 再呼叫）。
- `done()`：回傳 `true` 表示特效結束。

## 8. console 插件（可選）

`effects/<effect_id>/console.js` 同樣為 ES5-compatible IIFE：

```js
(function () {
  "use strict";

  if (typeof window === "undefined" || !window.RTX_EFFECT_CONSOLE) return;

  window.RTX_EFFECT_CONSOLE.register("<effect_id>", {
    iconID: "particle",
    iconSVG: "<svg viewBox='0 0 24 24' aria-hidden='true'>...</svg>",
    render: function (container, api) {
      // 於 container 建立輸入項；input id 必須為 "rtx-p-<paramKey>"
    },
  });
})();
```

- `iconID`（可選）：`console/icons.js` 中 `RTX_EFFECT_ICONS` 存在的 key（例如 `particle`）。
- `iconSVG`（可選）：raw SVG 字串，例如 `"<svg viewBox='0 0 24 24' aria-hidden='true'>...</svg>"`。
- 解析優先序：plugin `iconSVG` → plugin `iconID` → manifest `icon` → `RTX_EFFECT_ICONS[type]` → `RTX_EFFECT_ICONS.generic` → 內建 fallback icon。
- 有效的 `iconSVG` 或有效的 `iconID` 會優先於 manifest `icon`，且特效按鈕不標記 `generic`。
- manifest 的 `icon` 欄位語意不變：仍只是 icon key。
- `render(container, api)`：自訂產生參數 UI；`api` 提供 `fields`（目前特效的 editable、非 array schema fields，含 `key`／`label`／`type`／`def` 與 schema 的 `min`／`max`／`step`／`maxLength`／`options`）、`defaults`、`getValue(key)`／`setValue(key, value)`。

### 8.1 如何正確傳遞參數給 server

- 自訂 `render(container, api)` 只負責產生 UI；真正把 params 送到 server 的是 console 核心的 `paramsFor()`，它會在用戶點擊畫布時執行，並把 `params` 放進 `POST /api/effect`。
- `paramsFor()` 只依「目前特效的 schema fields」逐個讀取 `document.getElementById("rtx-p-" + key)`。因此自訂 `render` 要讓每個要送 server 的 param 都有正確 id：`rtx-p-<paramKey>`。
- 建議用 `api.fields` 來決定要渲染哪些欄位；`api.fields` 已排除 `editable: false` 與 `array`。不要渲染 `editable: false` 或 `array`，server 會用 `default`。
- 各型別輸入項與送 server 行為：
  - `integer`／`number`：`<input type="number" id="rtx-p-<key>">`，可依 schema 設 `min`／`max`／`step`；console 讀取時轉成 number，無效值用 default，integer 會 round。
  - `string`：`<input type="text" id="rtx-p-<key>">`，可依 schema 設 `maxLength`；送字串。
  - `color`：`<input type="color" id="rtx-p-<key>">`；送 `#rrggbb`。
  - `boolean`：`<input type="checkbox" id="rtx-p-<key>">`；console 讀取 `checked` 並送 boolean。
  - `select`：`<select id="rtx-p-<key>">`，option `value` 必須等於 manifest `options[].value`；送 selected string。
- `api.getValue(key)` 是依 `rtx-p-<key>` 讀目前值；`api.setValue(key, value)` 是依同 id 寫入值。它們不會直接發送 server 請求；真正發送仍發生在點擊畫布時。
- 如果自訂 UI 使用不同 id、不同型別，或 select option value 不等於 manifest value，server 可能收不到該參數或會回退 default。
- 若 `console.js` 不存在、未提供 `render`，或 `render` 執行失敗，console 自動回退到依 schema 渲染。

## 9. 完成後驗證

正式特效插件至少執行：

```
node --test tests/test_effect_catalog.mjs
```

此命令針對正式特效 plugin 做 catalog 級檢查：驗證 `effects/effects.json`、version 1／2 欄位、`currentEffects`／`alternateEffects`、`enabled` 行為、對應 `effects/<effect_id>/viewer.js`、選用 `effects/<effect_id>/console.js`，不需要把新特效加入 `tests/fixtures/effects.json`。

若要同時納入 API／E2E 預設測試，需更新 `tests/fixtures/effects.json` 後再執行完整專案測試：

```
python -m pytest tests/ -q
node --test tests/test_effects.mjs tests/test_console.mjs tests/test_effect_examples.mjs tests/test_effect_catalog.mjs
npx playwright test
```

`tests/test_api.py` 會設定 `RTX_EFFECTS_MANIFEST` 指向 `tests/fixtures/effects.json`（固定原四特效：particle／ripple／firework／text），因此新特效不會自動進入 API／E2E 預設測試。

手動驗收（需 `SERVE_EXAMPLES=1` 啟用示範頁）：啟動 server 後於 `http://localhost:8000/examples/embed-console.html` 選取新特效、調整參數並點擊畫面，確認 `embed-viewer.html` 渲染符合預期。修改 manifest 或插件後，可於 console 展開［連線設定］並點［重載］，或重新整理 `embed-console.html` 與 `embed-viewer.html` 後再測試。
