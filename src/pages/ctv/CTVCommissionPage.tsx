import { useState, useEffect } from 'react';
import { 
  DollarSign, Clock, CheckCircle, AlertCircle, Wallet, 
  ArrowRight, TrendingUp, Calendar, Shield 
} from 'lucide-react';

const API_URL = '/api';
const CTV_ID = 'ctv-001'; // Demo ID - replace with actual auth

interface Commission {
  id: string;
  lead_id: string;
  lead_code: string;
  campaign_title: string;
  company_name: string;
  amount: number;
  status: 'held' | 'available' | 'payout_pending' | 'paid' | 'cancelled';
  hold_until: string;
  released_at: string | null;
  paid_at: string | null;
  total_bounty: number;
  ctv_percentage: number;
}

interface CommissionSummary {
  held: number;
  available: number;
  pending_payout: number;
  paid: number;
  total_earned: number;
}

export function CTVCommissionPage() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [summary, setSummary] = useState<CommissionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);

  useEffect(() => {
    fetchCommissions();
  }, []);

  const fetchCommissions = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/ctv/commissions?ctv_id=${CTV_ID}`);
      const data = await res.json();
      
      if (data.success) {
        setCommissions(data.data);
        setSummary(data.summary);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Không thể tải dữ liệu hoa hồng');
    } finally {
      setLoading(false);
    }
  };

  const handlePayoutRequest = async () => {
    const amount = parseInt(payoutAmount.replace(/\D/g, ''));
    if (!amount || amount < 100000) {
      setError('Số tiền tối thiểu là 100,000 VNĐ');
      return;
    }

    if (summary && amount > summary.available) {
      setError(`Số dư khả dụng không đủ. Hiện có: ${summary.available.toLocaleString('vi-VN')} VNĐ`);
      return;
    }

    setRequesting(true);
    try {
      const res = await fetch(`${API_URL}/ctv/payout-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ctv_id: CTV_ID, amount })
      });
      
      const data = await res.json();
      if (data.success) {
        setRequestSuccess(true);
        setPayoutAmount('');
        fetchCommissions();
        setTimeout(() => setRequestSuccess(false), 3000);
      } else {
        setError(data.message || 'Yêu cầu thất bại');
      }
    } catch (err) {
      setError('Lỗi kết nối server');
    } finally {
      setRequesting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  const getStatusBadge = (status: Commission['status']) => {
    const styles: Record<Commission['status'], string> = {
      held: 'bg-amber-100 text-amber-800 border-amber-200',
      available: 'bg-green-100 text-green-800 border-green-200',
      payout_pending: 'bg-blue-100 text-blue-800 border-blue-200',
      paid: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200'
    };
    const labels: Record<Commission['status'], string> = {
      held: 'Chờ 14 ngày',
      available: 'Sẵn sàng',
      payout_pending: 'Đang xử lý',
      paid: 'Đã thanh toán',
      cancelled: 'Đã hủy'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-8 w-32 bg-slate-200 rounded mb-2"></div>
          <div className="text-slate-500">Đang tải...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Hoa hồng & Thu nhập</h1>
          <p className="text-slate-600 mt-1">Theo dõi thu nhập và yêu cầu thanh toán</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {requestSuccess && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
            <span className="text-green-700">Yêu cầu thanh toán đã được gửi thành công!</span>
          </div>
        )}

        {/* Summary Cards */}
        {summary && (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600">Đang chờ 14 ngày</span>
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{formatCurrency(summary.held)}</div>
              <div className="text-xs text-slate-500 mt-1">Sẽ được giải phóng sau 14 ngày</div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600">Sẵn sàng rút</span>
                <Wallet className="h-4 w-4 text-green-500" />
              </div>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(summary.available)}</div>
              <div className="text-xs text-slate-500 mt-1">Có thể yêu cầu thanh toán</div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600">Đang xử lý</span>
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(summary.pending_payout)}</div>
              <div className="text-xs text-slate-500 mt-1">Dự kiến 3 ngày làm việc</div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600">Đã thanh toán</span>
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-emerald-600">{formatCurrency(summary.paid)}</div>
              <div className="text-xs text-slate-500 mt-1">Tổng lịch sử</div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Payout Request Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 sticky top-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-brand-orange/10 rounded-xl">
                  <DollarSign className="h-5 w-5 text-brand-orange" />
                </div>
                <h2 className="font-semibold text-slate-900">Yêu cầu thanh toán</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Số tiền muốn rút (VNĐ)
                  </label>
                  <input
                    type="text"
                    value={payoutAmount}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setPayoutAmount(val ? parseInt(val).toLocaleString('vi-VN') : '');
                    }}
                    placeholder="1,000,000"
                    className="w-full rounded-xl border-slate-200 px-4 py-2.5 focus:border-brand-orange focus:ring-brand-orange"
                  />
                  <p className="text-xs text-slate-500 mt-1">Tối thiểu 100,000 VNĐ</p>
                </div>

                <button
                  onClick={handlePayoutRequest}
                  disabled={requesting || !payoutAmount || parseInt(payoutAmount.replace(/\D/g, '')) < 100000}
                  className="w-full rounded-xl bg-brand-orange py-3 font-semibold text-white hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {requesting ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      Gửi yêu cầu <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-start gap-2 text-sm text-slate-600">
                    <Shield className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <span>Thanh toán sẽ được chuyển khoản về tài khoản ngân hàng đã đăng ký trong 3 ngày làm việc</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Commission List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
              <div className="p-6 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900">Chi tiết hoa hồng</h2>
              </div>

              <div className="divide-y divide-slate-100">
                {commissions.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    Chưa có hoa hồng nào
                  </div>
                ) : (
                  commissions.map((comm) => (
                    <div key={comm.id} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-slate-900 truncate">
                              {comm.lead_code}
                            </span>
                            {getStatusBadge(comm.status)}
                          </div>
                          <div className="text-sm text-slate-600 mb-1">
                            {comm.campaign_title} • {comm.company_name}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            {comm.hold_until && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Giải phóng: {formatDate(comm.hold_until)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-bold text-slate-900">
                            +{formatCurrency(comm.amount)}
                          </div>
                          {comm.paid_at && (
                            <div className="text-xs text-emerald-600">
                              Đã thanh toán {formatDate(comm.paid_at)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
