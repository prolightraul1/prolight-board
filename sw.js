// ProLight Season Board service worker: shows push notifications and opens the right screen when tapped.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: "ProLight", body: e.data ? e.data.text() : "" }; }
  e.waitUntil((async () => {
    await self.registration.showNotification(d.title || "ProLight", { body: d.body || "", icon: "/icon-192.png", badge: "/icon-192.png", tag: d.tag || undefined, renotify: !!d.tag, requireInteraction: !!d.sticky, vibrate: d.sticky ? [400, 200, 400, 200, 400] : [200], data: { url: d.url || "/" } });
    try { if (self.navigator && self.navigator.setAppBadge) { const n = await self.registration.getNotifications(); await self.navigator.setAppBadge(n.length); } } catch (x) {}
  })());
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil((async () => {
    try { if (self.navigator && self.navigator.clearAppBadge) await self.navigator.clearAppBadge(); } catch (x) {}
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) { if (new URL(c.url).origin === self.location.origin) { c.postMessage({ go: url }); return c.focus(); } }
    return self.clients.openWindow(url);
  })());
});
