const VERSION = 'kotobi-v9-push-payload-2026-06-20';
const ASSET_CACHE = `${VERSION}-assets`;
const IMAGE_CACHE = `${VERSION}-images`;
const MAX_IMAGE_CACHE = 200;

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

// Push Notifications Handler
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received');
  
  let data = {
    title: 'إشعار من كتبي',
    body: 'لديك إشعار جديد',
    icon: '/kotobi-icon-2026.png',
    badge: '/kotobi-icon-2026.png',
    tag: 'kotobi-notification',
    data: { url: '/' }
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      // FCM HTTP v1 wraps webpush payloads as:
      //   { notification: { title, body, icon, ... }, data: {...}, fcmOptions: { link } }
      // Older/raw web-push senders may put fields at the top level instead.
      const n = payload.notification || {};
      const d = payload.data || {};
      const link = payload.fcmOptions?.link || payload.fcm_options?.link;
      data = {
        title: n.title || payload.title || d.title || data.title,
        body: n.body || payload.body || d.body || data.body,
        icon: n.icon || payload.icon || data.icon,
        badge: n.badge || payload.badge || data.badge,
        tag: n.tag || payload.tag || `kotobi-${Date.now()}`,
        data: { ...d, url: d.url || link || d.target_url || data.data.url }
      };
    }
  } catch (e) {
    console.error('[SW] Error parsing push data:', e);
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    data: data.data,
    vibrate: [100, 50, 100],
    requireInteraction: true,
    dir: 'rtl',
    lang: 'ar'
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          if (urlToOpen !== '/') {
            client.navigate(urlToOpen);
          }
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      const cache = await caches.open(ASSET_CACHE);
      await Promise.all([
        cache.delete('/favicon.ico'),
        cache.delete('/favicon.png'),
        cache.delete('/favicon.ico?v=kotobi'),
        cache.delete('/favicon.png?v=kotobi'),
        cache.delete('/kotobi-icon-2026.ico'),
        cache.delete('/kotobi-icon-2026.ico?v=20260616'),
        cache.delete('/kotobi-icon-2026.png'),
        cache.delete('/android-chrome-192x192.png'),
        cache.delete('/android-chrome-512x512.png'),
        cache.delete('/apple-touch-icon.png'),
        cache.delete('/favicon-16x16.png'),
        cache.delete('/favicon-32x32.png'),
        cache.delete('/shortcut-icon.png'),
      ]);
      await self.clients.claim();
    })()
  );
});

// Helper: trim image cache to MAX_IMAGE_CACHE entries (LRU eviction)
async function trimImageCache() {
  const cache = await caches.open(IMAGE_CACHE);
  const keys = await cache.keys();
  if (keys.length > MAX_IMAGE_CACHE) {
    const toDelete = keys.slice(0, keys.length - MAX_IMAGE_CACHE);
    await Promise.all(toDelete.map((k) => cache.delete(k)));
  }
}

// Helper: safely put a response in cache (skip partial/opaque/redirects)
function isCacheable(res) {
  return !!(res && res.ok && res.status === 200 && res.type !== 'opaqueredirect');
}
function safePut(cache, req, res) {
  try {
    if (isCacheable(res)) return cache.put(req, res);
  } catch (_) {}
  return Promise.resolve();
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // Skip range requests entirely — they produce 206 which can't be cached
  if (req.headers.get('range')) return;

  const accept = req.headers.get('accept') || '';
  const isHtml = req.mode === 'navigate' || accept.includes('text/html');
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Always fetch favicons from network so browser tabs don't keep old Lovable icons.
  if (sameOrigin && [
    '/favicon.ico',
    '/favicon.png',
    '/kotobi-icon-2026.ico',
    '/kotobi-icon-2026.png',
    '/android-chrome-192x192.png',
    '/android-chrome-512x512.png',
    '/apple-touch-icon.png',
    '/favicon-16x16.png',
    '/favicon-32x32.png',
    '/shortcut-icon.png',
    '/mstile-150x150.png',
  ].includes(url.pathname)) {
    event.respondWith(fetch(req, { cache: 'reload' }));
    return;
  }

  // ✅ HTML pages: Network-first
  if (isHtml) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(ASSET_CACHE);
          safePut(cache, req, fresh.clone());
          return fresh;
        } catch (err) {
          const cached = await caches.match(req);
          return cached || new Response('Offline', { status: 503 });
        }
      })()
    );
    return;
  }

  // ✅ CDN Image proxy (/i/*): Cache-first with LRU eviction
  if (sameOrigin && url.pathname.startsWith('/i/')) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;

        try {
          const fresh = await fetch(req);
          if (fresh && fresh.ok) {
            const cache = await caches.open(IMAGE_CACHE);
            safePut(cache, req, fresh.clone());
            event.waitUntil(trimImageCache());
          }
          return fresh;
        } catch (err) {
          return new Response('', { status: 503 });
        }
      })()
    );
    return;
  }

  // ✅ PDF proxy (/f/*): Network-only (too large to cache)
  if (sameOrigin && url.pathname.startsWith('/f/')) {
    event.respondWith(fetch(req));
    return;
  }

  // ✅ Static assets (JS/CSS/fonts): Cache-first + background refresh
  if (sameOrigin) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) {
          event.waitUntil(
            (async () => {
              try {
                const fresh = await fetch(req);
                if (fresh && fresh.ok) {
                  const cache = await caches.open(ASSET_CACHE);
                  safePut(cache, req, fresh.clone());
                }
              } catch (_) {}
            })()
          );
          return cached;
        }

        const fresh = await fetch(req);
        if (fresh && fresh.ok) {
          const cache = await caches.open(ASSET_CACHE);
          safePut(cache, req, fresh.clone());
        }
        return fresh;
      })()
    );
    return;
  }

  // ✅ External requests: no cache
  event.respondWith(fetch(req));
});
