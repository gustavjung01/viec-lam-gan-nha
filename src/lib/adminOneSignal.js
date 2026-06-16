const SUBSCRIBE_ENDPOINT = '/api/admin/auth/notifications/subscribe';
const SDK_URL = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';

function getWin() {
  return window;
}

function loadOneSignalScript() {
  if (document.querySelector('script[data-vlgn-onesignal="1"]')) return;
  const script = document.createElement('script');
  script.src = SDK_URL;
  script.async = true;
  script.dataset.vlgnOnesignal = '1';
  document.head.appendChild(script);
}

function getAdminToken() {
  try {
    return localStorage.getItem('vlgn_admin_session') || '';
  } catch {
    return '';
  }
}

function getCurrentPlayerId(oneSignal) {
  return String(
    oneSignal?.User?.PushSubscription?.id ||
    oneSignal?.User?.PushSubscription?.token ||
    ''
  ).trim();
}

async function subscribeAdminDevice(playerId) {
  const token = getAdminToken();
  if (!token || !playerId) return false;
  if (getWin().__vlgnAdminOneSignalLastPlayerId === playerId) return true;

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

  getWin().__vlgnAdminOneSignalLastPlayerId = playerId;
  return true;
}

function startSubscribeRetry(oneSignal) {
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
  if (getWin().__vlgnAdminOneSignalStarted) return;

  const appId = import.meta.env.VITE_ONESIGNAL_APP_ID;
  if (!appId) {
    console.warn('[OneSignal] Missing VITE_ONESIGNAL_APP_ID. Admin push subscription skipped.');
    return;
  }

  getWin().__vlgnAdminOneSignalStarted = true;
  getWin().OneSignalDeferred = getWin().OneSignalDeferred || [];
  getWin().OneSignalDeferred.push((OneSignal) => {
    void (async () => {
      try {
        await OneSignal.init?.({ appId, allowLocalhostAsSecureOrigin: true });
        try {
          await OneSignal.User?.PushSubscription?.optIn?.();
        } catch {}

        if (OneSignal.Notifications && OneSignal.Notifications.permission === false) {
          try {
            await OneSignal.Notifications.requestPermission?.();
          } catch {}
        }

        const playerId = getCurrentPlayerId(OneSignal);
        if (playerId) await subscribeAdminDevice(playerId);
        startSubscribeRetry(OneSignal);
      } catch (error) {
        console.warn('[OneSignal] Admin init failed:', error);
        getWin().__vlgnAdminOneSignalStarted = false;
      }
    })();
  });

  loadOneSignalScript();
}
