const SDK_URL = ['https://cdn.onesignal.com', 'sdks/web/v16/OneSignalSDK.page.js'].join('/');

function w(): any {
  return window as any;
}

function readEnabledFlag() {
  return String(import.meta.env.VITE_ONESIGNAL_ENABLED || '').trim().toLowerCase() === 'true';
}

function readAllowedOrigins() {
  return String(import.meta.env.VITE_ONESIGNAL_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

function canStartOneSignal() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (!window.location.pathname.startsWith('/admin')) return false;
  if (!readEnabledFlag()) return false;

  const allowedOrigins = readAllowedOrigins();
  if (allowedOrigins.length === 0) return false;

  const currentOrigin = window.location.origin.replace(/\/+$/, '');
  return allowedOrigins.includes(currentOrigin);
}

function loadSdk() {
  if (document.querySelector('script[data-vlgn-onesignal="1"]')) return;
  const script = document.createElement('script');
  script.src = SDK_URL;
  script.async = true;
  script.dataset.vlgnOnesignal = '1';
  document.head.appendChild(script);
}

async function sendSubscription(playerId: string) {
  const token = localStorage.getItem('vlgn_admin_session') || '';
  if (!token || !playerId) return;
  if (w().__vlgnAdminOneSignalLastPlayerId === playerId) return;

  const response = await fetch('/api/admin/auth/notifications/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ playerId }),
  });

  if (response.ok) w().__vlgnAdminOneSignalLastPlayerId = playerId;
}

function readPlayerId(oneSignal: any) {
  return String(oneSignal?.User?.PushSubscription?.id || oneSignal?.User?.PushSubscription?.token || '').trim();
}

export function initAdminOneSignal() {
  if (!canStartOneSignal()) return;
  if (w().__vlgnAdminOneSignalStarted) return;

  const appId = import.meta.env.VITE_ONESIGNAL_APP_ID;
  if (!appId) return;

  w().__vlgnAdminOneSignalStarted = true;
  w().OneSignalDeferred = w().OneSignalDeferred || [];
  w().OneSignalDeferred.push((oneSignal: any) => {
    void (async () => {
      try {
        await oneSignal.init?.({ appId, allowLocalhostAsSecureOrigin: true });
        try { await oneSignal.User?.PushSubscription?.optIn?.(); } catch {}
        try {
          if (oneSignal.Notifications?.permission === false) await oneSignal.Notifications?.requestPermission?.();
        } catch {}

        const trySubscribe = async () => {
          const playerId = readPlayerId(oneSignal);
          if (playerId) await sendSubscription(playerId);
        };

        await trySubscribe();
        const timer = window.setInterval(() => void trySubscribe(), 5000);
        window.setTimeout(() => window.clearInterval(timer), 60000);
      } catch (error) {
        console.warn('[OneSignal] Admin init failed:', error);
        w().__vlgnAdminOneSignalStarted = false;
      }
    })();
  });

  loadSdk();
}
