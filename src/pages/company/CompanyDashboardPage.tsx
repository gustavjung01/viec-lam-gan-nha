import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { mockCampaigns, mockLeads, formatCurrency } from '../../mocks/campaignData';
import { TrendingUp, Users, DollarSign, Wallet, AlertCircle, Plus, Trash2, X } from 'lucide-react';
import { useAuth, useUser } from '@clerk/clerk-react';

const API_URL = '/api';


interface Campaign {
  id: string;
  campaign_code: string;
  title: string;
  status: string;
  bounty_amount: number;
  current_leads: number;
  max_leads: number;
  province: string;
  district: string;
}

interface Lead {
  id: string;
  lead_code: string;
  campaign_id: string;
  campaign_title: string;
  status: string;
  is_anonymous: number;
  claimed_by_company_id: string | null;
  submitted_at: string;
  claimed_at: string | null;
  bounty_amount: number;
  candidate_name: string | null;
  candidate_phone: string | null;
  candidate_province: string;
  candidate_district: string;
  ctv_name: string;
}

interface Shift {
  id: string;
  label: string;
  start_time: string;
  end_time: string;
  overnight: boolean;
  quantity_needed: number;
}

interface CreateFormData {
  title: string;
  description: string;
  job_type: string;
  province: string;
  district: string;
  address: string;
  quantity_needed: number;
  qualification_days: number;
  salary_type: 'fixed' | 'range';
  salary_fixed: number;
  salary_min: number;
  salary_max: number;
  salary_unit: 'month' | 'day' | 'shift' | 'hour';
  shifts: Shift[];
  bounty_amount: number;
  is_public: boolean;
  ctv_enabled: boolean;
}

