const CACHE = "leo-mall-v1";
const CORE = ["./", "./index.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html").then((r) => r || caches.match("./")))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then((cached) => {
      const net = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || net;
    })
  );
});

/* Push from a server (OneSignal/Firebase/etc.) */
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; }
  catch (_) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil((async () => {
    await self.registration.showNotification(d.title || "Leo Online Mall", {
      body: d.body || "",
      icon: d.icon,
      badge: d.icon,
      data: { pid: d.pid }
    });
    try { if (self.navigator.setAppBadge) await self.navigator.setAppBadge(); } catch (_) {}
  })());
});

/* Tapping a notification opens the app (and the product) */
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const pid = e.notification.data && e.notification.data.pid;
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.focus();
          if (pid) c.postMessage({ pid });
          return;
        }
      }
      return clients.openWindow("./" + (pid ? "#p" + pid : ""));
    })
  );
});
