import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';
import { Building2, MapPin, Phone, Mail, User, Globe, Briefcase, TrendingUp, AlertCircle, PlusCircle } from 'lucide-react';

interface CompanyProfile {
  id: string;
  company_name: string;
  tax_code: string;
  business_code: string;
  address: string;
  province: string;
  district: string;
  phone: string;
  email: string;
  website: string;
  representative_name: string;
  representative_phone: string;
  representative_email: string;
  status: 'pending' | 'active' | 'blocked' | 'rejected';
  total_campaigns: number;
  total_leads_received: number;
  created_at: string;
  approved_at: string | null;
  rejection_reason: string | null;
}

const defaultCompanyProfile: CompanyProfile = {
  id: '',
  company_name: '',
  tax_code: '',
  business_code: '',
  address: '',
  province: '',
  district: '',
  phone: '',
  email: '',
  website: '',
  representative_name: '',
  representative_phone: '',
  representative_email: '',
  status: 'pending',
  total_campaigns: 0,
  total_leads_received: 0,
  created_at: '',
  approved_at: null,
  rejection_reason: null,
};

export default function CompanyProfilePage() {
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [profile, setProfile] = useState<CompanyProfile>(defaultCompanyProfile);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || !user) {
      setLoading(false);
      return;
    }

    const fetchCompanyProfile = async () => {
      try {
        const clerkId = user.id;
        const token = await getToken();
        const response = await fetch(`/api/company/by-clerk/${clerkId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success && data.data) {
          setProfile(data.data);
        } else {
          setError('Bạn chưa đăng ký công ty');
        }
      } catch (err) {
        setError('Không thể tải thông tin công ty');
      } finally {
        setLoading(false);
      }
    };

    fetchCompanyProfile();
  }, [isSignedIn, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-surface flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue mx-auto"></div>
          <p className="mt-4 text-slate-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-brand-surface">
        <div className="mx-auto max-w-4xl px-4 py-12 md:px-6">
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <Building2 className="mx-auto h-16 w-16 text-slate-300" />
            <h2 className="mt-4 text-xl font-semibold text-slate-900">Vui lòng đăng nhập</h2>
            <p className="mt-2 text-slate-600">Bạn cần đăng nhập để xem hồ sơ công ty</p>
            <Link
              to="/tai-khoan?tab=company"
              className="mt-4 inline-block rounded-xl bg-brand-blue px-6 py-2.5 font-semibold text-white hover:bg-blue-700"
            >
              Đăng nhập
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-brand-surface">
        <div className="mx-auto max-w-4xl px-4 py-12 md:px-6">
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <AlertCircle className="mx-auto h-16 w-16 text-amber-500" />
            <h2 className="mt-4 text-xl font-semibold text-slate-900">{error}</h2>
            <p className="mt-2 text-slate-600">Bạn có thể đăng ký công ty ngay bây giờ</p>
            <Link
              to="/tai-khoan?tab=company"
              className="mt-4 inline-block rounded-xl bg-brand-blue px-6 py-2.5 font-semibold text-white hover:bg-blue-700"
            >
              Đăng ký công ty
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-surface">
      {/* Breadcrumb */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-3 md:px-6">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Link to="/" className="hover:text-brand-blue">Trang chủ</Link>
            <span>/</span>
            <span className="text-slate-950 font-medium">Hồ sơ Công ty</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
        {/* Header */}
        <div className="mb-8 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{profile.company_name || 'Công ty của bạn'}</h1>
              <p className="mt-1 text-blue-100">Mã: {profile.id || 'CTY-XXXX'}</p>
            </div>
            <div className="rounded-full bg-white/20 p-3">
              <Building2 className="h-8 w-8" />
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Main Info */}
          <div className="md:col-span-2 space-y-6">
            {/* Status Card */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Trạng thái</h2>
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-medium
                  ${profile.status === 'active' ? 'bg-green-100 text-green-800' :
                    profile.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                    profile.status === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-slate-100 text-slate-800'}`}
                >
                  {profile.status === 'active' ? 'Đang hoạt động' :
                   profile.status === 'pending' ? 'Chờ duyệt' :
                   profile.status === 'rejected' ? 'Từ chối' : 'Bị khóa'}
                </span>
              </div>
              {profile.status === 'pending' && (
                <p className="mt-3 text-sm text-amber-700">
                  Hồ sơ công ty đang chờ admin duyệt. Bạn chưa thể tạo chiến dịch tuyển dụng.
                </p>
              )}
              {profile.rejection_reason && (
                <p className="mt-3 text-sm text-red-600">
                  Lý do từ chối: {profile.rejection_reason}
                </p>
              )}
            </div>

            {/* Company Info */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Thông tin công ty</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500">Tên công ty</p>
                    <p className="font-medium text-slate-900">{profile.company_name || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Briefcase className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500">Mã số thuế</p>
                    <p className="font-medium text-slate-900">{profile.tax_code || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500">Địa chỉ</p>
                    <p className="font-medium text-slate-900">{profile.address || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500">Khu vực</p>
                    <p className="font-medium text-slate-900">
                      {profile.district ? `${profile.district}, ${profile.province}` : profile.province || '-'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500">Điện thoại</p>
                    <p className="font-medium text-slate-900">{profile.phone || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500">Email</p>
                    <p className="font-medium text-slate-900">{profile.email || '-'}</p>
                  </div>
                </div>
                {profile.website && (
                  <div className="flex items-center gap-3 md:col-span-2">
                    <Globe className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="text-sm text-slate-500">Website</p>
                      <a href={profile.website} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-blue hover:underline">
                        {profile.website}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Representative Info */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Người đại diện</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500">Họ tên</p>
                    <p className="font-medium text-slate-900">{profile.representative_name || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500">Số điện thoại</p>
                    <p className="font-medium text-slate-900">{profile.representative_phone || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 md:col-span-2">
                  <Mail className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500">Email</p>
                    <p className="font-medium text-slate-900">{profile.representative_email || '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Stats */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Thống kê</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Chiến dịch</span>
                  <span className="font-bold text-brand-blue">{profile.total_campaigns}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Lead nhận được</span>
                  <span className="font-bold text-green-600">{profile.total_leads_received}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            {profile.status === 'active' && (
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-slate-900">Hành động</h2>
                <Link
                  to="/company/dashboard"
                  className="block w-full rounded-xl bg-brand-blue px-4 py-3 text-center font-semibold text-white hover:bg-blue-700"
                >
                  <Briefcase className="mr-2 inline h-4 w-4" />
                  Dashboard Công ty
                </Link>
                <Link
                  to="/company/campaigns/new"
                  className="mt-3 block w-full rounded-xl border border-slate-200 px-4 py-3 text-center font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <PlusCircle className="mr-2 inline h-4 w-4" />
                  Tạo chiến dịch mới
                </Link>
              </div>
            )}

            {/* Register Date */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-slate-900">Thời gian</h2>
              <p className="text-sm text-slate-600">
                Đăng ký: {profile.created_at ? new Date(profile.created_at).toLocaleDateString('vi-VN') : '-'}
              </p>
              {profile.approved_at && (
                <p className="mt-2 text-sm text-slate-600">
                  Duyệt: {new Date(profile.approved_at).toLocaleDateString('vi-VN')}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
