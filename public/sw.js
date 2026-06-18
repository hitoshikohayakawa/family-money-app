// ミラマネ Service Worker

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};

  const title = data.title || "ミラマネ";
  const options = {
    body: data.body || "新しいお知らせがあります",
    icon: "/icon.png",
    badge: "/icon.png",
    data: {
      url: data.url || "/",
    },
  };

  const tasks = [self.registration.showNotification(title, options)];

  // payload に badgeCount があり Badging API 対応なら、PWAアイコンのバッジも更新
  if (
    typeof data.badgeCount === "number" &&
    self.navigator &&
    typeof self.navigator.setAppBadge === "function"
  ) {
    tasks.push(
      data.badgeCount > 0
        ? self.navigator.setAppBadge(data.badgeCount).catch(() => {})
        : (self.navigator.clearAppBadge?.() ?? Promise.resolve()).catch(() => {})
    );
  }

  event.waitUntil(Promise.all(tasks));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            client.navigate(url);
            return;
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});