export function CompanyDashboardPage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<'all' | 'anonymous' | 'claimed'>('all');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [wallet, setWallet] = useState({ balance: 0, credit_limit: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [companyApproved, setCompanyApproved] = useState(false);
  const [companyStatus, setCompanyStatus] = useState<string | null>(null);
    const [companyId, setCompanyId] = useState<string | null>(null);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);

    const [formData, setFormData] = useState<CreateFormData>({
    title: '',
    description: '',
    job_type: 'Bảo vệ',
    province: 'TP.HCM',
    district: '',
    address: '',
    quantity_needed: 1,
    qualification_days: 7,
    salary_type: 'fixed',
    salary_fixed: 7500000,
    salary_min: 7000000,
    salary_max: 8500000,
    salary_unit: 'month',
    shifts: [{ id: '1', label: 'Ca ngày', start_time: '07:00', end_time: '19:00', overnight: false, quantity_needed: 1 }],
    bounty_amount: 600000,
    is_public: true,
    ctv_enabled: true,
  });

  const [companyQuota, setCompanyQuota] = useState({
    used_job_posts: 0,
    job_posts_limit: 5,
    used_push_count: 0,
    push_limit: 5
  });

  // Helper functions
  const formatSalaryText = (): string => {
    const unitMap: Record<string, string> = { month: '/tháng', day: '/ngày', shift: '/ca', hour: '/giờ' };
    const unit = unitMap[formData.salary_unit];
    if (formData.salary_type === 'fixed') {
      return `${formData.salary_fixed.toLocaleString('vi-VN')}đ${unit}`;
    }
    return `${formData.salary_min.toLocaleString('vi-VN')}đ - ${formData.salary_max.toLocaleString('vi-VN')}đ${unit}`;
  };

  const formatShiftText = (): string => {
    if (formData.shifts.length === 0) return '';
    if (formData.shifts.length === 1) {
      const s = formData.shifts[0];
      return `Ca: ${s.start_time}-${s.end_time}`;
    }
    return `${formData.shifts.length} ca làm`;
  };

  const addShift = () => {
    const newShift: Shift = {
      id: Date.now().toString(),
      label: `Ca ${formData.shifts.length + 1}`,
      start_time: '07:00',
      end_time: '19:00',
      overnight: false,
      quantity_needed: 1,
    };
    setFormData(prev => ({ ...prev, shifts: [...prev.shifts, newShift] }));
  };

  const removeShift = (id: string) => {
    if (formData.shifts.length > 1) {
      setFormData(prev => ({ ...prev, shifts: prev.shifts.filter(s => s.id !== id) }));
    }
  };

  const updateShift = (id: string, field: keyof Shift, value: any) => {
    setFormData(prev => ({
      ...prev,
      shifts: prev.shifts.map(s => s.id === id ? { ...s, [field]: value } : s)
    }));
  };

    const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const token = await getToken();

        const payload = {
      company_id: (companyId || ''),
      title: formData.title,
      description: formData.description,
      job_type: formData.job_type,
      province: formData.province,
      district: formData.district,
      location: formData.address ? `${formData.district}, ${formData.province} - ${formData.address}` : `${formData.district}, ${formData.province}`,
      salary_text: formatSalaryText(),
      shift_text: formatShiftText(),
      quantity_needed: formData.quantity_needed,
      bounty_amount: formData.bounty_amount,
      qualification_days: formData.qualification_days,
      is_public: formData.is_public,
      ctv_enabled: formData.ctv_enabled,
      status: editingCampaignId ? undefined : 'pending',
    };

    try {
      const url = editingCampaignId 
        ? `${API_URL}/company/campaigns/${editingCampaignId}` 
        : `${API_URL}/company/campaigns`;
      
      const response = await fetch(url, {
        method: editingCampaignId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setShowCreateForm(false);
        setEditingCampaignId(null);
        window.location.reload();
      } else {
        const errData = await response.json();
        alert(errData.message || 'Thao tác thất bại');
      }
    } catch (err) {
      alert('Lỗi kết nối');
    } finally {
      setSubmitting(false);
    }
  };

  // Fetch data from API
  useEffect(() => {
    const checkAndFetch = async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${API_URL}/account/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
                    if (data.success && data.data.company) {
            const status = data.data.company.status;
            const cId = data.data.company.id;
            setCompanyStatus(status);
            setCompanyId(cId);
            setCompanyQuota({
              used_job_posts: data.data.company.used_job_posts_count || 0,
              job_posts_limit: data.data.company.free_job_posts_limit || 5,
              used_push_count: data.data.company.used_push_count || 0,
              push_limit: data.data.company.weekly_push_limit || 5
            });
            if (status === 'approved' || status === 'active') {
              setCompanyApproved(true);
            } else {
              setCompanyApproved(false);
            }
            await fetchData(cId, true);
          } else {
            setCompanyApproved(false);
            await fetchData(null, true);
          }
        }
      } catch {}
      setLoading(false);
    };

    const fetchData = async (cId: string | null, skipLoading = false) => {
      try {
        if (!skipLoading) setLoading(true);
        setError(null);

        if (!cId) {
           setLoading(false);
           return;
        }

        // Fetch campaigns
        const campaignsRes = await fetch(`${API_URL}/company/campaigns?company_id=${cId}`);
        if (campaignsRes.ok) {
          const campaignsData = await campaignsRes.json();
          if (campaignsData.success) {
            setCampaigns(campaignsData.data);
          }
        }

        // Fetch leads
        const leadsRes = await fetch(`${API_URL}/company/leads?company_id=${cId}`);
        if (leadsRes.ok) {
          const leadsData = await leadsRes.json();
          if (leadsData.success) {
            setLeads(leadsData.data);
          }
        }

        setLoading(false);
      } catch (err) {
        console.error('API Error:', err);
        setError('Không thể kết nối đến server. Vui lòng kiểm tra backend đã chạy chưa.');
        setLoading(false);
      }
    };

    checkAndFetch();
  }, []);

  // Calculate stats
  const totalCampaigns = campaigns.length;
  const runningCampaigns = campaigns.filter(c => c.status === 'active').length;
  const totalLeadsReceived = leads.filter(l => l.claimed_by_company_id === (companyId || '')).length;
  const anonymousLeads = leads.filter(l => l.is_anonymous && l.status === 'approved').length;
  const totalSpent = leads
    .filter(l => l.claimed_by_company_id === (companyId || ''))
    .reduce((sum, l) => sum + l.bounty_amount, 0);

  const handleClaimLead = async (leadId: string) => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/company/leads/${leadId}/claim`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ company_id: (companyId || '') })
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Đã nhận lead! Trừ ${formatCurrency(data.data.bounty_paid)} từ ví`);
        // Refresh data
        window.location.reload();
      } else {
        const error = await res.json();
        alert(error.error || 'Không thể nhận lead');
      }
    } catch (err) {
      alert('Lỗi kết nối server');
    }
  };

  const handlePushCampaign = async (campaignId: string) => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/company/campaigns/${campaignId}/push`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ company_id: (companyId || '') })
      });

      if (res.ok) {
        alert('Đã đẩy tin lên đầu trang!');
        window.location.reload();
      } else {
        const error = await res.json();
        alert(error.message || 'Không thể đẩy tin');
      }
        } catch (err) {
      alert('Lỗi kết nối server');
    }
  };

  const handleEditClick = (campaign: any) => {
    setEditingCampaignId(campaign.id);
    // Parse location if it has the " - " separator
    const locParts = (campaign.location || '').split(' - ');
    const city = locParts[0] || '';
    const addr = locParts[1] || '';

        setFormData({
      title: campaign.title || '',
      description: campaign.description || '',
      job_type: campaign.job_type || 'Bảo vệ',
      province: campaign.province || 'TP.HCM',
      district: campaign.district || '',
      address: addr,
      quantity_needed: campaign.quantity_needed || 1,
      qualification_days: campaign.qualification_days || 7,
      salary_type: 'fixed', 
      salary_fixed: campaign.bounty_amount || 0,
      salary_min: 0,
      salary_max: 0,
      salary_unit: 'month',
      shifts: [], // Simplified for now as it's complex to parse back
      bounty_amount: campaign.bounty_amount || 0,
      is_public: campaign.is_public === 1,
      ctv_enabled: campaign.ctv_enabled === 1,
    });
    setShowCreateForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa chiến dịch này?')) return;
    const token = await getToken();
    try {
      const res = await fetch(`${API_URL}/company/campaigns/${id}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const err = await res.json();
        alert(err.message || 'Không thể xóa');
      }
    } catch (err) {
      alert('Lỗi kết nối server');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <h1 className="text-3xl font-bold text-slate-900">Dashboard Công ty</h1>
        <p className="mt-2 text-slate-600">Quản lý chiến dịch tuyển dụng và lead</p>

        {/* Wallet Card */}
        <div className="mt-6 rounded-2xl bg-brand-navy p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-white/10 p-3">
                <Wallet className="h-8 w-8" />
              </div>
              <div>
                <p className="text-sm text-slate-300">Số dư ví</p>
                <p className="text-3xl font-bold">{formatCurrency(wallet.balance)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-300">Hạn mức tín dụng</p>
              <p className="text-xl font-semibold">{formatCurrency(wallet.credit_limit)}</p>
            </div>
          </div>
                    <div className="mt-4 flex gap-6 text-sm">
            <span className="text-slate-300">Tổng chi: {formatCurrency(totalSpent)}</span>
            <span className="text-slate-300">Tin đã đăng: <strong>{companyQuota.used_job_posts}/{companyQuota.job_posts_limit}</strong></span>
            <span className="text-slate-300">Lượt đẩy tuần này: <strong>{companyQuota.used_push_count}/{companyQuota.push_limit}</strong></span>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Tổng chiến dịch</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{totalCampaigns}</p>
              </div>
              <div className="rounded-xl bg-blue-100 p-3 text-blue-600">
                <TrendingUp className="h-6 w-6" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Đang chạy</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{runningCampaigns}</p>
              </div>
              <div className="rounded-xl bg-green-100 p-3 text-green-600">
                <TrendingUp className="h-6 w-6" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Lead đã nhận</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{totalLeadsReceived}</p>
              </div>
              <div className="rounded-xl bg-purple-100 p-3 text-purple-600">
                <Users className="h-6 w-6" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Tổng chi phí</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(totalSpent)}</p>
              </div>
              <div className="rounded-xl bg-orange-100 p-3 text-orange-600">
                <DollarSign className="h-6 w-6" />
              </div>
            </div>
          </div>
        </div>

                {/* My Campaigns */}
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Chiến dịch của tôi</h2>
            <button
              onClick={() => {
                if (showCreateForm) {
                   setEditingCampaignId(null);
                }
                setShowCreateForm(!showCreateForm);
              }}
              className="flex items-center gap-2 rounded-xl bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            >
              {showCreateForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showCreateForm ? 'Đóng form' : 'Tạo chiến dịch mới'}
            </button>
          </div>

          {/* Create Campaign Form */}
          {showCreateForm && (
            <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="mb-4 font-semibold text-slate-900">
                {editingCampaignId ? 'Sửa chiến dịch' : 'Tạo chiến dịch mới'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Basic Info */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-slate-700">Tiêu đề</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                      className="w-full rounded-lg border px-3 py-2"
                      placeholder="VD: Bảo vệ siêu thị Quận 1"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-slate-700">Mô tả công việc</label>
                    <textarea
                      value={formData.description}
                      onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                      className="w-full rounded-lg border px-3 py-2"
                      placeholder="Mô tả chi tiết công việc, yêu cầu..."
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Loại công việc</label>
                    <select
                      value={formData.job_type}
                      onChange={e => setFormData(p => ({ ...p, job_type: e.target.value }))}
                      className="w-full rounded-lg border px-3 py-2"
                    >
                      <option>Bảo vệ</option>
                      <option>Giữ xe</option>
                      <option>Lao động phổ thông</option>
                      <option>Nhân viên vệ sinh</option>
                      <option>Tạp vụ</option>
                      <option>Kho / Xưởng</option>
                      <option>Giao hàng</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Tỉnh/Thành phố</label>
                    <select
                      value={formData.province}
                      onChange={e => setFormData(p => ({ ...p, province: e.target.value }))}
                      className="w-full rounded-lg border px-3 py-2"
                      required
                    >
                      <option value="TP.HCM">TP.HCM</option>
                      <option value="Hà Nội">Hà Nội</option>
                      <option value="Bình Dương">Bình Dương</option>
                      <option value="Đồng Nai">Đồng Nai</option>
                      <option value="Long An">Long An</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Quận/Huyện</label>
                    <select
                      value={formData.district}
                      onChange={e => setFormData(p => ({ ...p, district: e.target.value }))}
                      className="w-full rounded-lg border px-3 py-2"
                      required
                    >
                      <option value="">Chọn quận/huyện</option>
                      <option>Quận 1</option>
                      <option>Quận 2</option>
                      <option>Quận 3</option>
                      <option>Quận 4</option>
                      <option>Quận 5</option>
                      <option>Quận 6</option>
                      <option>Quận 7</option>
                      <option>Quận 8</option>
                      <option>Quận 9</option>
                      <option>Quận 10</option>
                      <option>Quận 11</option>
                      <option>Quận 12</option>
                      <option>Quận Bình Thạnh</option>
                      <option>Quận Gò Vấp</option>
                      <option>Quận Phú Nhuận</option>
                      <option>Quận Tân Bình</option>
                      <option>Quận Tân Phú</option>
                      <option>Quận Bình Tân</option>
                      <option>Quận Thủ Đức</option>
                      <option>Huyện Bình Chánh</option>
                      <option>Huyện Hóc Môn</option>
                      <option>Huyện Củ Chi</option>
                      <option>Huyện Nhà Bè</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Số lượng cần</label>
                    <input
                      type="number"
                      min={1}
                      value={formData.quantity_needed}
                      onChange={e => setFormData(p => ({ ...p, quantity_needed: parseInt(e.target.value) || 1 }))}
                      className="w-full rounded-lg border px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Ngày đủ điều kiện</label>
                    <select
                      value={formData.qualification_days}
                      onChange={e => setFormData(p => ({ ...p, qualification_days: parseInt(e.target.value) }))}
                      className="w-full rounded-lg border px-3 py-2"
                    >
                      <option value={5}>5 ngày</option>
                      <option value={7}>7 ngày</option>
                      <option value={15}>15 ngày</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Địa chỉ làm việc</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={e => setFormData(p => ({ ...p, address: e.target.value }))}
                    className="w-full rounded-lg border px-3 py-2"
                    placeholder="VD: 123 Lê Lợi, Phường Bến Nghé"
                    required
                  />
                </div>

                {/* Visibility Section */}
                <div className="rounded-lg bg-slate-50 p-4">
                  <h4 className="mb-3 font-medium text-slate-900">Hiển thị</h4>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_public}
                        onChange={e => setFormData(p => ({ ...p, is_public: e.target.checked }))}
                        className="h-4 w-4 rounded border-slate-300 text-brand-orange focus:ring-brand-orange"
                      />
                      <div className="text-sm">
                        <span className="font-medium">Ứng viên tự do</span>
                        <p className="text-xs text-slate-500">Hiện tin trên trang chủ cho mọi người</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.ctv_enabled}
                        onChange={e => setFormData(p => ({ ...p, ctv_enabled: e.target.checked }))}
                        className="h-4 w-4 rounded border-slate-300 text-brand-orange focus:ring-brand-orange"
                      />
                      <div className="text-sm">
                        <span className="font-medium">Cộng tác viên (Affiliate)</span>
                        <p className="text-xs text-slate-500">Cho phép CTV tuyển dụng & nhận hoa hồng</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Salary Section */}
                <div className="rounded-lg bg-slate-50 p-4">
                  <h4 className="mb-3 font-medium text-slate-900">Lương</h4>
                  <div className="mb-3 flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={formData.salary_type === 'fixed'}
                        onChange={() => setFormData(p => ({ ...p, salary_type: 'fixed' }))}
                      />
                      <span className="text-sm">Cố định</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={formData.salary_type === 'range'}
                        onChange={() => setFormData(p => ({ ...p, salary_type: 'range' }))}
                      />
                      <span className="text-sm">Trong khoảng</span>
                    </label>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {formData.salary_type === 'fixed' ? (
                      <div>
                        <label className="mb-1 block text-xs text-slate-600">Lương (VND)</label>
                        <input
                          type="number"
                          step={1000}
                          value={formData.salary_fixed}
                          onChange={e => setFormData(p => ({ ...p, salary_fixed: parseInt(e.target.value) || 0 }))}
                          className="w-full rounded border px-2 py-1"
                        />
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="mb-1 block text-xs text-slate-600">Tối thiểu (VND)</label>
                          <input
                            type="number"
                            step={1000}
                            value={formData.salary_min}
                            onChange={e => setFormData(p => ({ ...p, salary_min: parseInt(e.target.value) || 0 }))}
                            className="w-full rounded border px-2 py-1"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-600">Tối đa (VND)</label>
                          <input
                            type="number"
                            step={1000}
                            value={formData.salary_max}
                            onChange={e => setFormData(p => ({ ...p, salary_max: parseInt(e.target.value) || 0 }))}
                            className="w-full rounded border px-2 py-1"
                          />
                        </div>
                      </>
                    )}
                    <div>
                      <label className="mb-1 block text-xs text-slate-600">Đơn vị</label>
                      <select
                        value={formData.salary_unit}
                        onChange={e => setFormData(p => ({ ...p, salary_unit: e.target.value as any }))}
                        className="w-full rounded border px-2 py-1"
                      >
                        <option value="month">/tháng</option>
                        <option value="day">/ngày</option>
                        <option value="shift">/ca</option>
                        <option value="hour">/giờ</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-3 rounded bg-white p-2 text-sm">
                    <span className="font-medium">Preview: </span>
                    <span className="text-emerald-600 font-semibold">{formatSalaryText()}</span>
                  </div>
                </div>

                {/* Shifts Section */}
                <div className="rounded-lg bg-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="font-medium text-slate-900">Ca làm</h4>
                    <button
                      type="button"
                      onClick={addShift}
                      className="flex items-center gap-1 rounded bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700"
                    >
                      <Plus className="h-3 w-3" /> Thêm ca
                    </button>
                  </div>
                  <div className="space-y-2">
                    {formData.shifts.map((shift, idx) => (
                      <div key={shift.id} className="flex items-center gap-2 rounded bg-white p-2">
                        <input
                          type="text"
                          value={shift.label}
                          onChange={e => updateShift(shift.id, 'label', e.target.value)}
                          className="w-24 rounded border px-2 py-1 text-sm"
                          placeholder={`Ca ${idx + 1}`}
                        />
                        <input
                          type="time"
                          value={shift.start_time}
                          onChange={e => updateShift(shift.id, 'start_time', e.target.value)}
                          className="w-20 rounded border px-2 py-1 text-sm"
                        />
                        <span className="text-slate-400">-</span>
                        <input
                          type="time"
                          value={shift.end_time}
                          onChange={e => updateShift(shift.id, 'end_time', e.target.value)}
                          className="w-20 rounded border px-2 py-1 text-sm"
                        />
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={shift.overnight}
                            onChange={e => updateShift(shift.id, 'overnight', e.target.checked)}
                          />
                          Qua đêm
                        </label>
                        <button
                          type="button"
                          onClick={() => removeShift(shift.id)}
                          className="ml-auto text-red-500"
                          disabled={formData.shifts.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-slate-600">Preview: {formatShiftText()}</div>
                </div>

                {/* Reward Section */}
                <div className="rounded-lg bg-emerald-50 p-4">
                  <h4 className="mb-3 font-medium text-emerald-800">Chi phí/lead</h4>
                  <div className="mb-3">
                    <label className="mb-1 block text-sm text-slate-700">Số tiền công ty trả cho mỗi lead hợp lệ (VND)</label>
                    <input
                      type="number"
                      step={1000}
                      value={formData.bounty_amount}
                      onChange={e => setFormData(p => ({ ...p, bounty_amount: parseInt(e.target.value) || 0 }))}
                      className="w-full rounded border px-3 py-2"
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Chỉ thanh toán khi nhận lead hợp lệ.
                  </p>
                </div>

                {/* Submit */}
                {!companyApproved && (
                  <div className="mb-4 text-red-600 font-semibold text-center">
                    Hồ sơ công ty chưa sẵn sàng để đăng mục tiêu.
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 rounded-lg border py-2 font-medium hover:bg-slate-50"
                  >
                    Hủy
                  </button>
                                    <button
                    type="submit"
                    disabled={submitting || !companyApproved}
                    className="flex-1 rounded-lg bg-emerald-600 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {submitting ? 'Đang lưu...' : editingCampaignId ? 'Lưu thay đổi' : 'Tạo chiến dịch'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {campaigns.map((campaign: Campaign) => (
              <div key={campaign.id} className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      campaign.status === 'running' ? 'bg-green-100 text-green-700' :
                      campaign.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {campaign.status === 'running' ? 'Đang chạy' :
                       campaign.status === 'pending' ? 'Chờ duyệt' :
                       'Tạm dừng'}
                    </span>
                    <h3 className="mt-2 font-semibold text-slate-900">{campaign.title}</h3>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-900">{formatCurrency(campaign.bounty_amount)}</p>
                    <p className="text-xs text-slate-500">/lead</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-4 text-sm text-slate-500">
                  <span>{campaign.province} - {campaign.district}</span>
                </div>
                                <div className="mt-4 flex items-center justify-between">
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handlePushCampaign(campaign.id)}
                                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                      title="Đẩy tin lên đầu trang"
                                    >
                                      Đẩy tin
                                    </button>
                                    <button
                                      onClick={() => handleEditClick(campaign)}
                                      className="rounded-lg border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                                    >
                                      Sửa
                                    </button>
                                    <button
                                      onClick={() => handleDeleteCampaign(campaign.id)}
                                      className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                                    >
                                      Xóa
                                    </button>
                                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-slate-600">
                      <span className="font-semibold">{campaign.current_leads}</span> / {campaign.max_leads} lead
                    </div>
                    <div className="h-2 w-32 rounded-full bg-slate-100">
                      <div 
                        className="h-2 rounded-full bg-brand-orange" 
                        style={{ width: `${(campaign.current_leads / (campaign.max_leads || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Leads Section */}
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Lead</h2>
            <div className="flex gap-2">
              {(['all', 'anonymous', 'claimed'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-lg px-3 py-1 text-sm font-semibold ${
                    activeTab === tab 
                      ? 'bg-brand-orange text-white' 
                      : 'bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab === 'all' ? 'Tất cả' : tab === 'anonymous' ? 'Ẩn danh' : 'Đã nhận'}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Mã lead</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Chiến dịch</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Thông tin</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Trạng thái</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Chi phí</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads
                  .filter((lead: Lead) => {
                    if (activeTab === 'anonymous') return lead.is_anonymous && lead.status === 'approved';
                    if (activeTab === 'claimed') return lead.claimed_by_company_id === (user?.id || '');
                    return true;
                  })
                  .map((lead: Lead) => (
                  <tr key={lead.id}>
                    <td className="px-4 py-3 text-sm text-slate-900">{lead.lead_code}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {lead.campaign_title}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {lead.is_anonymous && lead.status !== 'claimed' ? (
                        <div className="text-slate-500">
                          <p>Khu vực: {lead.candidate_province} - {lead.candidate_district}</p>
                          <p className="text-xs text-slate-400">🔒 Bấm "Nhận" để xem thông tin</p>
                        </div>
                      ) : (
                        <div className="text-slate-900">
                          <p className="font-semibold">{lead.candidate_name}</p>
                          <p className="text-slate-500">{lead.candidate_phone}</p>
                          {lead.claimed_at && (
                            <p className="mt-1 text-xs text-slate-400">
                              Nhận lúc: {new Date(lead.claimed_at).toLocaleString('vi-VN')}
                            </p>
                          )}
                          {lead.status === 'claimed' && (
                            <p className="mt-1 text-xs font-semibold text-orange-600">
                              ⚠️ Lead chỉ dùng cho chiến dịch này, không chuyển nhượng/bán lại
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {lead.is_anonymous && lead.status === 'approved' ? (
                        <button
                          onClick={() => handleClaimLead(lead.id)}
                          className="rounded-lg bg-brand-orange px-3 py-1 text-xs font-semibold text-white hover:bg-orange-600"
                        >
                          Nhận lead
                        </button>
                      ) : (
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          lead.status === 'claimed' ? 'bg-green-100 text-green-700' :
                          lead.status === 'hired' ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {lead.status === 'claimed' ? 'Đã nhận' :
                           lead.status === 'hired' ? 'Đã tuyển' :
                           lead.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                      {formatCurrency(lead.bounty_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {anonymousLeads > 0 && (
            <div className="mt-4 rounded-xl bg-blue-50 p-4">
              <p className="text-sm text-blue-700">
                Có <strong>{anonymousLeads} lead ẩn danh</strong> đang chờ. Bấm "Nhận" để unlock thông tin liên hệ.
                Mỗi lần nhận sẽ trừ tiền từ ví.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
