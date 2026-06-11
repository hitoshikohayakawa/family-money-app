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

  event.waitUntil(self.registration.showNotification(title, options));
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
