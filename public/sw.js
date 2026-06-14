/*
 * VIECLAMGANNHA.COM PWA Service Worker
 * Mục tiêu: cài được tạm như app trên Android/iPhone và tự nhận bản mới sau deploy.
 */

const CACHE_PREFIX = 'vlgn-pwa';
const STATIC_FALLBACK_CACHE = `${CACHE_PREFIX}-fallback`;
const APP_SHELL = ['/', '/manifest.webmanifest', '/images/brand/logo-shield.svg'];
const NEVER_CACHE_PATHS = ['/api/', '/build-info.json'];

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

async function getBuildVersion() {
  try {
    const response = await fetch('/build-info.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('build-info unavailable');
    const info = await response.json();
    return info.commit || info.buildTime || 'unknown';
  } catch (error) {
    return 'dev';
  }
}

async function getRuntimeCacheName() {
  const version = await getBuildVersion();
  return `${CACHE_PREFIX}-${version}`;
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cacheName = await getRuntimeCacheName();
    const cache = await caches.open(cacheName);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const activeCache = await getRuntimeCacheName();
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== activeCache && key !== STATIC_FALLBACK_CACHE)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach((client) => client.postMessage({ type: 'PWA_UPDATED' }));
  })());
});

function shouldBypassCache(request) {
  const url = new URL(request.url);
  if (request.method !== 'GET') return true;
  if (url.origin !== self.location.origin) return true;
  return NEVER_CACHE_PATHS.some((path) => url.pathname.startsWith(path));
}

async function networkFirst(request) {
  const cacheName = await getRuntimeCacheName();
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (error) {
    const cached = await cache.match(request);
    return cached || cache.match('/');
  }
}

async function cacheFirst(request) {
  const cacheName = await getRuntimeCacheName();
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const fresh = await fetch(request);
  if (fresh && fresh.ok) {
    cache.put(request, fresh.clone());
  }
  return fresh;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (shouldBypassCache(request)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});
