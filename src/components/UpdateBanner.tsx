import { useEffect, useState } from 'react';

const DISMISS_KEY = 'vlgn:pwa-update-dismissed-at';

async function findBestRegistration() {
  if (!('serviceWorker' in navigator)) return null;
  const registrations = await navigator.serviceWorker.getRegistrations();
  const currentPath = window.location.pathname;
  return (
    registrations
      .filter((registration) => currentPath.startsWith(new URL(registration.scope).pathname))
      .sort((a, b) => b.scope.length - a.scope.length)[0] ||
    (await navigator.serviceWorker.getRegistration()) ||
    null
  );
}

async function applyPwaUpdate() {
  const registration = await findBestRegistration();
  if (registration?.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
  window.setTimeout(() => window.location.reload(), 500);
}

export default function UpdateBanner() {
  const [visible, setVisible] = useState(false);
  const [updating, setUpdating] = useState(false);
  const isAdmin = window.location.pathname.startsWith('/admin') || document.documentElement.dataset.appShell === 'admin';

  useEffect(() => {
    const onUpdate = () => {
      const lastDismissed = Number(window.localStorage.getItem(DISMISS_KEY) || 0);
      if (Date.now() - lastDismissed < 10 * 60 * 1000) return;
      setVisible(true);
    };

    window.addEventListener('vlgn:pwa-update-available', onUpdate as EventListener);
    return () => window.removeEventListener('vlgn:pwa-update-available', onUpdate as EventListener);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed left-3 right-3 z-[9999] rounded-2xl border border-slate-700 bg-slate-950 p-3 text-white shadow-2xl"
      style={{ bottom: isAdmin ? 'calc(env(safe-area-inset-bottom) + 88px)' : 'calc(env(safe-area-inset-bottom) + 12px)' }}
      role="status"
      aria-live="polite"
    >
      <div className="mb-2 text-sm font-semibold">Có bản cập nhật mới</div>
      <div className="mb-3 text-xs text-slate-300">Cập nhật để nhận bản mới nhất, sửa cache PWA và tránh lỗi đăng nhập cũ.</div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={updating}
          onClick={() => {
            setUpdating(true);
            void applyPwaUpdate();
          }}
          className="flex-1 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {updating ? 'Đang cập nhật...' : 'Cập nhật ngay'}
        </button>
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
            setVisible(false);
          }}
          className="flex-1 rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200"
        >
          Để sau
        </button>
      </div>
    </div>
  );
}
