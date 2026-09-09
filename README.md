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
pip install -r c/requirements.txt
python -m uvicorn c.main:app --port 8000    # c 中繼（專案根目錄執行）
```

- a 控制端：瀏覽器開啟 `a/index.html`
- b 顯示端：瀏覽器開啟 `b/index.html`（獨立預覽）
- 嵌入其他網頁：`<script src="http://<c-host>:8000/app.js"></script>`
- 存取金鑰（可選）：設定環境變數 `ACCESS_KEY`；a 於面板填入、嵌入用 `data-key="..."`

測試：

```
python -m pytest tests/ -v
node --test tests/test_effects.mjs
```

## 文件維護原則

- 每次改動都需對應一個具描述性的 Git commit。
- 每次改動都需編寫或更新測試，交付前確保全部通過。
- 文件異動（新增／修改／移動／刪除）須於 `reports/` 產出報告，格式遵循 `REPORT_TEMPLATE.md`。
- 暫存草稿放於 `docs/temp/`（已被 `.gitignore` 忽略，不納入版本控制）。
