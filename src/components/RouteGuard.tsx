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

type PendingStatus = {
  type: 'ctv' | 'company';
  status: string;
  reason?: string;
};

const APPROVED_STATUSES = new Set(['active', 'approved']);
const PENDING_STATUSES = new Set(['pending', 'submitted', 'reviewing']);
const BLOCKED_STATUSES = new Set(['rejected', 'blocked', 'suspended', 'banned']);

function normalizeStatus(status: unknown) {
  return String(status || '').trim().toLowerCase();
}

function isApprovedStatus(status: unknown) {
  return APPROVED_STATUSES.has(normalizeStatus(status));
}

function getAccountGate(type: 'ctv' | 'company', account: any): PendingStatus | null {
  const status = normalizeStatus(account?.status);
  if (!account) return null;
  if (isApprovedStatus(status)) return null;
  if (PENDING_STATUSES.has(status)) return { type, status: 'pending' };
  if (BLOCKED_STATUSES.has(status)) {
    return { type, status: status || 'blocked', reason: account?.rejection_reason || account?.reason || '' };
  }
  return { type, status: status || 'pending' };
}

export function RouteGuard({ children, allowedRoles, fallback }: RouteGuardProps) {
  const { role, setRole } = useRole();
  const { isLoaded, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const location = useLocation();
  const [pendingStatus, setPendingStatus] = useState<PendingStatus | null>(null);
  const [isChecking, setIsChecking] = useState(true);

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
            const needsCompany = allowedRoles.includes('company');
            const needsCTV = allowedRoles.includes('ctv');
            const company = data.data.company;
            const ctv = data.data.ctv;

            if (needsCompany && company) {
              setRole('company');
              setPendingStatus(getAccountGate('company', company));
            } else if (needsCTV && ctv) {
              setRole('ctv');
              setPendingStatus(getAccountGate('ctv', ctv));
            } else if (ctv) {
              setRole('ctv');
              setPendingStatus(getAccountGate('ctv', ctv));
            } else if (company) {
              setRole('company');
              setPendingStatus(getAccountGate('company', company));
            } else {
              setRole('guest');
              setPendingStatus(null);
            }
          }
        }
      } catch {}
      finally {
        setIsChecking(false);
      }
    };

    checkBackendStatus();
  }, [isLoaded, isSignedIn, getToken, setRole, allowedRoles]);

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
    const blocked = BLOCKED_STATUSES.has(normalizeStatus(pendingStatus.status));
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className={`max-w-md rounded-2xl p-8 text-center border shadow-lg ${blocked ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50'}`}>
          <div className="text-6xl mb-4">{blocked ? '🚫' : '⏳'}</div>
          <h2 className={`text-xl font-semibold mb-2 ${blocked ? 'text-red-900' : 'text-yellow-900'}`}>
            {blocked ? 'Hồ sơ chưa được duyệt' : 'Hồ sơ đang chờ duyệt'}
          </h2>
          <p className={`${blocked ? 'text-red-700' : 'text-yellow-700'} mb-4`}>
            Hồ sơ {pendingStatus.type === 'ctv' ? 'CTV tuyển dụng' : 'công ty tuyển dụng'} của bạn {blocked ? 'chưa được mở quyền truy cập.' : 'đang chờ admin duyệt.'}
          </p>
          {pendingStatus.reason && (
            <p className={`mb-4 rounded-xl px-3 py-2 text-sm ${blocked ? 'bg-white text-red-700' : 'bg-white text-yellow-700'}`}>
              Lý do: {pendingStatus.reason}
            </p>
          )}
          <p className={`text-sm mb-6 ${blocked ? 'text-red-600' : 'text-yellow-600'}`}>
            Cần hỗ trợ, vui lòng liên hệ quản trị viên để kiểm tra hồ sơ.
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
