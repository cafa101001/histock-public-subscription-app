"use strict";

// 欄位定義：key 對應 data.json，label 是表頭，type 決定排序與格式
const COLUMNS = [
  { key: "worth_subscribing", label: "判斷", type: "verdict", text: true },
  { key: "stock_code", label: "代號", type: "string", text: true, cls: "code" },
  { key: "stock_name", label: "名稱", type: "string", text: true, cls: "name" },
  { key: "draw_date", label: "抽籤日期", type: "string", text: true },
  { key: "subscription_period", label: "申購期間", type: "string", text: true },
  { key: "underwriting_price", label: "承銷價", type: "num", digits: 2 },
  { key: "market_price", label: "市價", type: "num", digits: 2 },
  { key: "profit", label: "獲利", type: "num", digits: 0 },
  { key: "win_rate", label: "中籤率%", type: "num", digits: 2 },
  { key: "expected_value", label: "期望值", type: "num", digits: 2 },
  { key: "expected_value_after_fee", label: "扣費後期望值", type: "num", digits: 2, strong: true },
  { key: "fee", label: "手續費", type: "num", digits: 0 },
];

const state = {
  all: [],
  search: "",
  filter: "all",
  sortKey: "expected_value_after_fee",
  sortDir: "desc", // 預設依扣費後期望值由高到低
};

// ---------- 格式化 ----------
function fmtNum(v, digits) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return n.toLocaleString("zh-TW", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

// ---------- 載入資料 ----------
async function loadData() {
  try {
    // 加上時間戳避免瀏覽器/CDN 快取舊的 data.json
    const res = await fetch("./data.json?_=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const payload = await res.json();

    state.all = Array.isArray(payload.data) ? payload.data : [];
    document.getElementById("updatedAt").textContent = payload.updated_at || "—";
    document.getElementById("totalCount").textContent = payload.count ?? state.all.length;
    document.getElementById("worthCount").textContent = state.all.filter(
      (r) => r.worth_subscribing === "值得申購"
    ).length;
    if (payload.fee != null) {
      document.getElementById("feeNote").textContent = payload.fee;
    }
    render();
  } catch (err) {
    const el = document.getElementById("loadError");
    el.hidden = false;
    el.textContent = "讀取 data.json 失敗：" + err.message + "（請確認已產生 data.json）";
    document.getElementById("emptyState").hidden = false;
    document.getElementById("emptyState").textContent =
      "目前沒有資料。請先在本機執行 python update_data.py，或等待 GitHub Actions 完成更新。";
  }
}

// ---------- 表頭 ----------
function buildHead() {
  const tr = document.getElementById("headRow");
  tr.innerHTML = "";
  for (const col of COLUMNS) {
    const th = document.createElement("th");
    th.textContent = col.label;
    if (col.text) th.classList.add("col-text");
    if (state.sortKey === col.key) {
      const arrow = document.createElement("span");
      arrow.className = "arrow";
      arrow.textContent = state.sortDir === "asc" ? "▲" : "▼";
      th.appendChild(arrow);
    }
    th.addEventListener("click", () => {
      if (state.sortKey === col.key) {
        state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      } else {
        state.sortKey = col.key;
        state.sortDir = col.type === "num" ? "desc" : "asc";
      }
      render();
    });
    tr.appendChild(th);
  }
}

// ---------- 篩選 + 排序 ----------
function getRows() {
  const q = state.search.trim().toLowerCase();
  let rows = state.all.filter((r) => {
    if (state.filter !== "all" && r.worth_subscribing !== state.filter) return false;
    if (!q) return true;
    return (
      String(r.stock_code || "").toLowerCase().includes(q) ||
      String(r.stock_name || "").toLowerCase().includes(q)
    );
  });

  const col = COLUMNS.find((c) => c.key === state.sortKey) || {};
  const dir = state.sortDir === "asc" ? 1 : -1;
  rows.sort((a, b) => {
    let va = a[state.sortKey];
    let vb = b[state.sortKey];
    const aNull = va === null || va === undefined || va === "";
    const bNull = vb === null || vb === undefined || vb === "";
    if (aNull && bNull) return 0;
    if (aNull) return 1; // 缺值一律排最後
    if (bNull) return -1;
    if (col.type === "num") return (Number(va) - Number(vb)) * dir;
    return String(va).localeCompare(String(vb), "zh-Hant") * dir;
  });
  return rows;
}

// ---------- 渲染 ----------
function render() {
  buildHead();
  const rows = getRows();
  const body = document.getElementById("tableBody");
  body.innerHTML = "";

  for (const r of rows) {
    const tr = document.createElement("tr");
    if (r.worth_subscribing === "值得申購") tr.classList.add("is-worth");

    for (const col of COLUMNS) {
      const td = document.createElement("td");
      td.setAttribute("data-label", col.label);
      if (col.text) td.classList.add("col-text");

      if (col.type === "verdict") {
        const span = document.createElement("span");
        span.className = "verdict verdict--" + r.worth_subscribing;
        span.textContent = r.worth_subscribing;
        td.appendChild(span);
      } else if (col.type === "num") {
        const txt = fmtNum(r[col.key], col.digits);
        if (txt === null) {
          td.innerHTML = '<span class="na">N/A</span>';
        } else {
          td.textContent = txt;
          if (col.strong) td.classList.add("ev-strong");
        }
      } else {
        td.textContent = r[col.key] || "";
        if (col.cls) td.classList.add(col.cls);
      }
      tr.appendChild(td);
    }
    body.appendChild(tr);
  }

  document.getElementById("shownCount").textContent = rows.length;
  const empty = document.getElementById("emptyState");
  empty.hidden = rows.length !== 0;
}

// ---------- 事件 ----------
function bindEvents() {
  const search = document.getElementById("searchInput");
  let t;
  search.addEventListener("input", (e) => {
    clearTimeout(t);
    t = setTimeout(() => {
      state.search = e.target.value;
      render();
    }, 120);
  });

  document.getElementById("filters").addEventListener("click", (e) => {
    const btn = e.target.closest(".chip-btn");
    if (!btn) return;
    state.filter = btn.dataset.filter;
    document
      .querySelectorAll(".chip-btn")
      .forEach((b) => b.classList.toggle("is-active", b === btn));
    render();
  });
}

bindEvents();
loadData();

// ---------- PWA：離線快取 + 安裝提示 ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

let deferredPrompt = null;
const installBtn = document.getElementById("installBtn");

window.addEventListener("beforeinstallprompt", (e) => {
  // Android / 桌面 Chrome：攔截預設提示，改用自家按鈕
  e.preventDefault();
  deferredPrompt = e;
  if (installBtn) installBtn.hidden = false;
});

if (installBtn) {
  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.hidden = true;
  });
}

window.addEventListener("appinstalled", () => {
  if (installBtn) installBtn.hidden = true;
});
