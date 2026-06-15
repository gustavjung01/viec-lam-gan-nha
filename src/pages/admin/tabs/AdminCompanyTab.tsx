import { useEffect, useMemo, useState } from 'react';
import { Edit2, MapPin, Settings, Shield, Star, Trash2, X } from 'lucide-react';
import type { CompanyAccount } from '../types';
import { TH_CLASS, TD_CLASS } from '../types';
import { AdminFilterBar } from '../components/AdminFilterBar';

interface AdminCompanyTabProps {
  companyAccounts: CompanyAccount[];
  onSearch: (value: string) => void;
  onFilter: (value: string) => void;
  onAction: (actionName: string, endpoint: string, body?: any) => void;
  onUpdate: (companyId: string, body: Partial<CompanyAccount>) => Promise<void>;
  onDelete: (companyId: string) => Promise<void>;
}

const EMPTY_FORM: Partial<CompanyAccount> = { name: '', phone: '', email: '', tax_code: '', address: '', province: '', district: '', status: 'active', clerk_user_id: '' };
const EMPTY_FILTERS = { search: '', status: 'all', province: '', district: '', plan: 'all', trust: 'all', deposit: 'all' };

const STATUS_LABELS: Record<string, string> = { pending: 'Chờ duyệt', active: 'Hoạt động', rejected: 'Từ chối', blocked: 'Bị khóa' };

function safeText(value: unknown) { return String(value || '').trim().toLowerCase(); }
function statusClass(status: string) {
  if (status === 'active') return 'bg-green-100 text-green-800';
  if (status === 'pending') return 'bg-amber-100 text-amber-800';
  if (status === 'rejected') return 'bg-red-100 text-red-800';
  return 'bg-slate-100 text-slate-800';
}

