import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { AlertCircle, CheckCircle, Loader2, User, Phone, Mail, MapPin, Building2 } from 'lucide-react';

const API_URL = '/api';

export function CTVRegistrationPage() {
  const { getToken, userId } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    zalo_phone: '',
    province: '',
    district: '',
    bank_account: '',
    bank_name: '',
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [ctvStatus, setCtvStatus] = useState<string>('');

  // Kiểm tra đã đăng ký CTV chưa
  useEffect(() => {
    if (!userId) return;

    const checkCTVStatus = async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${API_URL}/ctv/by-clerk/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success && data.data) {
          setAlreadyRegistered(true);
          setCtvStatus(data.data.status);
        }
      } catch (err) {
        // Không tìm thấy = chưa đăng ký, không làm gì
      }
    };

    checkCTVStatus();
  }, [userId, getToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/ctv/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          clerk_user_id: userId,
        }),
      });

      const data = await res.json();
      
      if (res.ok && data.success) {
        setSuccess(true);
        setTimeout(() => navigate('/ctv/dashboard'), 2000);
      } else {
        setError(data.message || 'Đăng ký thất bại');
      }
    } catch (err) {
      setError('Lỗi kết nối server');
    } finally {
      setLoading(false);
    }
  };

  // Đã đăng ký CTV rồi
  if (alreadyRegistered) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-sm text-center">
          <CheckCircle className={`mx-auto h-16 w-16 mb-4 ${ctvStatus === 'active' ? 'text-green-500' : ctvStatus === 'pending' ? 'text-amber-500' : 'text-blue-500'}`} />
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            {ctvStatus === 'active' ? 'Bạn đã là CTV!' :
             ctvStatus === 'pending' ? 'Hồ sơ đang chờ duyệt' :
             'Bạn đã đăng ký CTV'}
          </h2>
          <p className="text-slate-600 mb-6">
            {ctvStatus === 'active' ? 'Tài khoản CTV của bạn đang hoạt động. Vào Dashboard để bắt đầu giới thiệu ứng viên.' :
             ctvStatus === 'pending' ? 'Hồ sơ của bạn đang chờ admin duyệt. Vui lòng kiểm tra sau 24h.' :
             'Bạn đã có hồ sơ CTV trong hệ thống.'}
          </p>
          <button
            onClick={() => navigate('/ctv/dashboard')}
            className="rounded-xl bg-brand-blue px-6 py-3 font-bold text-white hover:bg-blue-700 w-full"
          >
            Vào Dashboard CTV
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-sm text-center">
          <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Đăng ký thành công!</h2>
          <p className="text-slate-600">Hồ sơ của bạn đang chờ admin duyệt. Bạn sẽ được chuyển hướng...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Đăng ký Cộng tác viên (CTV)</h1>
          <p className="text-slate-600 mb-6">Điền thông tin để trở thành CTV và nhận hoa hồng từ việc giới thiệu ứng viên</p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 rounded-xl flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
              <span className="text-red-700">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <User className="inline h-4 w-4 mr-1" />
                  Họ và tên *
                </label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-xl border-slate-200 px-4 py-2.5 focus:border-brand-orange focus:ring-brand-orange"
                  placeholder="Nguyễn Văn A"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <Phone className="inline h-4 w-4 mr-1" />
                  Số điện thoại *
                </label>
                <input
                  required
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                  className="w-full rounded-xl border-slate-200 px-4 py-2.5 focus:border-brand-orange focus:ring-brand-orange"
                  placeholder="0901234567"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <Mail className="inline h-4 w-4 mr-1" />
                  Email *
                </label>
                <input
                  required
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                  className="w-full rounded-xl border-slate-200 px-4 py-2.5 focus:border-brand-orange focus:ring-brand-orange"
                  placeholder="ctv@example.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <Phone className="inline h-4 w-4 mr-1" />
                  Zalo (nếu khác SĐT)
                </label>
                <input
                  type="tel"
                  value={formData.zalo_phone}
                  onChange={e => setFormData(p => ({ ...p, zalo_phone: e.target.value }))}
                  className="w-full rounded-xl border-slate-200 px-4 py-2.5 focus:border-brand-orange focus:ring-brand-orange"
                  placeholder="0901234567"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <MapPin className="inline h-4 w-4 mr-1" />
                  Tỉnh/Thành phố *
                </label>
                <input
                  required
                  type="text"
                  value={formData.province}
                  onChange={e => setFormData(p => ({ ...p, province: e.target.value }))}
                  className="w-full rounded-xl border-slate-200 px-4 py-2.5 focus:border-brand-orange focus:ring-brand-orange"
                  placeholder="TP. Hồ Chí Minh"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <MapPin className="inline h-4 w-4 mr-1" />
                  Quận/Huyện *
                </label>
                <input
                  required
                  type="text"
                  value={formData.district}
                  onChange={e => setFormData(p => ({ ...p, district: e.target.value }))}
                  className="w-full rounded-xl border-slate-200 px-4 py-2.5 focus:border-brand-orange focus:ring-brand-orange"
                  placeholder="Quận 1"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Thông tin thanh toán
              </h3>
              
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Số tài khoản ngân hàng *
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.bank_account}
                    onChange={e => setFormData(p => ({ ...p, bank_account: e.target.value }))}
                    className="w-full rounded-xl border-slate-200 px-4 py-2.5 focus:border-brand-orange focus:ring-brand-orange"
                    placeholder="123456789"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Tên ngân hàng *
                  </label>
                  <select
                    required
                    value={formData.bank_name}
                    onChange={e => setFormData(p => ({ ...p, bank_name: e.target.value }))}
                    className="w-full rounded-xl border-slate-200 px-4 py-2.5 focus:border-brand-orange focus:ring-brand-orange bg-white"
                  >
                    <option value="">-- Chọn ngân hàng --</option>
                    <option value="Vietcombank">Vietcombank (VCB)</option>
                    <option value="VietinBank">VietinBank (CTG)</option>
                    <option value="BIDV">BIDV</option>
                    <option value="Agribank">Agribank</option>
                    <option value="Sacombank">Sacombank (STB)</option>
                    <option value="Techcombank">Techcombank (TCB)</option>
                    <option value="MB Bank">MB Bank (MB)</option>
                    <option value="ACB">ACB - Asia Commercial Bank</option>
                    <option value="VPBank">VPBank</option>
                    <option value="TPBank">TPBank</option>
                    <option value="VIB">VIB - Vietnam International Bank</option>
                    <option value="SHB">SHB - Saigon Hanoi Bank</option>
                    <option value="SeABank">SeABank</option>
                    <option value="MSB">MSB - Maritime Bank</option>
                    <option value="OCB">OCB - Orient Commercial Bank</option>
                    <option value="Eximbank">Eximbank (EIB)</option>
                    <option value="HDBank">HDBank</option>
                    <option value="LienVietPostBank">LienVietPostBank (LPB)</option>
                    <option value="PVcomBank">PVcomBank</option>
                    <option value="SCB">SCB - Saigon Commercial Bank</option>
                    <option value="ABBank">ABBank - An Binh Bank</option>
                    <option value="Bac A Bank">Bac A Bank</option>
                    <option value="Dong A Bank">Dong A Bank</option>
                    <option value="Nam A Bank">Nam A Bank</option>
                    <option value="Saigonbank">Saigonbank</option>
                    <option value="Viet Bank">Viet Bank</option>
                    <option value="Kienlongbank">Kienlongbank</option>
                    <option value="PG Bank">PG Bank - Petrolimex Bank</option>
                    <option value="OceanBank">OceanBank</option>
                    <option value="GPBank">GPBank</option>
                    <option value="NCB">NCB - National Citizen Bank</option>
                    <option value="VRB">VRB - Vietnam Russia Bank</option>
                    <option value="IVB">IVB - Indovina Bank</option>
                    <option value="HSBC">HSBC Vietnam</option>
                    <option value="Standard Chartered">Standard Chartered Vietnam</option>
                    <option value="Citibank">Citibank Vietnam</option>
                    <option value="UOB">UOB Vietnam</option>
                    <option value="ANZ">ANZ Vietnam</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-brand-orange py-3 font-semibold text-white hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-5 w-5 animate-spin" />}
              {loading ? 'Đang đăng ký...' : 'Đăng ký CTV'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
