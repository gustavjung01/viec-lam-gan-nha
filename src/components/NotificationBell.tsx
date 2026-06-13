import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Loader2, X } from 'lucide-react';

type NotificationItem = {
  id: string;
  title: string;
  message?: string | null;
  url?: string | null;
  readAt?: string | null;
  createdAt?: string | null;
  isRead?: boolean;
};

type NotificationResponse = {
  success: boolean;
  data?: NotificationItem[];
  unreadCount?: number;
};

type NotificationBellProps = {
  variant?: 'desktop' | 'floating';
};

type PushPermissionStatus = 'unsupported' | 'missing_app_id' | 'default' | 'granted' | 'denied' | 'loading';

type OneSignalSdk = {
  init?: (options: { appId: string; allowLocalhostAsSecureOrigin?: boolean }) => Promise<void> | void;
  Notifications?: {
    requestPermission?: () => Promise<boolean> | boolean;
    permission?: boolean;
  };
  User?: {
    PushSubscription?: {
      id?: string | null;
      optedIn?: boolean;
      optIn?: () => Promise<void> | void;
    };
  };
  getUserId?: () => Promise<string | null> | string | null;
};

declare global {
  interface Window {
    OneSignalDeferred?: Array<(oneSignal: OneSignalSdk) => void>;
    OneSignal?: OneSignalSdk;
  }
}

const ONESIGNAL_SDK_SRC = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
let oneSignalInitPromise: Promise<OneSignalSdk> | null = null;

function unreadLabel(count: number) {
  if (count <= 0) return '';
  return count > 99 ? '99+' : String(count);
}