export function AdminCompanyTab({ companyAccounts, onSearch, onFilter, onAction, onUpdate, onDelete }: AdminCompanyTabProps) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [editingCompany, setEditingCompany] = useState<CompanyAccount | null>(null);
  const [settingsCompany, setSettingsCompany] = useState<CompanyAccount | null>(null);
  const [formData, setFormData] = useState<Partial<CompanyAccount>>(EMPTY_FORM);
  const [settingsData, setSettingsData] = useState<Partial<CompanyAccount>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editingCompany) { setFormData(EMPTY_FORM); return; }
    setFormData({ name: editingCompany.name || '', phone: editingCompany.phone || '', email: editingCompany.email || '', tax_code: editingCompany.tax_code || '', address: editingCompany.address || '', province: editingCompany.province || '', district: editingCompany.district || '', status: editingCompany.status || 'active', clerk_user_id: editingCompany.clerk_user_id || '' });
  }, [editingCompany]);

  useEffect(() => {
    if (!settingsCompany) return;
    setSettingsData({ trust_level: settingsCompany.trust_level || 'normal', deposit_status: settingsCompany.deposit_status || 'none', lead_trial_limit: settingsCompany.lead_trial_limit || 2, require_deposit_after_leads: settingsCompany.require_deposit_after_leads || 2, is_featured: settingsCompany.is_featured || 0, plan_code: settingsCompany.plan_code || 'free', free_job_posts_limit: settingsCompany.free_job_posts_limit || 5, weekly_push_limit: settingsCompany.weekly_push_limit || 5 });
  }, [settingsCompany]);

  const filteredCompanyAccounts = useMemo(() => {
    const q = safeText(filters.search);
    const province = safeText(filters.province);
    const district = safeText(filters.district);
    return companyAccounts.filter((company) => {
      const matchesSearch = !q || [company.name, company.phone, company.email, company.tax_code, company.company_code].some((value) => safeText(value).includes(q));
      const matchesStatus = filters.status === 'all' || company.status === filters.status;
      const matchesProvince = !province || safeText(company.province).includes(province);
      const matchesDistrict = !district || safeText(company.district).includes(district);
      const matchesPlan = filters.plan === 'all' || company.plan_code === filters.plan;
      const matchesTrust = filters.trust === 'all' || company.trust_level === filters.trust;
      const matchesDeposit = filters.deposit === 'all' || company.deposit_status === filters.deposit;
      return matchesSearch && matchesStatus && matchesProvince && matchesDistrict && matchesPlan && matchesTrust && matchesDeposit;
    });
  }, [companyAccounts, filters]);

  const updateFilter = (key: string, value: string) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    if (key === 'search') onSearch(value);
    if (key === 'status') onFilter(value);
  };

  const resetFilters = () => { setFilters(EMPTY_FILTERS); onSearch(''); onFilter('all'); };
  const updateField = (key: keyof CompanyAccount, value: string) => setFormData((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!editingCompany || !formData.name?.trim()) { alert('Tên công ty là bắt buộc.'); return; }
    try { setSaving(true); await onUpdate(editingCompany.id, formData); setEditingCompany(null); } finally { setSaving(false); }
  };

  const handleSaveSettings = async () => {
    if (!settingsCompany) return;
    try {
      setSaving(true);
      await onAction('Cập nhật tín nhiệm', `/admin/companies/${settingsCompany.id}/trust`, { trust_level: settingsData.trust_level, deposit_status: settingsData.deposit_status, lead_trial_limit: settingsData.lead_trial_limit, require_deposit_after_leads: settingsData.require_deposit_after_leads, is_featured: settingsData.is_featured });
      await onAction('Cập nhật hạn mức', `/admin/companies/${settingsCompany.id}/quota`, { plan_code: settingsData.plan_code, free_job_posts_limit: settingsData.free_job_posts_limit, weekly_push_limit: settingsData.weekly_push_limit });
      setSettingsCompany(null);
    } finally { setSaving(false); }
  };

  const handleDelete = async (company: CompanyAccount) => {
    const ok = window.confirm(`Xóa công ty "${company.name}"?\n\nChỉ công ty chưa có dữ liệu mới xóa được. Công ty có dữ liệu nên dùng Khóa.`);
    if (ok) await onDelete(company.id);
  };

  const actionButtons = (company: CompanyAccount) => (
    <div className="flex flex-wrap gap-2">
      <button onClick={() => setEditingCompany(company)} className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-blue-50 px-3 text-sm font-bold text-blue-700"><Edit2 className="h-3.5 w-3.5" />Sửa</button>
      <button onClick={() => setSettingsCompany(company)} className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-purple-50 px-3 text-sm font-bold text-purple-700"><Settings className="h-3.5 w-3.5" />Cài đặt</button>
      {company.status === 'pending' && <button onClick={() => onAction('Duyệt công ty', `/admin/company/${company.id}/approve`)} className="min-h-10 rounded-xl bg-green-50 px-3 text-sm font-bold text-green-700">Duyệt</button>}
      {company.status === 'active' && <button onClick={() => { const reason = prompt('Lý do khóa:'); if (reason) onAction('Khóa công ty', `/admin/company/${company.id}/block`, { reason }); }} className="min-h-10 rounded-xl bg-red-50 px-3 text-sm font-bold text-red-700">Khóa</button>}
      {company.status === 'blocked' && <button onClick={() => onAction('Mở khóa công ty', `/admin/company/${company.id}/unblock`)} className="min-h-10 rounded-xl bg-blue-50 px-3 text-sm font-bold text-blue-700">Mở khóa</button>}
      <button onClick={() => handleDelete(company)} className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-slate-100 px-3 text-sm font-bold text-slate-700"><Trash2 className="h-3.5 w-3.5" />Xóa</button>
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <AdminFilterBar
        title="Bộ lọc công ty"
        count={filteredCompanyAccounts.length}
        fields={[
          { key: 'search', label: 'Tìm kiếm', type: 'search', value: filters.search, placeholder: 'Tên, MST, SĐT, email' },
          { key: 'status', label: 'Trạng thái', type: 'select', value: filters.status, options: [{ value: 'all', label: 'Tất cả trạng thái' }, { value: 'pending', label: 'Chờ duyệt' }, { value: 'active', label: 'Hoạt động' }, { value: 'blocked', label: 'Bị khóa' }, { value: 'rejected', label: 'Từ chối' }] },
          { key: 'province', label: 'Tỉnh/Thành', type: 'text', value: filters.province, placeholder: 'Tỉnh/Thành' },
          { key: 'district', label: 'Quận/Huyện', type: 'text', value: filters.district, placeholder: 'Quận/Huyện' },
          { key: 'plan', label: 'Gói', type: 'select', value: filters.plan, options: [{ value: 'all', label: 'Tất cả gói' }, { value: 'free', label: 'Free' }, { value: 'basic', label: 'Basic' }, { value: 'pro', label: 'Pro' }, { value: 'vip', label: 'VIP' }] },
          { key: 'trust', label: 'Tín nhiệm', type: 'select', value: filters.trust, options: [{ value: 'all', label: 'Tất cả' }, { value: 'normal', label: 'Normal' }, { value: 'verified', label: 'Verified' }, { value: 'priority', label: 'Priority' }, { value: 'vip', label: 'VIP' }] },
          { key: 'deposit', label: 'Ký quỹ', type: 'select', value: filters.deposit, options: [{ value: 'all', label: 'Tất cả' }, { value: 'none', label: 'Chưa ký quỹ' }, { value: 'pending', label: 'Chờ xác nhận' }, { value: 'partial', label: 'Một phần' }, { value: 'confirmed', label: 'Đã đủ' }, { value: 'waived', label: 'Miễn' }] },
        ]}
        onChange={updateFilter}
        onReset={resetFilters}
      />

      <div className="grid gap-3 md:hidden">
        {filteredCompanyAccounts.map((company) => (
          <article key={company.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-3"><div><h3 className="font-bold text-slate-900">{company.name}</h3><p className="font-mono text-xs text-slate-500">{company.company_code}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(company.status)}`}>{STATUS_LABELS[company.status] || company.status}</span></div>
            <div className="space-y-2 text-sm text-slate-600"><p>{company.phone || '-'}</p>{company.email && <p className="truncate text-xs text-slate-500">{company.email}</p>}<p className="flex items-center gap-1"><MapPin className="h-4 w-4 text-slate-400" />{[company.district, company.province].filter(Boolean).join(', ') || '-'}</p><p className="text-xs text-slate-500">Gói: {company.plan_code || 'free'} · Tín nhiệm: {company.trust_level || 'normal'} · Ví: {Number(company.wallet_balance || 0).toLocaleString('vi-VN')}đ</p></div>
            <div className="mt-4">{actionButtons(company)}</div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 md:block">
        <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200"><thead className="bg-slate-50"><tr><th className={TH_CLASS}>Tên công ty</th><th className={TH_CLASS}>Liên hệ</th><th className={TH_CLASS}>Khu vực</th><th className={TH_CLASS}>Gói/Tín nhiệm</th><th className={TH_CLASS}>Trạng thái</th><th className={TH_CLASS}>Thao tác</th></tr></thead><tbody className="divide-y divide-slate-200 bg-white">{filteredCompanyAccounts.map((company) => (<tr key={company.id} className="transition-colors hover:bg-slate-50"><td className={TD_CLASS}><div className="font-medium text-slate-900">{company.name}</div><div className="text-xs text-slate-500">Mã: {company.company_code}</div><div className="text-xs text-slate-500">MST: {company.tax_code || '-'}</div></td><td className={TD_CLASS}><div className="text-slate-900">{company.phone || '-'}</div>{company.email && <div className="text-xs text-slate-500">{company.email}</div>}</td><td className={TD_CLASS}><div className="flex items-center gap-1"><MapPin className="h-4 w-4 text-slate-400" /><span>{company.province || '-'}</span></div>{company.district && <span className="ml-5 text-xs text-slate-500">{company.district}</span>}</td><td className={TD_CLASS}><div className="font-medium text-slate-700">{company.plan_code || 'free'}</div><div className="text-xs text-slate-500">{company.trust_level || 'normal'} · {company.deposit_status || 'none'}</div></td><td className={TD_CLASS}><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(company.status)}`}>{STATUS_LABELS[company.status] || company.status}</span></td><td className={TD_CLASS}>{actionButtons(company)}</td></tr>))}{filteredCompanyAccounts.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">Không tìm thấy công ty nào</td></tr>}</tbody></table></div>
      </div>

      {editingCompany && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-3 sm:items-center sm:p-4"><div className="w-full max-w-2xl rounded-3xl bg-white shadow-xl"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h3 className="text-lg font-bold text-slate-900">Sửa thông tin công ty</h3><p className="text-sm text-slate-500">Mã: {editingCompany.company_code}</p></div><button onClick={() => setEditingCompany(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div><div className="grid max-h-[70vh] gap-4 overflow-y-auto px-5 py-4 md:grid-cols-2">{(['name','phone','email','tax_code','address','province','district','clerk_user_id'] as (keyof CompanyAccount)[]).map((key) => (<label key={key} className={`space-y-1 ${key === 'name' || key === 'address' || key === 'clerk_user_id' ? 'md:col-span-2' : ''}`}><span className="text-sm font-medium text-slate-700">{key}</span><input value={String(formData[key] || '')} onChange={(e) => updateField(key, e.target.value)} className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm focus:border-red-500 focus:outline-none" /></label>))}<label className="space-y-1"><span className="text-sm font-medium text-slate-700">Trạng thái</span><select value={formData.status || 'active'} onChange={(e) => updateField('status', e.target.value)} className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm focus:border-red-500 focus:outline-none"><option value="pending">Chờ duyệt</option><option value="active">Hoạt động</option><option value="blocked">Bị khóa</option><option value="rejected">Từ chối</option></select></label></div><div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4"><button onClick={() => setEditingCompany(null)} className="min-h-10 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700" disabled={saving}>Hủy</button><button onClick={handleSave} className="min-h-10 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white disabled:bg-red-300" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</button></div></div></div>
      )}

      {settingsCompany && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-3 sm:items-center sm:p-4"><div className="w-full max-w-2xl rounded-3xl bg-white shadow-xl"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h3 className="text-lg font-bold text-slate-900">Cài đặt nâng cao</h3><p className="text-sm text-slate-500">{settingsCompany.name}</p></div><button onClick={() => setSettingsCompany(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div><div className="grid max-h-[70vh] gap-5 overflow-y-auto px-5 py-4"><section className="space-y-3"><div className="flex items-center gap-2 border-b pb-2"><Shield className="h-5 w-5 text-blue-600" /><h4 className="text-sm font-bold uppercase tracking-wider text-slate-800">Tín nhiệm & ký quỹ</h4></div><div className="grid gap-3 md:grid-cols-2"><label className="space-y-1"><span className="text-sm font-medium text-slate-700">Level tín nhiệm</span><select value={settingsData.trust_level} onChange={(e) => setSettingsData(p => ({ ...p, trust_level: e.target.value as any }))} className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"><option value="normal">Normal</option><option value="verified">Verified</option><option value="priority">Priority</option><option value="vip">VIP</option></select></label><label className="space-y-1"><span className="text-sm font-medium text-slate-700">Ký quỹ</span><select value={settingsData.deposit_status} onChange={(e) => setSettingsData(p => ({ ...p, deposit_status: e.target.value as any }))} className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"><option value="none">Chưa ký quỹ</option><option value="pending">Chờ xác nhận</option><option value="partial">Một phần</option><option value="confirmed">Đã đủ</option><option value="waived">Miễn</option></select></label><label className="space-y-1"><span className="text-sm font-medium text-slate-700">Trial leads</span><input type="number" value={settingsData.lead_trial_limit} onChange={(e) => setSettingsData(p => ({ ...p, lead_trial_limit: parseInt(e.target.value) || 0 }))} className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" /></label><label className="space-y-1"><span className="text-sm font-medium text-slate-700">Yêu cầu ký quỹ sau leads</span><input type="number" value={settingsData.require_deposit_after_leads} onChange={(e) => setSettingsData(p => ({ ...p, require_deposit_after_leads: parseInt(e.target.value) || 0 }))} className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" /></label></div></section><section className="space-y-3"><div className="flex items-center gap-2 border-b pb-2"><Star className="h-5 w-5 text-amber-500" /><h4 className="text-sm font-bold uppercase tracking-wider text-slate-800">Gói cước & hạn mức</h4></div><div className="grid gap-3 md:grid-cols-2"><label className="space-y-1"><span className="text-sm font-medium text-slate-700">Gói</span><select value={settingsData.plan_code} onChange={(e) => setSettingsData(p => ({ ...p, plan_code: e.target.value as any }))} className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"><option value="free">Free</option><option value="basic">Basic</option><option value="pro">Pro</option><option value="vip">VIP</option></select></label><label className="space-y-1"><span className="text-sm font-medium text-slate-700">Giới hạn tin đăng</span><input type="number" value={settingsData.free_job_posts_limit} onChange={(e) => setSettingsData(p => ({ ...p, free_job_posts_limit: parseInt(e.target.value) || 0 }))} className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" /></label><label className="space-y-1"><span className="text-sm font-medium text-slate-700">Lượt đẩy tin/tuần</span><input type="number" value={settingsData.weekly_push_limit} onChange={(e) => setSettingsData(p => ({ ...p, weekly_push_limit: parseInt(e.target.value) || 0 }))} className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" /></label><label className="flex items-center gap-2 pt-6"><input type="checkbox" checked={settingsData.is_featured === 1} onChange={(e) => setSettingsData(p => ({ ...p, is_featured: e.target.checked ? 1 : 0 }))} /> <span className="text-sm font-medium text-slate-700">Công ty tiêu biểu</span></label></div></section></div><div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4"><button onClick={() => setSettingsCompany(null)} className="min-h-10 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700" disabled={saving}>Hủy</button><button onClick={handleSaveSettings} className="min-h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:bg-slate-300" disabled={saving}>{saving ? 'Đang lưu...' : 'Cập nhật'}</button></div></div></div>
      )}
    </div>
  );
}
