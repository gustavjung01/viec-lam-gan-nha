import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Briefcase, TrendingUp, Shield, Users, ArrowRight, CheckCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function EmployerLandingPage() {
  const navigate = useNavigate();
  const { isSignedIn, userId, getToken } = useAuth();
  const [companyStatus, setCompanyStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    const checkCompanyStatus = async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${API_URL}/company/by-clerk/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.data) {
          setCompanyStatus(data.data.status);
        }
      } catch (err) {
        // Chưa đăng ký
      } finally {
        setLoading(false);
      }
    };

    checkCompanyStatus();
  }, [isSignedIn, userId, getToken]);

  const isCompany = companyStatus === 'active' || companyStatus === 'pending';

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-brand-navy py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <h1 className="text-4xl font-bold leading-tight md:text-5xl">
                Tuyển dụng <span className="text-brand-orange">bảo vệ</span> & lao động phổ thông
              </h1>
              <p className="mt-6 text-lg text-slate-300">
                Tiếp cận hàng nghìn ứng viên gần khu vực bạn. Chỉ trả phí khi tuyển thành công 
                qua mạng lưới Cộng tác viên (CTV) của chúng tôi.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                {loading ? (
                  <div className="rounded-xl bg-slate-600 px-6 py-3 font-semibold text-white">
                    Đang kiểm tra...
                  </div>
                ) : isCompany ? (
                  <button
                    onClick={() => navigate('/company/dashboard')}
                    className="rounded-xl bg-purple-500 px-6 py-3 font-semibold text-white hover:bg-purple-600"
                  >
                    Vào Dashboard Công ty
                  </button>
                ) : (
                  <Link
                    to="/tai-khoan?tab=company"
                    className="rounded-xl bg-brand-orange px-6 py-3 font-semibold text-white hover:bg-orange-600"
                  >
                    Đăng ký tuyển dụng
                  </Link>
                )}
                <a
                  href="#how-it-works"
                  className="rounded-xl border border-white/30 px-6 py-3 font-semibold text-white hover:bg-white/10"
                >
                  Tìm hiểu thêm
                </a>
              </div>
            </div>
            <div className="rounded-3xl bg-white/5 p-8 backdrop-blur">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="rounded-xl bg-green-500/20 p-3 text-green-400">
                    <Users className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">15,000+</p>
                    <p className="text-slate-400">Ứng viên tiềm năng</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="rounded-xl bg-blue-500/20 p-3 text-blue-400">
                    <Briefcase className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">500+</p>
                    <p className="text-slate-400">CTV tuyển dụng</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="rounded-xl bg-purple-500/20 p-3 text-purple-400">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">80%</p>
                    <p className="text-slate-400">Tỷ lệ nhận lead phù hợp</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <h2 className="text-center text-3xl font-bold text-slate-900">Cách thức hoạt động</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-orange text-white font-bold text-xl">
                1
              </div>
              <h3 className="text-xl font-semibold text-slate-900">Tạo chiến dịch</h3>
              <p className="mt-3 text-slate-600">
                Mô tả vị trí tuyển dụng, địa điểm, yêu cầu và đặt mức thưởng cho mỗi ứng viên thành công.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-orange text-white font-bold text-xl">
                2
              </div>
              <h3 className="text-xl font-semibold text-slate-900">CTV giới thiệu</h3>
              <p className="mt-3 text-slate-600">
                Mạng lưới CTV tìm kiếm ứng viên phù hợp trong cộng đồng và gửi hồ sơ về cho bạn.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-orange text-white font-bold text-xl">
                3
              </div>
              <h3 className="text-xl font-semibold text-slate-900">Chỉ trả khi tuyển</h3>
              <p className="mt-3 text-slate-600">
                Nhận hồ sơ ẩn danh, chỉ trả phí khi bạn quyết định nhận thông tin liên hệ và phỏng vấn.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <h2 className="text-center text-3xl font-bold text-slate-900">Chi phí minh bạch</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-2">
            <div className="rounded-2xl bg-white p-8 shadow-sm">
              <h3 className="text-xl font-semibold text-slate-900">Mô hình Pay-per-Lead</h3>
              <ul className="mt-6 space-y-4">
                <li className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-slate-700">Không phí đăng ký, không phí duy trì</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-slate-700">Chỉ trả khi nhận lead phù hợp</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-slate-700">Bạn tự đặt mức thưởng (từ 300K - 1M)</span>
                </li>
              </ul>
            </div>
            <div className="rounded-2xl bg-brand-navy p-8 text-white">
              <h3 className="text-xl font-semibold">Tuyển dụng theo lead hợp lệ</h3>
              <ul className="mt-6 space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                  <span className="text-slate-200">Chỉ đối soát ứng viên đạt điều kiện</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                  <span className="text-slate-200">Chi phí minh bạch theo từng chiến dịch</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                  <span className="text-slate-200">Đặt ngân sách tuyển dụng linh hoạt theo từng lead hợp lệ</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                  <span className="text-slate-200">Không giới hạn số chiến dịch đăng tải</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="flex items-center justify-center gap-2 text-slate-500">
            <Shield className="h-5 w-5" />
            <span>Hệ thống chống gian lận, bảo vệ dữ liệu ứng viên</span>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand-orange py-16">
        <div className="mx-auto max-w-7xl px-4 text-center md:px-6">
          <h2 className="text-3xl font-bold text-white">Sẵn sàng tuyển dụng?</h2>
          <p className="mt-4 text-white/90">
            Đăng ký miễn phí, tạo chiến dịch đầu tiên trong 5 phút.
          </p>
          <Link
            to="/tai-khoan?tab=company"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 font-bold text-brand-orange hover:bg-slate-100"
          >
            Bắt đầu ngay <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
