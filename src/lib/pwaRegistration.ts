const PWA_UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;
const BUILD_INFO_URL = '/build-info.json';

type BuildInfo = {
  commit?: string;
  buildTime?: string;
  indexAsset?: string | null;
};

let initialBuildSignature: string | null = null;
let reloadingForNewBuild = false;

function isStandalonePwa() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari exposes navigator.standalone only after Add to Home Screen.
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

function notifyServiceWorkerToActivate(worker: ServiceWorker | null) {
  if (!worker) return;
  worker.postMessage({ type: 'SKIP_WAITING' });
}

function getBuildSignature(info: BuildInfo) {
  return [info.commit || 'unknown', info.buildTime || 'unknown', info.indexAsset || 'unknown'].join('|');
}

async function fetchBuildInfo(): Promise<BuildInfo | null> {
  try {
    const response = await fetch(`${BUILD_INFO_URL}?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function checkForNewBuild() {
  const info = await fetchBuildInfo();
  if (!info) return;

  const signature = getBuildSignature(info);
  if (!initialBuildSignature) {
    initialBuildSignature = signature;
    return;
  }

  if (signature !== initialBuildSignature && !reloadingForNewBuild) {
    reloadingForNewBuild = true;

    const registration = await navigator.serviceWorker.getRegistration('/');
    if (registration?.waiting) {
      notifyServiceWorkerToActivate(registration.waiting);
      return;
    }

    window.location.reload();
  }
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
      await checkForNewBuild();

      window.setInterval(() => {
        registration.update().catch(() => undefined);
        checkForNewBuild().catch(() => undefined);
      }, PWA_UPDATE_CHECK_INTERVAL_MS);

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          registration.update().catch(() => undefined);
          checkForNewBuild().catch(() => undefined);
        }
      });
    } catch (error) {
      console.warn('[PWA] Service worker registration failed:', error);
    }
  });
}
