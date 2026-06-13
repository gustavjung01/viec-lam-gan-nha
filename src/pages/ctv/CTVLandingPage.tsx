import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Briefcase, TrendingUp, Users, Shield, CheckCircle, ArrowRight, Star } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function CTVLandingPage() {
  const navigate = useNavigate();
  const { isSignedIn, userId, getToken } = useAuth();
  const [ctvStatus, setCtvStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSignedIn || !userId) {
      setLoading(false);
      return;
    }

    const checkCTVStatus = async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${API_URL}/ctv/by-clerk/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.data) {
          setCtvStatus(data.data.status);
        }
      } catch (err) {
        // Chưa đăng ký
      } finally {
        setLoading(false);
      }
    };

    checkCTVStatus();
  }, [isSignedIn, userId, getToken]);

  const isCTV = ctvStatus === 'active' || ctvStatus === 'pending';

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-brand-navy py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <h1 className="text-4xl font-bold leading-tight md:text-5xl">
                Trở thành <span className="text-brand-orange">Cộng tác viên</span> tuyển dụng
              </h1>
              <p className="mt-6 text-lg text-slate-300">
                Giới thiệu ứng viên phù hợp, nhận hoa hồng hấp dẫn. Không cần văn phòng, làm việc mọi lúc mọi nơi.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                {loading ? (
                  <div className="rounded-xl bg-slate-600 px-6 py-3 font-semibold text-white">
                    Đang kiểm tra...
                  </div>
                ) : isCTV ? (
                  <button
                    onClick={() => navigate('/ctv/dashboard')}
                    className="rounded-xl bg-green-500 px-6 py-3 font-semibold text-white hover:bg-green-600"
                  >
                    Vào Dashboard CTV
                  </button>
                ) : (
                  <Link
                    to="/tai-khoan?tab=ctv"
                    className="rounded-xl bg-brand-orange px-6 py-3 font-semibold text-white hover:bg-orange-600"
                  >
                    Đăng ký làm CTV
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
                    <p className="text-2xl font-bold">500+</p>
                    <p className="text-slate-400">CTV đang hoạt động</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="rounded-xl bg-blue-500/20 p-3 text-blue-400">
                    <Briefcase className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">2,000+</p>
                    <p className="text-slate-400">Ứng viên được giới thiệu</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="rounded-xl bg-purple-500/20 p-3 text-purple-400">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">Hoa hồng</p>
                    <p className="text-slate-400">theo lead hợp lệ</p>
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
              <h3 className="text-xl font-semibold text-slate-900">Nhận thông tin tuyển dụng</h3>
              <p className="mt-3 text-slate-600">
                Chọn tin tuyển dụng phù hợp với cộng đồng xung quanh bạn. Có nhiều vị trí để lựa chọn.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-orange text-white font-bold text-xl">
                2
              </div>
              <h3 className="text-xl font-semibold text-slate-900">Giới thiệu ứng viên</h3>
              <p className="mt-3 text-slate-600">
                Tìm người phù hợp trong khu xung quanh, gửi thông tin qua hệ thống đơn giản.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-orange text-white font-bold text-xl">
                3
              </div>
              <h3 className="text-xl font-semibold text-slate-900">Nhận hoa hồng</h3>
              <p className="mt-3 text-slate-600">
                Khi ứng viên được nhận việc, bạn nhận ngay hoa hồng theo mức chiến dịch.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <h2 className="text-center text-3xl font-bold text-slate-900">Quyền lợi CTV</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-white p-6 shadow-sm text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-green-600">
                <TrendingUp className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-slate-900">Hoa hồng cao</h3>
              <p className="mt-2 text-sm text-slate-600">Thanh toán sau khi đối soát</p>
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-sm text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                <Star className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-slate-900">Không giới hạn</h3>
              <p className="mt-2 text-sm text-slate-600">Giới thiệu bao nhiêu tùy ý</p>
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-sm text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
                <Shield className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-slate-900">An toàn</h3>
              <p className="mt-2 text-sm text-slate-600">Thông tin ứng viên bảo mật</p>
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-sm text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-slate-900">Hỗ trợ 24/7</h3>
              <p className="mt-2 text-sm text-slate-600">Đội ngũ luôn sẵn sàng</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="flex items-center justify-center gap-2 text-slate-500">
            <Shield className="h-5 w-5" />
            <span>Hệ thống chống gian lận, thanh toán minh bạch</span>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand-orange py-16">
        <div className="mx-auto max-w-7xl px-4 text-center md:px-6">
          <h2 className="text-3xl font-bold text-white">Sẵn sàng kiếm thêm thu nhập?</h2>
          <p className="mt-4 text-white/90">
            Đăng ký miễn phí, bắt đầu giới thiệu ứng viên ngay hôm nay.
          </p>
          <Link
            to="/tai-khoan?tab=ctv"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 font-bold text-brand-orange hover:bg-slate-100"
          >
            Đăng ký làm CTV <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
