const LAST_BUILD_SIGNATURE_KEY = 'vlgn:last-build-signature';
const BUILD_INFO_URL = '/build-info.json';
const UPDATE_INTERVAL_MS = 60_000;

type BuildInfo = {
  commit?: string;
  buildTime?: string;
  indexAsset?: string | null;
};

function getBuildSignature(info: BuildInfo) {
  return [info.commit || 'unknown', info.buildTime || 'unknown'].join(':');
}

function readStoredSignature() {
  try {
    return window.localStorage.getItem(LAST_BUILD_SIGNATURE_KEY);
  } catch {
    return null;
  }
}

function writeStoredSignature(signature: string) {
  try {
    window.localStorage.setItem(LAST_BUILD_SIGNATURE_KEY, signature);
  } catch {
    // Local storage can be blocked in private browsing modes.
  }
}

async function fetchBuildInfo(): Promise<BuildInfo | null> {
  try {
    const response = await fetch(`${BUILD_INFO_URL}?t=${Date.now()}`, {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as BuildInfo;
  } catch {
    return null;
  }
}

async function notifyWaitingWorker(registration: ServiceWorkerRegistration) {
  if (registration.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
}

export function registerPwaServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  let updateTimer: number | undefined;
  let reloadPending = false;

  const requestUpdate = async () => {
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      if (!registration) {
        return;
      }
      await registration.update();
      await notifyWaitingWorker(registration);
    } catch {
      // Ignore transient update failures; the next interval will retry.
    }
  };

  const checkBuildInfo = async () => {
    const info = await fetchBuildInfo();
    if (!info) {
      return;
    }

    const signature = getBuildSignature(info);
    const previousSignature = readStoredSignature();

    if (previousSignature && previousSignature !== signature) {
      await requestUpdate();
    }

    if (previousSignature !== signature) {
      writeStoredSignature(signature);
    }
  };

  const scheduleChecks = async () => {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });

    registration.addEventListener('updatefound', () => {
      const installingWorker = registration.installing;
      if (!installingWorker) {
        return;
      }

      installingWorker.addEventListener('statechange', () => {
        if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
          void notifyWaitingWorker(registration);
        }
      });
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloadPending) {
        return;
      }
      reloadPending = true;
      window.location.reload();
    });

    await checkBuildInfo();

    updateTimer = window.setInterval(() => {
      void checkBuildInfo();
    }, UPDATE_INTERVAL_MS);
  };

  if (document.readyState === 'complete') {
    void scheduleChecks().catch(() => undefined);
  } else {
    window.addEventListener(
      'load',
      () => {
        void scheduleChecks().catch(() => undefined);
      },
      { once: true }
    );
  }

  window.addEventListener('beforeunload', () => {
    if (updateTimer) {
      window.clearInterval(updateTimer);
    }
  });
}
