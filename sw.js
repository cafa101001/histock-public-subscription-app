/* 服務工作者：讓 App 可離線開啟，並讓資料保持最新。
   注意：所有路徑都用相對路徑（./），才能在 GitHub Pages 的
   https://帳號.github.io/repo/ 子路徑下正確運作。 */

const CACHE = "ipo-pwa-v1";

// App 殼層（介面檔案）+ 一份 data.json 種子，預先快取以支援離線
const SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./data.json",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-192.png",
  "./icons/maskable-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // data.json：network-first（資料要新），離線時退回快取。
  // 用固定鍵 "./data.json" 存取，忽略前端加的 ?_=timestamp 查詢字串。
  if (url.pathname.endsWith("data.json")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./data.json", copy));
          return res;
        })
        .catch(() => caches.match("./data.json"))
    );
    return;
  }

  // 其他資源：cache-first，沒有再連網；導覽請求離線時退回 index.html。
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => {
          if (req.mode === "navigate") return caches.match("./index.html");
        });
    })
  );
});
