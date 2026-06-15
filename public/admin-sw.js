const ADMIN_CACHE_PREFIX = 'vlgn-admin';
const ADMIN_CACHE_VERSION = 'vlgn-admin-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(ADMIN_CACHE_PREFIX) && key !== ADMIN_CACHE_VERSION)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      client.postMessage({ type: 'ADMIN_SW_UPDATED' });
    }
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (
    url.pathname === '/build-info.json' ||
    url.pathname === '/admin-manifest.webmanifest' ||
    url.pathname === '/admin-sw.js' ||
    url.pathname === '/admin.html'
  ) {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }

  if (request.mode === 'navigate' && url.pathname.startsWith('/admin')) {
    event.respondWith(
      fetch('/admin.html', { cache: 'no-store' }).catch(() => fetch(request, { cache: 'no-store' }))
    );
  }
});
