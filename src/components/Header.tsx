import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, Menu, User, X, LogOut } from 'lucide-react';
import { SignedIn, SignedOut, UserButton, useClerk, useAuth } from '@clerk/clerk-react';
import { siteConfig } from '../config/site';
import { ASSETS } from '../config/assets';
import { NotificationBell } from './NotificationBell';
import { AdminNotificationBell } from './AdminNotificationBell';

export function Header() {
  const location = useLocation();
  const { signOut } = useClerk();
  const { isSignedIn, userId, getToken } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [ctvStatus, setCtvStatus] = useState<string | null>(null);
  const [companyStatus, setCompanyStatus] = useState<string | null>(null);
  const [adminSessionToken, setAdminSessionToken] = useState<string | null>(() => localStorage.getItem('vlgn_admin_session'));
  const isAdminPage = location.pathname.startsWith('/admin');
  const showAdminBell = Boolean(isAdminPage && adminSessionToken);

  useEffect(() => {
    if (!isSignedIn || !userId) {
      setCtvStatus(null);
      setCompanyStatus(null);
      return;
    }

    const checkStatuses = async () => {
      try {
        const token = await getToken();

        const ctvRes = await fetch(`/api/ctv/by-clerk/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const ctvData = await ctvRes.json();
        if (ctvData.success && ctvData.data) {
          setCtvStatus(ctvData.data.status);
        }

        const companyRes = await fetch(`/api/company/by-clerk/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const companyData = await companyRes.json();
        if (companyData.success && companyData.data) {
          setCompanyStatus(companyData.data.status);
        }
      } catch (err) {
        // Không tìm thấy = chưa đăng ký
      }
    };

    checkStatuses();
  }, [isSignedIn, userId, getToken]);

  useEffect(() => {
    const syncAdminSession = () => setAdminSessionToken(localStorage.getItem('vlgn_admin_session'));
    syncAdminSession();
    const timer = window.setInterval(syncAdminSession, 1000);
    window.addEventListener('storage', syncAdminSession);
    window.addEventListener('focus', syncAdminSession);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('storage', syncAdminSession);
      window.removeEventListener('focus', syncAdminSession);
    };
  }, [location.pathname]);

  const getMenuItems = () => {
    const items = [
      { to: '/viec-lam', label: 'Việc làm' },
    ];

    if (companyStatus === 'active' || companyStatus === 'pending') {
      items.push({ to: '/company/dashboard', label: 'Dashboard Công ty' });
    } else {
      items.push({ to: '/nha-tuyen-dung', label: 'Dành cho công ty' });
    }

    if (ctvStatus === 'active' || ctvStatus === 'pending') {
      items.push({ to: '/ctv/dashboard', label: 'Dashboard CTV' });
    } else {
      items.push({ to: '/ctv', label: 'Cộng tác viên' });
    }

    items.push({ to: '/tai-khoan', label: 'Tài khoản' });
    return items;
  };

  const menuItems = getMenuItems();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-brand-navy pt-[env(safe-area-inset-top)] text-white shadow-lg shadow-slate-900/10">
      <div className="mx-auto flex min-h-[64px] max-w-7xl items-center justify-between gap-2 px-3 py-2 md:px-6 md:py-3">
        <Link to="/" className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 lg:flex-none">
          <img
            src={ASSETS.logo}
            alt="Vieclamgannha"
            className="h-10 w-10 shrink-0 rounded-2xl object-contain bg-white/10 p-1 ring-1 ring-white/15"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <div className="min-w-0">
            <div className="max-w-[calc(100vw-9.25rem)] truncate text-lg font-extrabold leading-tight tracking-tight sm:max-w-none sm:text-xl">
              {siteConfig.brand}
            </div>
            <div className="hidden truncate text-xs text-slate-300 min-[390px]:block">{siteConfig.tagline}</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-200 lg:flex">
          {menuItems.map((item: {to: string, label: string}) => (
            <Link
              key={item.to}
              to={item.to}
              className={location.pathname === item.to ? 'text-white' : 'hover:text-white'}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {showAdminBell && <AdminNotificationBell variant="desktop" />}

          <SignedOut>
            {!showAdminBell && (
              <Link to="/tai-khoan" className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 flex items-center gap-2">
                <User className="h-4 w-4" />
                Đăng nhập
              </Link>
            )}
          </SignedOut>

          <SignedIn>
            {!showAdminBell && <NotificationBell variant="desktop" />}
            <button
              onClick={() => signOut()}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Đăng xuất
            </button>
            <UserButton />
          </SignedIn>
        </div>

        <div className="flex shrink-0 items-center gap-2 lg:hidden">
          <SignedOut>
            <Link
              to="/tai-khoan"
              aria-label="Đăng nhập để xem thông báo"
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/10 active:scale-95"
            >
              <Bell className="h-5 w-5" />
            </Link>
          </SignedOut>
          <button
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/10 active:scale-95"
            aria-label="Mở menu"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {showAdminBell && <AdminNotificationBell variant="floating" />}
      {!showAdminBell && (
        <SignedIn>
          <NotificationBell variant="floating" />
        </SignedIn>
      )}

      {mobileMenuOpen && (
        <div className="border-t border-white/10 bg-brand-navy px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-2">
            {menuItems.map((item: {to: string, label: string}) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  location.pathname === item.to
                    ? 'bg-white/10 text-white'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <div className="border-t border-white/10 pt-2 mt-2">
              <SignedOut>
                <Link
                  to="/tai-khoan"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white flex items-center gap-2"
                >
                  <User className="h-4 w-4" />
                  Đăng nhập
                </Link>
              </SignedOut>
              <SignedIn>
                <button
                  onClick={() => {
                    signOut();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-left rounded-xl px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Đăng xuất
                </button>
              </SignedIn>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
