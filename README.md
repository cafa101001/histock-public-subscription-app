# 股票公開申購分析（GitHub Pages 靜態網頁版）

純靜態前端（HTML/CSS/JS）部署到 **GitHub Pages**，手機用網址就能開；
資料由 **GitHub Actions** 每天台灣時間 01:00 自動執行 Python 爬蟲、重新產生 `data.json`
並 commit 回 repo。沒有 Streamlit、沒有 SQLite、沒有後端伺服器。

> ⚠️ 本工具僅根據公開申購資料與中籤率估算期望值，**不構成投資建議**。
> 實際申購仍需考量市場價格波動、資金凍結、交易成本與個人風險承受能力。

---

## 專案結構

```
.
├── index.html                      # 前端頁面
├── style.css                       # 樣式（含手機自適應：寬螢幕表格 / 手機卡片）
├── script.js                       # 讀 data.json，負責搜尋、篩選、排序、渲染、PWA
├── data.json                       # 資料檔（前端唯一資料來源；由 Python 產生）
├── manifest.webmanifest            # PWA：App 名稱 / 圖示 / 顏色
├── sw.js                           # PWA：Service Worker（離線快取、資料 network-first）
├── icons/                          # PWA 圖示（192/512、maskable、apple-touch、favicon）
├── update_data.py                  # 抓取+解析+計算→輸出 data.json（本機/Actions 共用）
├── scraper.py                      # 爬蟲引擎（以表頭對應欄位，不靠固定順序）
├── config.py                       # 設定：來源網址、手續費、輸出檔名
├── requirements.txt                # Python 套件（requests / beautifulsoup4 / lxml）
├── README.md
└── .github/workflows/update-data.yml   # 每天 01:00 自動更新的 GitHub Actions
```

前端只做一件事：抓 `./data.json` 並顯示。**瀏覽器不會去連 HiStock**，
跨來源（CORS）問題不存在；連 HiStock 的工作只發生在 Actions 的 Python 端。

---

## 資料與計算

`data.json` 每筆包含：股票代號、股票名稱、抽籤日期、申購期間、發行市場、撥券日期、
承銷價、市價、獲利、中籤率、期望值、扣手續費後期望值、手續費、是否值得申購、申購狀態；
最外層另有更新時間 `updated_at`、資料來源、手續費、筆數。

- **期望值** ＝ 獲利 × 中籤率 ÷ 100（中籤率是百分比，例 0.26＝0.26%）
- **扣手續費後期望值** ＝ 期望值 − 手續費（預設 20 元）
- **是否值得申購**：扣手續費後期望值 `>0`→「值得申購」；`<=0`→「不建議申購」；
  中籤率為 0 或缺漏（通常代表尚未抽籤）→「資料不足」

前端預設依「扣手續費後期望值」由高到低排序（缺值排最後），可點欄位標題改排序。

---

## 1) 如何本機測試

需要 Python 3.10+。

```bash
# 安裝套件
pip install -r requirements.txt

# 產生 / 更新 data.json
python update_data.py
```

成功會看到「已寫入 data.json：共 N 檔…」。若失敗會印出**清楚原因與 traceback**
（例如 HTTP 403 被擋、連不到、解析不到表格），並把抓回來的 HTML 暫存成
`debug_histock.html` 方便檢查；此時**不會覆寫**既有的 `data.json`。

接著用任一靜態伺服器預覽前端（不能直接用 `file://` 開，`fetch` 會被瀏覽器擋）：

```bash
python -m http.server 8000
# 瀏覽器開 http://localhost:8000
```

---

## 2) 如何上傳 GitHub

```bash
git init
git add .
git commit -m "init: 公開申購分析靜態網頁版"
git branch -M main
git remote add origin https://github.com/<你的帳號>/<repo 名稱>.git
git push -u origin main
```

> `data.json` 已附一份種子資料，第一次部署就能顯示畫面，之後會被 Actions 自動更新覆蓋。

---

