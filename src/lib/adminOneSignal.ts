type OneSignalSdk = {
  init?: (options: { appId: string; allowLocalhostAsSecureOrigin?: boolean }) => Promise<void> | void;
  Notifications?: {
    permission?: boolean;
    requestPermission?: () => Promise<boolean> | boolean;
  };
  User?: {
    PushSubscription?: {
      id?: string | null;
      token?: string | null;
      optedIn?: boolean;
      optIn?: () => Promise<void> | void;
    };
  };
};

declare global {
  interface Window {
    OneSignalDeferred?: Array<(oneSignal: OneSignalSdk) => void>;
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

function getCurrentPlayerId(oneSignal: OneSignalSdk) {
  return String(
    oneSignal.User?.PushSubscription?.id ||
    oneSignal.User?.PushSubscription?.token ||
    ''
  ).trim();
}

async function subscribeAdminDevice(playerId: string) {
  const token = getAdminToken();
  if (!token || !playerId) return false;
  if (window.__vlgnAdminOneSignalLastPlayerId === playerId) return true;

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
  return true;
}

function startSubscribeRetry(oneSignal: OneSignalSdk) {
  const retry = window.setInterval(async () => {
    const playerId = getCurrentPlayerId(oneSignal);
    if (!playerId || !getAdminToken()) return;

    try {
      const ok = await subscribeAdminDevice(playerId);
      if (ok) window.clearInterval(retry);
    } catch (error) {
      console.warn('[OneSignal] Admin retry subscribe failed:', error);
    }
  }, 5000);

  window.setTimeout(() => window.clearInterval(retry), 60000);
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
  window.OneSignalDeferred.push((OneSignal) => {
    void (async () => {
      try {
        await OneSignal.init?.({ appId, allowLocalhostAsSecureOrigin: true });

        try {
          await OneSignal.User?.PushSubscription?.optIn?.();
        } catch {
          // Browser/user may refuse permission.
        }

        if (OneSignal.Notifications && OneSignal.Notifications.permission === false) {
          try {
            await OneSignal.Notifications.requestPermission?.();
          } catch {
            // Prompt may be blocked.
          }
        }

        const playerId = getCurrentPlayerId(OneSignal);
        if (playerId) await subscribeAdminDevice(playerId);
        startSubscribeRetry(OneSignal);
      } catch (error) {
        console.warn('[OneSignal] Admin init failed:', error);
        window.__vlgnAdminOneSignalStarted = false;
      }
    })();
  });

  loadOneSignalScript();
}
