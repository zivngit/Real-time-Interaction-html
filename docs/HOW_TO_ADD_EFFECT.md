# 如何加入新特效

本專案的特效由專案根目錄的 `effects/effects.json`（manifest）集中驅動。正式新增一個特效時，只需修改該檔案並建立對應插件檔案，`server/`、`viewer/`、`console/` 的程式碼不需要修改。

## 1. 需要修改的檔案

| 檔案 | 必要 | 說明 |
| --- | --- | --- |
| `effects/effects.json` | 是 | 在 `effects` 下新增一個 entry，key 為 effect ID |
| `effects/<effect_id>/viewer.js` | 是 | viewer 渲染插件，呼叫 `window.Effects.register("<effect_id>", factory)` |
| `effects/<effect_id>/console.js` | 否 | console 自訂參數 UI 插件，呼叫 `window.RTX_EFFECT_CONSOLE.register("<effect_id>", { iconID, iconSVG, render })` |

缺少 `console.js` 時，console 核心會依 `params` schema 自動渲染通用控制項。

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
- `viewer` 檔（預設 `viewer.js`）必須存在，否則 server 啟動失敗（fail-fast）。
- `console` 檔（預設 `console.js`）可不存在；不存在時該特效視為無 console 插件（`/api/effects` 回傳 `consoleUrl: null`）。

## 4. manifest 欄位

```json
{
  "version": 1,
  "effects": {
    "<effect_id>": {
      "label": "顯示名稱",
      "category": "分組",
      "icon": "icon key",
      "viewer": "viewer.js",
      "console": "console.js",
      "params": {}
    }
  }
}
```

| 欄位 | 必要 | 說明 |
| --- | --- | --- |
| `version` | 是 | 固定 `1` |
| `effects` | 是 | object，key 為 effect ID，不可為空 |
| `label` | 否 | 預設使用 effect ID |
| `category` | 否 | console 分組用 |
| `icon` | 否 | `console/icons.js` 中 `RTX_EFFECT_ICONS` 的 key（現行：`particle`／`ripple`／`firework`／`text`／`generic`） |
| `viewer` | 否 | 預設 `viewer.js`；檔案必須存在 |
| `console` | 否 | 預設 `console.js`；檔案不存在則視為無 console 插件 |
| `params` | 否 | 參數 schema；預設 `{}` |

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

server 啟動時驗證 manifest（`version`、effect ID、`viewer` 檔存在）。`POST /api/effect` 收到的 `params` 會依 schema 正規化後才廣播：

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

server 靜態路由 `GET /effects/{effect_id}/viewer.js` 與 `GET /effects/{effect_id}/console.js` 會服務插件檔（`Cache-Control: no-store`，禁止 path traversal）。

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

```
python -m pytest tests/ -q
node --test tests/test_effects.mjs tests/test_console.mjs tests/test_effect_examples.mjs
```

測試 manifest：`tests/test_api.py` 會設定 `RTX_EFFECTS_MANIFEST` 指向 `tests/fixtures/effects.json`（固定原四特效：particle／ripple／firework／text），因此正式 `effects/effects.json` 中加入的新特效不會自動進入自動測試。若要把新特效納入測試，需另行加入 `tests/fixtures/effects.json` 與對應 node 測試。

手動驗收（需 `SERVE_EXAMPLES=1` 啟用示範頁）：啟動 server 後於 `http://localhost:8000/examples/embed-console.html` 選取新特效、調整參數並點擊畫面，確認 `embed-viewer.html` 渲染符合預期。
