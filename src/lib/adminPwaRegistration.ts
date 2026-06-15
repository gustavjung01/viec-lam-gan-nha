const ADMIN_BUILD_SIGNATURE_KEY = 'vlgn:admin:last-build-signature';
const BUILD_INFO_URL = '/build-info.json';
const UPDATE_INTERVAL_MS = 60_000;
const RELOAD_AFTER_UPDATE_MS = 1200;

type BuildInfo = {
  commit?: string;
  buildTime?: string;
  indexAsset?: string | null;
  adminAsset?: string | null;
};

function getBuildSignature(info: BuildInfo) {
  return [
    info.commit || 'unknown',
    info.buildTime || 'unknown',
    info.indexAsset || 'unknown',
    info.adminAsset || 'unknown',
  ].join(':');
}

async function fetchBuildInfo(): Promise<BuildInfo | null> {
  try {
    const response = await fetch(`${BUILD_INFO_URL}?admin=1&t=${Date.now()}`, {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!response.ok) return null;
    return (await response.json()) as BuildInfo;
  } catch {
    return null;
  }
}

function readSignature() {
  try {
    return window.localStorage.getItem(ADMIN_BUILD_SIGNATURE_KEY);
  } catch {
    return null;
  }
}

function writeSignature(signature: string) {
  try {
    window.localStorage.setItem(ADMIN_BUILD_SIGNATURE_KEY, signature);
  } catch {
    // Local storage can be blocked in private browsing modes.
  }
}

function emitUpdateAvailable() {
  window.dispatchEvent(new CustomEvent('vlgn:pwa-update-available', { detail: { app: 'admin' } }));
}

async function notifyWaitingWorker(registration: ServiceWorkerRegistration) {
  if (registration.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
}

export function registerAdminPwaServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  let updateTimer: number | undefined;
  let reloadPending = false;

  const safeReload = () => {
    if (reloadPending) return;
    reloadPending = true;
    window.location.reload();
  };

  const requestUpdate = async (registration: ServiceWorkerRegistration) => {
    try {
      await registration.update();
      await notifyWaitingWorker(registration);
    } catch {
      // Ignore transient update failures; the next check will retry.
    }
  };

  const checkForNewBuild = async (registration: ServiceWorkerRegistration) => {
    const info = await fetchBuildInfo();
    if (!info) return;

    const signature = getBuildSignature(info);
    const previous = readSignature();

    if (previous && previous !== signature) {
      writeSignature(signature);
      emitUpdateAvailable();
      await requestUpdate(registration);
      window.setTimeout(safeReload, RELOAD_AFTER_UPDATE_MS);
      return;
    }

    if (previous !== signature) writeSignature(signature);
  };

  const run = async () => {
    const registration = await navigator.serviceWorker.register('/admin-sw.js', {
      scope: '/admin/',
      updateViaCache: 'none',
    });

    registration.addEventListener('updatefound', () => {
      const installingWorker = registration.installing;
      if (!installingWorker) return;

      installingWorker.addEventListener('statechange', () => {
        if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
          emitUpdateAvailable();
          void notifyWaitingWorker(registration);
        }
      });
    });

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'ADMIN_SW_UPDATED') {
        emitUpdateAvailable();
        window.setTimeout(safeReload, RELOAD_AFTER_UPDATE_MS);
      }
    });

    navigator.serviceWorker.addEventListener('controllerchange', safeReload);

    await requestUpdate(registration);
    await checkForNewBuild(registration);

    updateTimer = window.setInterval(() => {
      void checkForNewBuild(registration);
    }, UPDATE_INTERVAL_MS);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void checkForNewBuild(registration);
    });

    window.addEventListener('pageshow', () => {
      void requestUpdate(registration);
      void checkForNewBuild(registration);
    });
  };

  if (document.readyState === 'complete') {
    void run().catch(() => undefined);
  } else {
    window.addEventListener('load', () => void run().catch(() => undefined), { once: true });
  }

  window.addEventListener('beforeunload', () => {
    if (updateTimer) window.clearInterval(updateTimer);
  });
}
