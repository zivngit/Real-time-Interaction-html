# 工作完成報告

- **日期**：2026-09-25
- **任務**：effects 編輯器特效列表拖曳把柄限 grip——可拖曳範圍由整條特效區塊改至僅 ⋮⋮ grip（7c）
- **Agent**：opencode

## 摘要

使用者要求特效列表可拖曳選取範圍由**整條 `.fx-item`** 改為**僅 grip `⋮⋮`**，並指出 hit 區不能太小（點選不到）也不能太大（遮住旁側 checkbox）。

實作（7c，純 editor 前端）：

- `editor/app.js` `buildItem`：`draggable` 由 `item` 移至 `grip`（v1 唯讀仍不可拖）；`dragstart`／`dragend` 監聽移至 `grip`；`dragstart` 內加 `setDragImage(item, 8, 12)`，拖曳映像顯示整條項目（非僅 ⋮⋮）；grip 加 `title="拖曳排序"`。
- `editor/style.css`：`.fx-item` cursor 由 `grab` 改 `pointer`（點選仍可選取特效）；新增 `.fx-item .grip { cursor: grab; padding: 2px 4px; }`——hit 區由約 12×16px 增至約 20×20px（易點選），且與左側 14px checkbox 間有 6px gap＋padding 分隔（不遮 checkbox）。p-card 參數卡 grip 不受影響（scope 限 `.fx-item`）。
- `window.__rtxEditor` version `'7b'`→`'7c'`。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `editor/app.js` | 修改 | `buildItem`：`draggable`／`dragstart`／`dragend` 移至 `grip`；`setDragImage(item, 8, 12)`；grip `title="拖曳排序"`；version `'7b'`→`'7c'` |
| `editor/style.css` | 修改 | `.fx-item` cursor `grab`→`pointer`；新增 `.fx-item .grip` `cursor: grab`＋`padding: 2px 4px` |
| `tests/e2e/editor.spec.js` | 修改 | 「拖曳同區排序與跨區移動」兩處 `dragTo` 改自 `.grip` 起手；「拖曳指示線隨 cursor 位置」synthetic `dragstart`／`dragend` 改 dispatch 到 `items[1].querySelector('.grip')`（47 項不變） |
| `docs/agents/CALL_GRAPH.md` | 修改 | TEX 節點補「拖曳把柄限 grip（draggable／dragstart／dragend 移至 grip、setDragImage 顯示整條項目、7c）」；TP 節點補「拖曳測試改自 .grip 起手（7c）」 |
| `docs/agents/TODO.md` | 修改 | 新增 7c 完成項（hit 區約 20px、不遮 checkbox 之設計說明） |

## 測試與驗證

- 執行命令：
  - `npm run test:unit`
  - `npx playwright test`
- 結果：全綠——node **211** passed（`test_editor` 102）；pytest **159** passed；Playwright E2E **75** passed（`editor.spec.js` 47，含改自 `.grip` 手手的兩項拖曳測試——同區排序、跨區移動、指示線落點皆通過）。

## Git Commit

- Commit：`1f668e1` — `feat(editor): 特效列表拖曳把柄限 grip（7c）`
