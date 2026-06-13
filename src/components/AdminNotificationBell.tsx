import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Loader2, X } from 'lucide-react';

type AdminNotificationItem = {
  id: string;
  title: string;
  message?: string | null;
  url?: string | null;
  readAt?: string | null;
  createdAt?: string | null;
  isRead?: boolean;
};

type AdminNotificationResponse = {
  success: boolean;
  data?: AdminNotificationItem[];
  unreadCount?: number;
};

type AdminNotificationBellProps = {
  variant?: 'desktop' | 'floating';
};

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

function isNotificationRead(notification: AdminNotificationItem) {
  return Boolean(notification.isRead || notification.readAt);
}

function countUnreadItems(items: AdminNotificationItem[]) {
  return items.reduce((total, item) => total + (isNotificationRead(item) ? 0 : 1), 0);
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

function getAdminToken() {
  try {
    return localStorage.getItem('vlgn_admin_session') || '';
  } catch {
    return '';
  }
}

export function AdminNotificationBell({ variant = 'desktop' }: AdminNotificationBellProps) {
  const navigate = useNavigate();
  const isVisibleVariant = useVisibleVariant(variant);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AdminNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adminToken, setAdminToken] = useState(() => getAdminToken());

  const canLoad = Boolean(adminToken && isVisibleVariant);

  const fetchNotifications = useCallback(async (silent = false) => {
    if (!canLoad) return;
    try {
      if (!silent) setLoading(true);
      const response = await fetch('/api/admin/auth/notifications?limit=10&offset=0', {
        headers: { Authorization: `Bearer ${adminToken}` },
        cache: 'no-store',
      });
      const payload = await response.json() as AdminNotificationResponse;
      if (payload.success) {
        const nextItems = Array.isArray(payload.data) ? payload.data : [];
        const apiUnreadCount = Number(payload.unreadCount || 0);
        const visibleUnreadCount = countUnreadItems(nextItems);
        setItems(nextItems);
        setUnreadCount(Math.max(apiUnreadCount, visibleUnreadCount));
      }
    } catch (error) {
      console.warn('Không tải được thông báo admin:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [adminToken, canLoad]);

  useEffect(() => {
    const syncToken = () => setAdminToken(getAdminToken());
    syncToken();
    window.addEventListener('storage', syncToken);
    window.addEventListener('focus', syncToken);
    return () => {
      window.removeEventListener('storage', syncToken);
      window.removeEventListener('focus', syncToken);
    };
  }, []);

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

  const markRead = async (notification: AdminNotificationItem, navigateAfter = false) => {
    try {
      setBusyId(notification.id);
      const response = await fetch(`/api/admin/auth/notifications/${encodeURIComponent(notification.id)}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const payload = await response.json();
      if (payload.success) {
        const readAt = payload.data?.readAt || notification.readAt || new Date().toISOString();
        setItems((current) => {
          const nextItems = current.map((item) => item.id === notification.id ? { ...item, readAt, isRead: true } : item);
          setUnreadCount(Math.max(Number(payload.unreadCount || 0), countUnreadItems(nextItems)));
          return nextItems;
        });
      }
    } catch (error) {
      console.warn('Không đánh dấu đã đọc thông báo admin được:', error);
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
      const response = await fetch('/api/admin/auth/notifications/mark-all-read', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const payload = await response.json();
      if (payload.success) {
        const readAt = new Date().toISOString();
        setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || readAt, isRead: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.warn('Không đánh dấu tất cả thông báo admin được:', error);
    } finally {
      setBusyId(null);
    }
  };

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
        aria-label="Thông báo admin"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 z-10 min-w-5 rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[10px] font-black leading-none text-white ring-2 ring-white">
            {unreadLabel(unreadCount)}
          </span>
        )}
      </button>

      {open && (
        <div className={panelClass}>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <div className="text-sm font-black text-slate-900">Thông báo Admin</div>
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

          <div className="max-h-[70vh] overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Đang tải thông báo...
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">Chưa có thông báo admin nào.</div>
            ) : (
              items.map((notification) => {
                const isRead = isNotificationRead(notification);
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
