self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  const fallback = {
    title: 'SmartPot',
    body: 'Máš nové upozornenie o stave rastlín.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-badge.png',
    tag: 'smartpot-push',
    renotify: true,
    data: { url: '/alerts' }
  };

  let payload = fallback;

  if (event.data) {
    try {
      payload = { ...fallback, ...event.data.json() };
    } catch {
      payload = { ...fallback, body: event.data.text() };
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      tag: payload.tag,
      renotify: Boolean(payload.renotify),
      data: payload.data || { url: '/alerts' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/alerts';

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existingClient = allClients.find(client => 'focus' in client);

    if (existingClient) {
      existingClient.navigate(targetUrl);
      return existingClient.focus();
    }

    return self.clients.openWindow(targetUrl);
  })());
});
