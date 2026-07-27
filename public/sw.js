// onucore service worker: shows push notifications and opens the app on tap.
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data.json(); } catch { d = { title: "onucore", body: e.data && e.data.text() }; }
  e.waitUntil(
    self.registration.showNotification(d.title || "onucore", {
      body: d.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: d.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
      for (const c of cs) if ("focus" in c) return c.focus();
      return clients.openWindow((e.notification.data && e.notification.data.url) || "/");
    })
  );
});
