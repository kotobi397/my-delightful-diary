// Kill-switch for the old app-shell service worker.
// Firebase push notifications use /firebase-messaging-sw.js and are intentionally untouched.
function isKotobiAppCache(name) {
  return name.startsWith('kotobi-') || name.includes('auto-discover-ui');
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        await Promise.allSettled(cacheNames.filter(isKotobiAppCache).map((name) => caches.delete(name)));
        await self.clients.claim();
        const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
        await Promise.allSettled(clientList.map((client) => client.navigate(client.url)));
      } finally {
        await self.registration.unregister();
      }
    })()
  );
});
