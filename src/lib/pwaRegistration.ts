const PWA_UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

function isStandalonePwa() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari exposes navigator.standalone only after Add to Home Screen.
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

function notifyServiceWorkerToActivate(worker: ServiceWorker | null) {
  if (!worker) return;
  worker.postMessage({ type: 'SKIP_WAITING' });
}

export function registerPwaServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  let refreshing = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'PWA_UPDATED' && isStandalonePwa()) {
      window.location.reload();
    }
  });

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      });

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;

        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            notifyServiceWorkerToActivate(worker);
          }
        });
      });

      await registration.update();

      window.setInterval(() => {
        registration.update().catch(() => undefined);
      }, PWA_UPDATE_CHECK_INTERVAL_MS);

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          registration.update().catch(() => undefined);
        }
      });
    } catch (error) {
      console.warn('[PWA] Service worker registration failed:', error);
    }
  });
}
