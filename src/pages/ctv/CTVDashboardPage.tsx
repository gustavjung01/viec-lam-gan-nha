import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { AlertCircle, Award, DollarSign, Eye, Loader2, Send, Trash2, TrendingUp, Users } from 'lucide-react';
import { formatCurrency } from '../../mocks/campaignData';
import { CampaignDetailModal } from '../../components/ctv/CampaignDetailModal';

const API_URL = '/api';
const DROPPED_CAMPAIGNS_STORAGE_KEY = 'vieclamgannha_ctv_dropped_campaign_ids';

interface Campaign {
  id: string;
  campaign_code: string;
  title: string;
  company_name: string;
  province: string;
  district: string;
  salary_text: string;
  shift_text?: string;
  ctv_reward_amount: number;
  bounty_amount: number;
  status: string;
  requirements: string;
  my_leads?: number;
  end_date?: string;
  qualification_days?: number;
  description?: string;
  job_type?: string;
  location?: string;
  quantity_needed?: number;
}

interface Lead {
  id: string;
  lead_code: string;
  campaign_id: string;
  campaign_title: string;
  status: string;
  candidate_name: string;
  candidate_phone: string;
  submitted_at: string;
  ctv_reward_amount: number;
}

interface Payout {
  id: string;
  lead_id: string;
  payout_amount: number;
  status: string;
  lead_code: string;
  campaign_title: string;
  created_at: string;
}

function readDroppedCampaignIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DROPPED_CAMPAIGNS_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    new: 'Mới',
    submitted: 'Đã gửi',
    approved: 'Đã duyệt',
    claimed: 'Công ty đã nhận',
    interviewing: 'Đang phỏng vấn',
    hired: 'Đã đi làm',
    qualified: 'Đủ điều kiện',
    rejected: 'Từ chối',
    disputed: 'Tranh chấp',
    paid: 'Đã thanh toán',
    pending: 'Chờ xử lý',
    processing: 'Đang xử lý',
    failed: 'Lỗi',
  };
  return labels[status] || status;
}

function getStatusClass(status: string) {
  if (['approved', 'claimed', 'interviewing', 'hired'].includes(status)) return 'bg-blue-50 text-blue-700 ring-blue-200';
  if (['qualified', 'paid'].includes(status)) return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'rejected' || status === 'failed') return 'bg-red-50 text-red-700 ring-red-200';
  if (status === 'disputed') return 'bg-orange-50 text-orange-700 ring-orange-200';
  return 'bg-slate-50 text-slate-700 ring-slate-200';
}

