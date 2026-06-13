import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, User, X, LogOut } from 'lucide-react';
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

  // Kiểm tra trạng thái CTV và Company khi đăng nhập
  useEffect(() => {
    if (!isSignedIn || !userId) {
      setCtvStatus(null);
      setCompanyStatus(null);
      return;
    }

    const checkStatuses = async () => {
      try {
        const token = await getToken();

        // Check CTV status
        const ctvRes = await fetch(`/api/ctv/by-clerk/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const ctvData = await ctvRes.json();
        if (ctvData.success && ctvData.data) {
          setCtvStatus(ctvData.data.status);
        }

        // Check Company status
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

  // Menu items động dựa trên trạng thái
  const getMenuItems = () => {
    const items = [
      { to: '/viec-lam', label: 'Việc làm' },
    ];

    // Company: Nếu đã active → vào dashboard, nếu chưa → landing
    if (companyStatus === 'active' || companyStatus === 'pending') {
      items.push({ to: '/company/dashboard', label: 'Dashboard Công ty' });
    } else {
      items.push({ to: '/nha-tuyen-dung', label: 'Dành cho công ty' });
    }

    // CTV: Nếu đã active → vào dashboard, nếu chưa → landing
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
    <header className="sticky top-0 z-40 border-b border-white/10 bg-brand-navy text-white shadow-lg shadow-slate-900/10">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
        <Link to="/" className="flex items-center gap-3">
          <img
            src={ASSETS.logo}
            alt="Vieclamgannha"
            className="h-10 w-10 rounded-2xl object-contain bg-white/10 p-1 ring-1 ring-white/15"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <div>
            <div className="font-extrabold tracking-tight">{siteConfig.brand}</div>
            <div className="text-xs text-slate-300">{siteConfig.tagline}</div>
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

        <button
          className="rounded-xl p-2 hover:bg-white/10 lg:hidden"
          aria-label="Mở menu"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {showAdminBell && <AdminNotificationBell variant="floating" />}
      {!showAdminBell && (
        <SignedIn>
          <NotificationBell variant="floating" />
        </SignedIn>
      )}

      {/* Mobile menu */}
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
