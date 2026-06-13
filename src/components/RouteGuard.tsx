import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUser, useAuth } from '@clerk/clerk-react';
import { useRole } from '../contexts/RoleContext';
import type { UserRole } from '../contexts/RoleContext';

interface RouteGuardProps {
  children: ReactNode;
  allowedRoles: UserRole[];
  fallback?: ReactNode;
}

// Route permission matrix
const routePermissions: Record<string, UserRole[]> = {
  '/ctv': ['ctv', 'admin'],
  '/company': ['company', 'admin'],
  '/admin': ['admin'],
};

export function RouteGuard({ children, allowedRoles, fallback }: RouteGuardProps) {
  const { role, setRole } = useRole();
  const { isLoaded, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const location = useLocation();
  const [pendingStatus, setPendingStatus] = useState<{type: string; status: string} | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  // Check backend account status to detect pending approvals
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setPendingStatus(null);
      setIsChecking(false);
      return;
    }

    const checkBackendStatus = async () => {
      setIsChecking(true);
      setPendingStatus(null);
      try {
        const token = await getToken();
        const res = await fetch('/api/account/me', {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) {
            // Update role based on backend registration
            // Ưu tiên check theo route đang vào
            const needsCompany = allowedRoles.includes('company');
            const needsCTV = allowedRoles.includes('ctv');

            if (needsCompany && data.data.company) {
              const status = data.data.company.status;
              setRole('company');
              if (status === 'pending') {
                setPendingStatus({ type: 'company', status: 'pending' });
              } else {
                setPendingStatus(null);
              }
            } else if (needsCTV && data.data.ctv) {
              const status = data.data.ctv.status;
              setRole('ctv');
              if (status === 'pending') {
                setPendingStatus({ type: 'ctv', status: 'pending' });
              } else {
                setPendingStatus(null);
              }
            } else if (data.data.ctv) {
              // Fallback: check CTV trước
              const status = data.data.ctv.status;
              setRole('ctv');
              if (status === 'pending') {
                setPendingStatus({ type: 'ctv', status: 'pending' });
              } else {
                setPendingStatus(null);
              }
            } else if (data.data.company) {
              // Fallback: check Company
              const status = data.data.company.status;
              setRole('company');
              if (status === 'pending') {
                setPendingStatus({ type: 'company', status: 'pending' });
              } else {
                setPendingStatus(null);
              }
            }
          }
        }
      } catch {}
      finally {
        setIsChecking(false);
      }
    };

    checkBackendStatus();
  }, [isLoaded, isSignedIn, getToken, setRole]);

  const hasPermission = allowedRoles.includes(role);

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600"></div>
          <p className="text-slate-600">Đang kiểm tra...</p>
        </div>
      </div>
    );
  }

  if (pendingStatus) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md rounded-2xl bg-yellow-50 p-8 text-center border border-yellow-200 shadow-lg">
          <div className="text-6xl mb-4">⏳</div>
          <h2 className="text-xl font-semibold text-yellow-900 mb-2">Hồ sơ đang chờ duyệt</h2>
          <p className="text-yellow-700 mb-4">
            Hồ sơ {pendingStatus.type === 'ctv' ? 'CTV tuyển dụng' : 'công ty tuyển dụng'} của bạn đang chờ admin duyệt.
          </p>
          <p className="text-sm text-yellow-600 mb-6">
            Thông thường duyệt trong 24h. Cần hỗ trợ, liên hệ: 0909.xxx.xxx
          </p>
          <a href="/tai-khoan" className="inline-block rounded-xl bg-green-600 px-6 py-3 text-white font-semibold hover:bg-green-700 transition-colors">
            Kiểm tra trạng thái
          </a>
        </div>
      </div>
    );
  }

  if (!hasPermission) {
    if (fallback) {
      return <>{fallback}</>;
    }

    // Redirect based on role
    if (role === 'guest') {
      return <Navigate to="/" replace state={{ from: location }} />;
    }
    if (role === 'ctv') {
      return <Navigate to="/ctv/dashboard" replace state={{ from: location }} />;
    }
    if (role === 'company') {
      return <Navigate to="/company/dashboard" replace state={{ from: location }} />;
    }

    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export function CTVRoute({ children }: { children: ReactNode }) {
  return (
    <RouteGuard allowedRoles={['ctv', 'admin']}>
      {children}
    </RouteGuard>
  );
}

export function CompanyRoute({ children }: { children: ReactNode }) {
  return (
    <RouteGuard allowedRoles={['company', 'admin']}>
      {children}
    </RouteGuard>
  );
}

export function AdminRoute({ children }: { children: ReactNode }) {
  return (
    <RouteGuard allowedRoles={['admin']}>
      {children}
    </RouteGuard>
  );
}

export function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="mb-4 text-6xl font-bold text-red-500">403</div>
        <h1 className="mb-2 text-2xl font-bold text-slate-900">Không có quyền truy cập</h1>
        <p className="mb-6 text-slate-600">
          Bạn không có quyền truy cập trang này.
        </p>
        <div className="mt-6">
          <a href="/" className="text-brand-orange hover:underline">
            ← Về trang chủ
          </a>
        </div>
      </div>
    </div>
  );
}

export function useRoutePermission(pathname: string): boolean {
  return true;
}