function formatTime(value?: string | null) {
  if (!value) return '';
  const timestamp = new Date(value.replace(' ', 'T')).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 1) return 'Vừa xong';
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} ngày trước`;
}

function getOneSignalAppId() {
  return String(import.meta.env.VITE_ONESIGNAL_APP_ID || '').trim();
}

function currentBrowserPermission(): PushPermissionStatus {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  const appId = getOneSignalAppId();
  if (!appId) return 'missing_app_id';
  return Notification.permission as PushPermissionStatus;
}

function ensureOneSignalScript() {
  if (typeof document === 'undefined') return Promise.reject(new Error('NO_DOCUMENT'));
  if (document.querySelector(`script[src="${ONESIGNAL_SDK_SRC}"]`)) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = ONESIGNAL_SDK_SRC;
    script.async = true;
    script.defer = true;
    script.dataset.vlgnOnesignal = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('ONESIGNAL_SDK_LOAD_FAILED'));
    document.head.appendChild(script);
  });
}

function getOneSignalSdk(appId: string) {
  if (oneSignalInitPromise) return oneSignalInitPromise;

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  oneSignalInitPromise = new Promise<OneSignalSdk>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('ONESIGNAL_SDK_TIMEOUT')), 10000);
    window.OneSignalDeferred?.push(async (oneSignal: OneSignalSdk) => {
      try {
        if (oneSignal.init) {
          await oneSignal.init({ appId, allowLocalhostAsSecureOrigin: true });
        }
        window.OneSignal = oneSignal;
        window.clearTimeout(timer);
        resolve(oneSignal);
      } catch (error) {
        window.clearTimeout(timer);
        if (String(error).toLowerCase().includes('already')) {
          resolve(oneSignal);
          return;
        }
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });

    void ensureOneSignalScript().catch((error) => {
      window.clearTimeout(timer);
      reject(error);
    });
  });

  return oneSignalInitPromise;
}

async function readOneSignalPlayerId(oneSignal: OneSignalSdk) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const id = oneSignal.User?.PushSubscription?.id || await oneSignal.getUserId?.();
    if (id) return String(id);
    await new Promise((resolve) => window.setTimeout(resolve, 500));
  }
  return '';
}

function useVisibleVariant(variant: 'desktop' | 'floating') {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(min-width: 768px)');
    const sync = () => setVisible(variant === 'desktop' ? query.matches : !query.matches);
    sync();
    query.addEventListener?.('change', sync);
    return () => query.removeEventListener?.('change', sync);
  }, [variant]);

  return visible;
}

export function NotificationBell({ variant = 'desktop' }: NotificationBellProps) {
  const navigate = useNavigate();
  const { isSignedIn, getToken } = useAuth();
  const isVisibleVariant = useVisibleVariant(variant);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<PushPermissionStatus>(() => currentBrowserPermission());
  const [pushMessage, setPushMessage] = useState('');

  const canLoad = Boolean(isSignedIn && isVisibleVariant);

  const fetchNotifications = useCallback(async (silent = false) => {
    if (!canLoad) return;
    try {
      if (!silent) setLoading(true);
      const token = await getToken();
      if (!token) return;
      const response = await fetch('/api/account/notifications?limit=10&offset=0', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = await response.json() as NotificationResponse;
      if (payload.success) {
        setItems(Array.isArray(payload.data) ? payload.data : []);
        setUnreadCount(Number(payload.unreadCount || 0));
      }
    } catch (error) {
      console.warn('Không tải được thông báo:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [canLoad, getToken]);

  useEffect(() => {
    setPushStatus(currentBrowserPermission());
  }, [isVisibleVariant]);

  useEffect(() => {
    if (!canLoad) {
      setOpen(false);
      setItems([]);
      setUnreadCount(0);
      return;
    }

    void fetchNotifications(true);
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') void fetchNotifications(true);
    }, 30000);

    const handleFocus = () => void fetchNotifications(true);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
    };
  }, [canLoad, fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [open]);

  const wrapperClass = useMemo(() => {
    if (variant === 'floating') return 'fixed right-4 top-20 z-[70] md:hidden';
    return 'relative';
  }, [variant]);

  const panelClass = useMemo(() => {
    if (variant === 'floating') return 'fixed right-3 top-32 z-[75] w-[calc(100vw-1.5rem)] max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl';
    return 'absolute right-0 top-full z-[75] mt-3 w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl';
  }, [variant]);

  if (!canLoad) return null;

  const markRead = async (notification: NotificationItem, navigateAfter = false) => {
    try {
      setBusyId(notification.id);
      const token = await getToken();
      if (!token) return;
      const response = await fetch(`/api/account/notifications/${encodeURIComponent(notification.id)}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (payload.success) {
        setItems((current) => current.map((item) => item.id === notification.id ? { ...item, readAt: payload.data?.readAt || item.readAt || new Date().toISOString(), isRead: true } : item));
        setUnreadCount(Number(payload.unreadCount || 0));
      }
    } catch (error) {
      console.warn('Không đánh dấu đã đọc được:', error);
    } finally {
      setBusyId(null);
      if (navigateAfter && notification.url) {
        setOpen(false);
        if (notification.url.startsWith('/')) navigate(notification.url);
        else window.location.href = notification.url;
      }
    }
  };

  const markAllRead = async () => {
    try {
      setBusyId('all');
      const token = await getToken();
      if (!token) return;
      const response = await fetch('/api/account/notifications/mark-all-read', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (payload.success) {
        const readAt = new Date().toISOString();
        setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || readAt, isRead: true })));
        setUnreadCount(Number(payload.unreadCount || 0));
      }
    } catch (error) {
      console.warn('Không đánh dấu tất cả đã đọc được:', error);
    } finally {
      setBusyId(null);
    }
  };

  const enablePushNotifications = async () => {
    if (pushStatus === 'loading') return;
    setPushMessage('');
    const appId = getOneSignalAppId();

    if (!('Notification' in window)) {
      setPushStatus('unsupported');
      setPushMessage('Trình duyệt này chưa hỗ trợ thông báo.');
      return;
    }
    if (!appId) {
      setPushStatus('missing_app_id');
      setPushMessage('Thiếu VITE_ONESIGNAL_APP_ID khi build frontend.');
      return;
    }
    if (Notification.permission === 'denied') {
      setPushStatus('denied');
      setPushMessage('Thông báo đang bị chặn trong trình duyệt. Hãy mở khóa trong cài đặt site.');
      return;
    }

    try {
      setPushStatus('loading');
      const token = await getToken();
      if (!token) throw new Error('NO_TOKEN');

      const oneSignal = await getOneSignalSdk(appId);
      if (oneSignal.Notifications?.requestPermission) {
        await oneSignal.Notifications.requestPermission();
      } else {
        await Notification.requestPermission();
      }
      if (oneSignal.User?.PushSubscription?.optIn) await oneSignal.User.PushSubscription.optIn();

      if (Notification.permission !== 'granted') {
        setPushStatus(Notification.permission as PushPermissionStatus);
        setPushMessage('Bạn chưa cấp quyền nhận thông báo.');
        return;
      }

      const playerId = await readOneSignalPlayerId(oneSignal);
      if (!playerId) throw new Error('NO_PLAYER_ID');

      let role = 'guest';
      let entityId: string | null = null;
      try {
        const accountResponse = await fetch('/api/account/me', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const accountPayload = await accountResponse.json();
        const companyId = accountPayload?.data?.company?.id;
        const ctvId = accountPayload?.data?.ctv?.id;
        if (companyId) {
          role = 'company';
          entityId = companyId;
        } else if (ctvId) {
          role = 'ctv';
          entityId = ctvId;
        }
      } catch {
        // Keep guest role if account lookup fails.
      }

      const response = await fetch('/api/account/notifications/subscribe', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playerId, role, entityId }),
      });
      const payload = await response.json();
      if (!payload.success) throw new Error(payload.error || 'SUBSCRIBE_FAILED');

      setPushStatus('granted');
      setPushMessage('Đã bật thông báo trình duyệt.');
    } catch (error) {
      console.warn('Không bật được OneSignal:', error);
      setPushStatus(currentBrowserPermission());
      setPushMessage('Chưa bật được thông báo. Kiểm tra OneSignal App ID hoặc thử lại.');
    }
  };

  const pushCta = (() => {
    if (pushStatus === 'granted') return { label: 'Đã bật thông báo trình duyệt', disabled: true };
    if (pushStatus === 'denied') return { label: 'Thông báo đang bị chặn', disabled: true };
    if (pushStatus === 'unsupported') return { label: 'Trình duyệt chưa hỗ trợ thông báo', disabled: true };
    if (pushStatus === 'missing_app_id') return { label: 'Thiếu OneSignal App ID', disabled: true };
    if (pushStatus === 'loading') return { label: 'Đang bật thông báo...', disabled: true };
    return { label: 'Bật thông báo trình duyệt', disabled: false };
  })();

  return (
    <div ref={containerRef} className={wrapperClass}>
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) void fetchNotifications(false);
        }}
        className={variant === 'floating'
          ? 'relative grid h-12 w-12 place-items-center rounded-full bg-brand-gold text-brand-navy shadow-xl ring-2 ring-white'
          : 'relative rounded-xl p-2 text-slate-200 hover:bg-white/10 hover:text-white'}
        aria-label="Thông báo"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[10px] font-black leading-none text-white ring-2 ring-brand-navy">
            {unreadLabel(unreadCount)}
          </span>
        )}
      </button>

      {open && (
        <div className={panelClass}>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <div className="text-sm font-black text-slate-900">Thông báo</div>
              <div className="text-xs text-slate-500">{unreadCount > 0 ? `${unreadCount} chưa đọc` : 'Không có thông báo mới'}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void markAllRead()}
                disabled={unreadCount === 0 || busyId === 'all'}
                className="rounded-lg px-2 py-1 text-xs font-bold text-brand-blue hover:bg-brand-blue/10 disabled:cursor-not-allowed disabled:text-slate-300"
                title="Đánh dấu tất cả đã đọc"
              >
                {busyId === 'all' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <button
              type="button"
              onClick={() => void enablePushNotifications()}
              disabled={pushCta.disabled}
              className="w-full rounded-xl border border-brand-blue/20 bg-white px-3 py-2 text-xs font-black text-brand-blue shadow-sm hover:bg-brand-blue/5 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
            >
              {pushStatus === 'loading' ? <span className="inline-flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {pushCta.label}</span> : pushCta.label}
            </button>
            {pushMessage && <div className="mt-2 text-[11px] font-semibold leading-4 text-slate-500">{pushMessage}</div>}
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Đang tải thông báo...
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">Chưa có thông báo nào.</div>
            ) : (
              items.map((notification) => {
                const isRead = Boolean(notification.isRead || notification.readAt);
                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => void markRead(notification, Boolean(notification.url))}
                    className={`block w-full border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 ${isRead ? 'bg-white' : 'bg-blue-50/70'}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`mt-1 h-2.5 w-2.5 flex-none rounded-full ${isRead ? 'bg-slate-200' : 'bg-red-500'}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-extrabold text-slate-900">{notification.title}</span>
                        {notification.message && <span className="mt-1 block text-xs leading-5 text-slate-600">{notification.message}</span>}
                        <span className="mt-2 block text-[11px] font-semibold text-slate-400">{formatTime(notification.createdAt)}</span>
                      </span>
                      {busyId === notification.id && <Loader2 className="mt-1 h-4 w-4 animate-spin text-slate-400" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
