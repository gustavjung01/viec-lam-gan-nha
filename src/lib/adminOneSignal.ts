type OneSignalLike = {
  init?: (options: Record<string, any>) => Promise<void> | void;
  Notifications?: {
    permission?: boolean;
    requestPermission?: () => Promise<boolean> | boolean;
  };
  User?: {
    PushSubscription?: {
      id?: string | null;
      token?: string | null;
      optIn?: () => Promise<void> | void;
      addEventListener?: (event: string, handler: (event: any) => void) => void;
    };
  };
};

declare global {
  interface Window {
    OneSignalDeferred?: Array<(oneSignal: OneSignalLike) => void | Promise<void>>;
    __vlgnAdminOneSignalStarted?: boolean;
    __vlgnAdminOneSignalLastPlayerId?: string;
  }
}

const ONESIGNAL_SDK_URL = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
const SUBSCRIBE_ENDPOINT = '/api/admin/auth/notifications/subscribe';

function loadOneSignalScript() {
  if (document.querySelector(`script[src="${ONESIGNAL_SDK_URL}"]`)) return;
  const script = document.createElement('script');
  script.src = ONESIGNAL_SDK_URL;
  script.async = true;
  document.head.appendChild(script);
}

function getAdminToken() {
  try {
    return localStorage.getItem('vlgn_admin_session') || '';
  } catch {
    return '';
  }
}

function getCurrentPlayerId(oneSignal: OneSignalLike, changeEvent?: any) {
  return String(
    changeEvent?.current?.id ||
    changeEvent?.current?.token ||
    oneSignal.User?.PushSubscription?.id ||
    oneSignal.User?.PushSubscription?.token ||
    ''
  ).trim();
}

async function subscribeAdminDevice(playerId: string) {
  const token = getAdminToken();
  if (!token || !playerId) return;
  if (window.__vlgnAdminOneSignalLastPlayerId === playerId) return;

  const response = await fetch(SUBSCRIBE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ playerId }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Subscribe admin device failed (${response.status}): ${text.slice(0, 160)}`);
  }

  window.__vlgnAdminOneSignalLastPlayerId = playerId;
}

export function initAdminOneSignal() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!window.location.pathname.startsWith('/admin')) return;
  if (window.__vlgnAdminOneSignalStarted) return;

  const appId = import.meta.env.VITE_ONESIGNAL_APP_ID;
  if (!appId) {
    console.warn('[OneSignal] Missing VITE_ONESIGNAL_APP_ID. Admin push subscription skipped.');
    return;
  }

  window.__vlgnAdminOneSignalStarted = true;
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal) => {
    try {
      await OneSignal.init?.({
        appId,
        allowLocalhostAsSecureOrigin: true,
        serviceWorkerPath: '/OneSignalSDKWorker.js',
        serviceWorkerParam: { scope: '/' },
      });

      try {
        await OneSignal.User?.PushSubscription?.optIn?.();
      } catch {
        // The user/browser can refuse permission. Keep admin UI alive.
      }

      if (OneSignal.Notifications && OneSignal.Notifications.permission === false) {
        try {
          await OneSignal.Notifications.requestPermission?.();
        } catch {
          // Permission prompt may be blocked by the browser. Keep polling for subscription changes.
        }
      }

      const playerId = getCurrentPlayerId(OneSignal);
      if (playerId) await subscribeAdminDevice(playerId);

      OneSignal.User?.PushSubscription?.addEventListener?.('change', async (event: any) => {
        const nextPlayerId = getCurrentPlayerId(OneSignal, event);
        if (!nextPlayerId) return;
        try {
          await subscribeAdminDevice(nextPlayerId);
        } catch (error) {
          console.warn('[OneSignal] Admin device subscribe failed:', error);
        }
      });
    } catch (error) {
      console.warn('[OneSignal] Admin init failed:', error);
      window.__vlgnAdminOneSignalStarted = false;
    }
  });

  loadOneSignalScript();
}