## 3) 如何開啟 GitHub Pages

1. 進入 repo 的 **Settings → Pages**。
2. **Build and deployment → Source** 選 **Deploy from a branch**。
3. Branch 選 **main**、資料夾選 **/(root)**，按 **Save**。
4. 等一兩分鐘，頁面網址會是：
   `https://<你的帳號>.github.io/<repo 名稱>/`
   手機直接用這個網址開啟即可（可加到主畫面像 App 一樣用）。

> 每次 `data.json` 有新 commit，Pages 會自動重新部署，網站資料就更新。

---

## 4) GitHub Actions 自動更新 & 如何確認成功

工作流程檔：`.github/workflows/update-data.yml`

- 觸發時間：`cron: "0 17 * * *"`（UTC 17:00 ＝ **台灣時間隔天 01:00**）。
- 也可手動觸發：**Actions 分頁 → Update IPO data → Run workflow**。
- 流程：checkout → 安裝套件 → `python update_data.py` → 若 `data.json` 有變動就
  自動 commit + push。

**確認是否成功：**
1. 到 repo 的 **Actions** 分頁，看 **Update IPO data** 最新一次執行是否為綠勾。
2. 點進去看 **Generate data.json** 步驟的 log，會印出抓到幾筆、寫入幾筆。
3. 回到 repo 首頁看 `data.json` 的最後 commit 時間，或直接開
   `https://<帳號>.github.io/<repo>/data.json` 看 `updated_at`。

**若 push 失敗（403）**：到 **Settings → Actions → General → Workflow permissions**，
改成 **Read and write permissions** 後重跑。

**若 Generate 步驟失敗（HiStock 擋機房 IP / 改動結構）**：log 會顯示確切原因。
排程時間 GitHub 可能因負載延後幾分鐘到數十分鐘，屬正常；資料源若改版，
依 log 提示調整 `scraper.py` 的 `_map_header()` 欄位對應即可。

---

## 加到主畫面（PWA，像原生 App）

本專案已內建 PWA：`manifest.webmanifest`（App 名稱、圖示、顏色）、`sw.js`
（Service Worker，提供離線開啟與資料快取）、`icons/`（各尺寸圖示）。
部署到 GitHub Pages（HTTPS）後就會生效：

- **Android / 桌面 Chrome**：開啟網站後網址列會出現安裝圖示，
  或點頁面右上角的「＋ 安裝到主畫面」按鈕。
- **iPhone / iPad（Safari）**：點分享鈕 → 「加入主畫面」。
- 安裝後從主畫面開啟是**全螢幕、無網址列**，圖示與啟動色都已設定好。
- **離線可開**：Service Worker 會快取介面與最後一次的 `data.json`；
  有網路時 `data.json` 採 network-first 抓最新，沒網路就用上次資料。

> 換圖示：替換 `icons/` 內的 PNG（保留檔名與尺寸）即可。
> 改了 html/css/js 後手機若沒更新，是 Service Worker 快取住了——
> 把 `sw.js` 的 `CACHE = "ipo-pwa-v1"` 版本號加一再 push，即可強制更新。
> PWA 需 HTTPS；GitHub Pages 本身即 HTTPS，本機用 `localhost` 測試也算安全來源。

---

## 修改設定（都在 `config.py`）

| 想改的東西 | 變數 | 預設 |
|---|---|---|
| 資料來源網址 | `SOURCE_URL` | HiStock 申購頁 |
| 申購手續費 | `SUBSCRIPTION_FEE` | `20`（想含工本費可改 `70`） |
| 輸出檔名 | `OUTPUT_JSON_PATH` | `data.json` |

改更新時間：編輯 workflow 的 `cron`（記得換算成 UTC；台灣時間減 8 小時）。

## 注意事項
- 前端不連 HiStock，只有 Actions 的 Python 端每天抓一次，符合「不要高頻請求」。
- 資料著作權屬 HiStock 所有，請遵守其服務條款，勿用於商業重製或散布。