export function CTVDashboardPage() {
  const { getToken } = useAuth();
  const [ctvId, setCtvId] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ctvApproved, setCtvApproved] = useState(false);
  const [ctvStatus, setCtvStatus] = useState<string | null>(null);
  const [droppedCampaignIds, setDroppedCampaignIds] = useState<string[]>(() => readDroppedCampaignIds());
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [campaignDetailOpen, setCampaignDetailOpen] = useState(false);

  const [formData, setFormData] = useState({
    campaign_id: '',
    candidate_name: '',
    candidate_phone: '',
    zalo_phone: '',
    birth_year: '',
    province: 'TP.HCM',
    district: '',
    desired_job: '',
    desired_shift: '',
    note: '',
    has_id_card: false,
    has_curriculum_vitae: false,
  });

  const fetchData = async (targetCtvId = ctvId, skipLoading = false) => {
    try {
      if (!skipLoading) setLoading(true);
      setError(null);

      if (!targetCtvId) {
        setError('Không xác định được mã CTV. Vui lòng đăng nhập lại hoặc kiểm tra trạng thái đăng ký CTV.');
        return;
      }

      const encodedCtvId = encodeURIComponent(targetCtvId);
      const [campaignsRes, leadsRes, payoutsRes] = await Promise.all([
        fetch(`${API_URL}/ctv/campaigns?ctv_id=${encodedCtvId}`),
        fetch(`${API_URL}/ctv/leads?ctv_id=${encodedCtvId}`),
        fetch(`${API_URL}/ctv/payouts?ctv_id=${encodedCtvId}`),
      ]);

      if (campaignsRes.ok) {
        const campaignsData = await campaignsRes.json();
        if (campaignsData.success) setCampaigns(campaignsData.data || []);
      }

      if (leadsRes.ok) {
        const leadsData = await leadsRes.json();
        if (leadsData.success) setLeads(leadsData.data || []);
      }

      if (payoutsRes.ok) {
        const payoutsData = await payoutsRes.json();
        if (payoutsData.success) setPayouts(payoutsData.data || []);
      }
    } catch (err) {
      console.error('API Error:', err);
      setError('Không thể kết nối đến server. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const checkAndFetch = async () => {
      try {
        setLoading(true);
        const token = await getToken();
        const res = await fetch(`${API_URL}/account/me`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        if (!mounted) return;

        if (res.ok) {
          const data = await res.json();
          const ctv = data?.data?.ctv;
          if (data.success && ctv?.id) {
            const currentCtvId = String(ctv.id);
            const status = String(ctv.status || '');
            setCtvId(currentCtvId);
            setCtvStatus(status);

            if (status === 'approved' || status === 'active') {
              setCtvApproved(true);
              await fetchData(currentCtvId, true);
              return;
            }
          }
        }

        setCtvApproved(false);
      } catch (err) {
        console.error('CTV account check failed:', err);
        setCtvApproved(false);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    checkAndFetch();
    return () => {
      mounted = false;
    };
  }, [getToken]);

  const visibleCampaigns = campaigns.filter((campaign) => !droppedCampaignIds.includes(campaign.id));
  const totalLeads = leads.length;
  const approvedLeads = leads.filter((lead) => ['approved', 'claimed', 'interviewing', 'hired', 'qualified', 'paid'].includes(lead.status)).length;
  const totalCommission = payouts.reduce((sum, payout) => sum + Number(payout.payout_amount || 0), 0);
  const pendingCommission = payouts.filter((payout) => payout.status === 'pending').reduce((sum, payout) => sum + Number(payout.payout_amount || 0), 0);

  const handleOpenCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setCampaignDetailOpen(true);
  };

  const handleSelectCampaignFromModal = () => {
    if (!selectedCampaign) return;
    setFormData((prev) => ({ ...prev, campaign_id: selectedCampaign.id }));
    setCampaignDetailOpen(false);
  };

  const handleDropCampaign = (campaignId: string) => {
    const nextIds = Array.from(new Set([...droppedCampaignIds, campaignId]));
    setDroppedCampaignIds(nextIds);
    localStorage.setItem(DROPPED_CAMPAIGNS_STORAGE_KEY, JSON.stringify(nextIds));

    if (formData.campaign_id === campaignId) {
      setFormData((prev) => ({ ...prev, campaign_id: '' }));
    }

    if (selectedCampaign?.id === campaignId) {
      setCampaignDetailOpen(false);
      setSelectedCampaign(null);
    }
  };

  const handleSubmitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!ctvId) {
      setSubmitError('Không xác định được mã CTV. Vui lòng đăng nhập lại.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`${API_URL}/ctv/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ctv_id: ctvId,
          ...formData,
          source_type: 'ctv',
          owner_type: 'ctv',
          assignment_method: 'manual_ctv',
          birth_year: formData.birth_year ? parseInt(formData.birth_year, 10) : null,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSubmitSuccess(`Gửi lead thành công! Mã lead: ${data.data.lead_code}`);
        setFormData({
          campaign_id: '',
          candidate_name: '',
          candidate_phone: '',
          zalo_phone: '',
          birth_year: '',
          province: 'TP.HCM',
          district: '',
          desired_job: '',
          desired_shift: '',
          note: '',
          has_id_card: false,
          has_curriculum_vitae: false,
        });
        fetchData(ctvId);
      } else if (res.status === 409) {
        setSubmitError(
          `⚠️ ${data.message || 'Số điện thoại đã tồn tại'}\n` +
          `Lead: ${data.existing_lead_code || 'N/A'}\n` +
          `Trạng thái: ${data.existing_status || 'N/A'}\n` +
          `${data.hint || ''}`
        );
      } else {
        setSubmitError(data.message || data.error || 'Gửi lead thất bại');
      }
    } catch (err) {
      console.error('Submit lead failed:', err);
      setSubmitError('Lỗi kết nối server. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Đang tải dữ liệu...</span>
        </div>
      </div>
    );
  }

  if (!ctvApproved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md rounded-2xl border border-yellow-200 bg-yellow-50 p-6 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-yellow-500" />
          <h2 className="mb-2 text-lg font-semibold text-yellow-900">Hồ sơ chưa được duyệt</h2>
          <p className="mb-4 text-yellow-700">
            {ctvStatus === 'pending'
              ? 'Hồ sơ CTV của bạn đang chờ admin duyệt.'
              : ctvStatus === 'rejected'
                ? 'Hồ sơ CTV bị từ chối. Vui lòng liên hệ admin hoặc đăng ký lại.'
                : 'Bạn chưa đăng ký làm CTV tuyển dụng.'}
          </p>
          <Link to="/tai-khoan?tab=ctv" className="inline-block rounded-xl bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700">
            Xem trạng thái đăng ký
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md rounded-2xl bg-red-50 p-6 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h2 className="mb-2 text-lg font-semibold text-red-900">Lỗi kết nối</h2>
          <p className="mb-4 text-red-700">{error}</p>
          <button onClick={() => fetchData()} className="rounded-xl bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700">
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <CampaignDetailModal
        campaign={selectedCampaign}
        isOpen={campaignDetailOpen}
        onClose={() => setCampaignDetailOpen(false)}
        onSelect={handleSelectCampaignFromModal}
      />

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Dashboard CTV</h1>
            <p className="mt-2 text-slate-600">Theo dõi chiến dịch, lead và hoa hồng của bạn</p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">CTV ID: {ctvId}</div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Tổng lead đã gửi</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{totalLeads}</p>
              </div>
              <div className="rounded-xl bg-blue-100 p-3 text-blue-600"><Users className="h-6 w-6" /></div>
            </div>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Lead được duyệt</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{approvedLeads}</p>
              </div>
              <div className="rounded-xl bg-green-100 p-3 text-green-600"><TrendingUp className="h-6 w-6" /></div>
            </div>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Hoa hồng thực nhận</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(totalCommission)}</p>
              </div>
              <div className="rounded-xl bg-purple-100 p-3 text-purple-600"><DollarSign className="h-6 w-6" /></div>
            </div>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Chờ thanh toán</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(pendingCommission)}</p>
              </div>
              <div className="rounded-xl bg-yellow-100 p-3 text-yellow-600"><Award className="h-6 w-6" /></div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Chiến dịch đang tuyển</h2>
              <button onClick={() => fetchData()} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Làm mới</button>
            </div>
            <div className="space-y-4">
              {visibleCampaigns.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Chưa có chiến dịch phù hợp hoặc bạn đã bỏ qua hết chiến dịch.</p>
              ) : visibleCampaigns.map((campaign) => (
                <div key={campaign.id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900">{campaign.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">{campaign.company_name} • {campaign.district}, {campaign.province}</p>
                      <p className="mt-1 text-sm text-slate-600">{campaign.salary_text} {campaign.shift_text ? `• ${campaign.shift_text}` : ''}</p>
                      <p className="mt-2 text-sm font-semibold text-emerald-700">Hoa hồng: {formatCurrency(Number(campaign.ctv_reward_amount || 0))}</p>
                      {typeof campaign.my_leads === 'number' && <p className="mt-1 text-xs text-slate-500">Lead của bạn: {campaign.my_leads}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => handleOpenCampaign(campaign)} className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">
                        <Eye className="h-4 w-4" /> Xem lại chiến dịch
                      </button>
                      <button type="button" onClick={() => handleDropCampaign(campaign.id)} className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100">
                        <Trash2 className="h-4 w-4" /> Bỏ chiến dịch
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Gửi lead mới</h2>
            <form onSubmit={handleSubmitLead} className="mt-4 space-y-3">
              <select required value={formData.campaign_id} onChange={(e) => setFormData((prev) => ({ ...prev, campaign_id: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="">Chọn chiến dịch</option>
                {visibleCampaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.title}</option>)}
              </select>
              <input required value={formData.candidate_name} onChange={(e) => setFormData((prev) => ({ ...prev, candidate_name: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Tên ứng viên" />
              <input required value={formData.candidate_phone} onChange={(e) => setFormData((prev) => ({ ...prev, candidate_phone: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Số điện thoại" />
              <input value={formData.zalo_phone} onChange={(e) => setFormData((prev) => ({ ...prev, zalo_phone: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Zalo nếu khác số điện thoại" />
              <div className="grid gap-3 sm:grid-cols-2">
                <input value={formData.birth_year} onChange={(e) => setFormData((prev) => ({ ...prev, birth_year: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Năm sinh" />
                <input value={formData.desired_shift} onChange={(e) => setFormData((prev) => ({ ...prev, desired_shift: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Ca mong muốn" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input value={formData.province} onChange={(e) => setFormData((prev) => ({ ...prev, province: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Tỉnh/TP" />
                <input value={formData.district} onChange={(e) => setFormData((prev) => ({ ...prev, district: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Quận/Huyện" />
              </div>
              <input value={formData.desired_job} onChange={(e) => setFormData((prev) => ({ ...prev, desired_job: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Việc mong muốn" />
              <textarea value={formData.note} onChange={(e) => setFormData((prev) => ({ ...prev, note: e.target.value }))} className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Ghi chú thêm" />
              <div className="grid gap-2 text-sm text-slate-600">
                <label className="flex items-center gap-2"><input type="checkbox" checked={formData.has_id_card} onChange={(e) => setFormData((prev) => ({ ...prev, has_id_card: e.target.checked }))} /> Có CCCD</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={formData.has_curriculum_vitae} onChange={(e) => setFormData((prev) => ({ ...prev, has_curriculum_vitae: e.target.checked }))} /> Có hồ sơ xin việc</label>
              </div>
              {submitError && <pre className="whitespace-pre-wrap rounded-xl bg-red-50 p-3 text-sm text-red-700">{submitError}</pre>}
              {submitSuccess && <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{submitSuccess}</div>}
              <button disabled={submitting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-60">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Gửi lead
              </button>
            </form>
          </section>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Lead đã gửi</h2>
            <div className="mt-4 space-y-3">
              {leads.length === 0 ? <p className="text-sm text-slate-500">Chưa có lead.</p> : leads.map((lead) => (
                <div key={lead.id} className="rounded-xl border border-slate-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{lead.candidate_name || 'Ứng viên'}</p>
                      <p className="text-sm text-slate-500">{lead.lead_code} • {lead.campaign_title}</p>
                      <p className="text-xs text-slate-400">{lead.submitted_at ? new Date(lead.submitted_at).toLocaleString('vi-VN') : ''}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ${getStatusClass(lead.status)}`}>{getStatusLabel(lead.status)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Hoa hồng</h2>
            <div className="mt-4 space-y-3">
              {payouts.length === 0 ? <p className="text-sm text-slate-500">Chưa có hoa hồng.</p> : payouts.map((payout) => (
                <div key={payout.id} className="rounded-xl border border-slate-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{formatCurrency(Number(payout.payout_amount || 0))}</p>
                      <p className="text-sm text-slate-500">{payout.lead_code} • {payout.campaign_title}</p>
                      <p className="text-xs text-slate-400">{payout.created_at ? new Date(payout.created_at).toLocaleString('vi-VN') : ''}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ${getStatusClass(payout.status)}`}>{getStatusLabel(payout.status)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
