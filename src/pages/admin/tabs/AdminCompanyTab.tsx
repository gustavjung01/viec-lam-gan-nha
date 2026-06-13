import { useEffect, useState } from 'react';
import { Edit2, MapPin, Search, Settings, Shield, Star, Trash2, X } from 'lucide-react';
import type { CompanyAccount } from '../types';
import { TH_CLASS, TD_CLASS } from '../types';

interface AdminCompanyTabProps {
  companyAccounts: CompanyAccount[];
  onSearch: (value: string) => void;
  onFilter: (value: string) => void;
  onAction: (actionName: string, endpoint: string, body?: any) => void;
  onUpdate: (companyId: string, body: Partial<CompanyAccount>) => Promise<void>;
  onDelete: (companyId: string) => Promise<void>;
}

const EMPTY_FORM: Partial<CompanyAccount> = {
  name: '',
  phone: '',
  email: '',
  tax_code: '',
  address: '',
  province: '',
  district: '',
  status: 'active',
  clerk_user_id: '',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Cho duyet',
  active: 'Hoat dong',
  rejected: 'Tu choi',
  blocked: 'Bi khoa',
};

export function AdminCompanyTab({
  companyAccounts,
  onSearch,
  onFilter,
  onAction,
  onUpdate,
  onDelete,
}: AdminCompanyTabProps) {
  const [editingCompany, setEditingCompany] = useState<CompanyAccount | null>(null);
  const [settingsCompany, setSettingsCompany] = useState<CompanyAccount | null>(null);
  const [formData, setFormData] = useState<Partial<CompanyAccount>>(EMPTY_FORM);
  const [settingsData, setSettingsData] = useState<Partial<CompanyAccount>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editingCompany) {
      setFormData(EMPTY_FORM);
      return;
    }

    setFormData({
      name: editingCompany.name || '',
      phone: editingCompany.phone || '',
      email: editingCompany.email || '',
      tax_code: editingCompany.tax_code || '',
      address: editingCompany.address || '',
      province: editingCompany.province || '',
      district: editingCompany.district || '',
      status: editingCompany.status || 'active',
      clerk_user_id: editingCompany.clerk_user_id || '',
    });
  }, [editingCompany]);

  useEffect(() => {
    if (settingsCompany) {
      setSettingsData({
        trust_level: settingsCompany.trust_level || 'normal',
        deposit_status: settingsCompany.deposit_status || 'none',
        lead_trial_limit: settingsCompany.lead_trial_limit || 2,
        require_deposit_after_leads: settingsCompany.require_deposit_after_leads || 2,
        is_featured: settingsCompany.is_featured || 0,
        plan_code: settingsCompany.plan_code || 'free',
        free_job_posts_limit: settingsCompany.free_job_posts_limit || 5,
        weekly_push_limit: settingsCompany.weekly_push_limit || 5,
      });
    }
  }, [settingsCompany]);

  const updateField = (key: keyof CompanyAccount, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = async () => {
    if (!settingsCompany) return;
    try {
      setSaving(true);
      // We need separate endpoints for trust and quota as defined in backend
      await onAction('Cap nhat tin nhiem', `/admin/companies/${settingsCompany.id}/trust`, {
        trust_level: settingsData.trust_level,
        deposit_status: settingsData.deposit_status,
        lead_trial_limit: settingsData.lead_trial_limit,
        require_deposit_after_leads: settingsData.require_deposit_after_leads,
        is_featured: settingsData.is_featured,
      });
      await onAction('Cap nhat han muc', `/admin/companies/${settingsCompany.id}/quota`, {
        plan_code: settingsData.plan_code,
        free_job_posts_limit: settingsData.free_job_posts_limit,
        weekly_push_limit: settingsData.weekly_push_limit,
      });
      setSettingsCompany(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!editingCompany || !formData.name?.trim()) {
      alert('Ten cong ty la bat buoc.');
      return;
    }

    try {
      setSaving(true);
      await onUpdate(editingCompany.id, formData);
      setEditingCompany(null);
    } catch {
      // The parent handler already shows the error message.
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (company: CompanyAccount) => {
    const ok = window.confirm(
      `Xoa cong ty "${company.name}"?\n\nChi cong ty chua co chien dich/lead/giao dich moi xoa duoc. Cong ty co du lieu nen dung Khoa.`
    );
    if (!ok) return;
    try {
      await onDelete(company.id);
    } catch {
      // The parent handler already shows the error message.
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm sm:flex-row sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full rounded-xl border-0 py-2 pl-10 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-red-600 sm:text-sm sm:leading-6"
            placeholder="Tim cong ty, MST, SDT..."
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-4">
          <select
            onChange={(e) => onFilter(e.target.value)}
            className="block w-full rounded-xl border-0 py-2 pl-3 pr-10 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-red-600 sm:text-sm sm:leading-6"
            defaultValue="all"
          >
            <option value="all">Tat ca trang thai</option>
            <option value="pending">Cho duyet</option>
            <option value="active">Dang hoat dong</option>
            <option value="blocked">Bi khoa</option>
            <option value="rejected">Tu choi</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className={TH_CLASS}>Ten cong ty</th>
                <th scope="col" className={TH_CLASS}>Lien he</th>
                <th scope="col" className={TH_CLASS}>Khu vuc</th>
                <th scope="col" className={TH_CLASS}>Trang thai</th>
                <th scope="col" className={TH_CLASS}>Thao tac</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {companyAccounts.map((company) => (
                <tr key={company.id} className="transition-colors hover:bg-slate-50">
                  <td className={TD_CLASS}>
                    <div className="font-medium text-slate-900">{company.name}</div>
                    <div className="text-xs text-slate-500">Ma: {company.company_code}</div>
                    <div className="text-xs text-slate-500">MST: {company.tax_code || '-'}</div>
                  </td>
                  <td className={TD_CLASS}>
                    <div className="text-slate-900">{company.phone || '-'}</div>
                    {company.email && <div className="text-xs text-slate-500">{company.email}</div>}
                  </td>
                  <td className={TD_CLASS}>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4 text-slate-400" />
                        <span>{company.province || '-'}</span>
                      </div>
                      {company.district && <span className="ml-5 text-xs text-slate-500">{company.district}</span>}
                    </div>
                  </td>
                  <td className={TD_CLASS}>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        company.status === 'active' ? 'bg-green-100 text-green-800' :
                        company.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                        company.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {STATUS_LABELS[company.status] || company.status}
                    </span>
                  </td>
                  <td className={TD_CLASS}>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => setEditingCompany(company)}
                        className="inline-flex items-center gap-1 font-medium text-blue-600 hover:text-blue-900"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        Sua
                      </button>

                      <button
                        onClick={() => setSettingsCompany(company)}
                        className="inline-flex items-center gap-1 font-medium text-purple-600 hover:text-purple-900"
                      >
                        <Settings className="h-3.5 w-3.5" />
                        Cai dat
                      </button>

                      {company.status === 'pending' && (
                        <>
                          <button
                            onClick={() => onAction('Duyet cong ty', `/admin/company/${company.id}/approve`)}
                            className="font-medium text-green-600 hover:text-green-900"
                          >
                            Duyet
                          </button>
                          <button
                            onClick={() => {
                              const reason = prompt('Ly do tu choi:');
                              if (reason) onAction('Tu choi cong ty', `/admin/company/${company.id}/reject`, { reason });
                            }}
                            className="font-medium text-red-600 hover:text-red-900"
                          >
                            Tu choi
                          </button>
                        </>
                      )}

                      {company.status === 'active' && (
                        <button
                          onClick={() => {
                            const reason = prompt('Ly do khoa:');
                            if (reason) onAction('Khoa cong ty', `/admin/company/${company.id}/block`, { reason });
                          }}
                          className="font-medium text-red-600 hover:text-red-900"
                        >
                          Khoa
                        </button>
                      )}

                      {company.status === 'blocked' && (
                        <button
                          onClick={() => onAction('Mo khoa cong ty', `/admin/company/${company.id}/unblock`)}
                          className="font-medium text-blue-600 hover:text-blue-900"
                        >
                          Mo khoa
                        </button>
                      )}

                      <button
                        onClick={() => handleDelete(company)}
                        className="inline-flex items-center gap-1 font-medium text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Xoa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {companyAccounts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                    Khong tim thay cong ty nao
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Sua thong tin cong ty</h3>
                <p className="text-sm text-slate-500">Ma: {editingCompany.company_code}</p>
              </div>
              <button
                onClick={() => setEditingCompany(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid max-h-[70vh] gap-4 overflow-y-auto px-6 py-5 md:grid-cols-2">
              <label className="space-y-1 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">Ten cong ty *</span>
                <input
                  value={formData.name || ''}
                  onChange={(e) => updateField('name', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">So dien thoai</span>
                <input
                  value={formData.phone || ''}
                  onChange={(e) => updateField('phone', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Email</span>
                <input
                  value={formData.email || ''}
                  onChange={(e) => updateField('email', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">MST</span>
                <input
                  value={formData.tax_code || ''}
                  onChange={(e) => updateField('tax_code', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Trang thai</span>
                <select
                  value={formData.status || 'active'}
                  onChange={(e) => updateField('status', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                >
                  <option value="pending">Cho duyet</option>
                  <option value="active">Hoat dong</option>
                  <option value="blocked">Bi khoa</option>
                  <option value="rejected">Tu choi</option>
                </select>
              </label>

              <label className="space-y-1 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">Dia chi</span>
                <input
                  value={formData.address || ''}
                  onChange={(e) => updateField('address', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Tinh/Thanh</span>
                <input
                  value={formData.province || ''}
                  onChange={(e) => updateField('province', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Quan/Huyen</span>
                <input
                  value={formData.district || ''}
                  onChange={(e) => updateField('district', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                />
              </label>

              <label className="space-y-1 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">Clerk user ID</span>
                <input
                  value={formData.clerk_user_id || ''}
                  onChange={(e) => updateField('clerk_user_id', e.target.value)}
                  placeholder="user_..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                />
                <span className="block text-xs text-slate-500">
                  Dung de lien ket tai khoan Clerk voi cong ty. De trong neu chua co.
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                onClick={() => setEditingCompany(null)}
                className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                disabled={saving}
              >
                Huy
              </button>
              <button
                onClick={handleSave}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:bg-red-300"
                disabled={saving}
              >
                {saving ? 'Dang luu...' : 'Luu thay doi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {settingsCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Cai dat nang cao</h3>
                <p className="text-sm text-slate-500">{settingsCompany.name} - {settingsCompany.company_code}</p>
              </div>
              <button
                onClick={() => setSettingsCompany(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid max-h-[70vh] gap-6 overflow-y-auto px-6 py-5">
              {/* Trust & Deposit Section */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Tin nhiem & Ky quy</h4>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">Level tin nhiem</span>
                    <select
                      value={settingsData.trust_level}
                      onChange={(e) => setSettingsData(p => ({ ...p, trust_level: e.target.value as any }))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                    >
                      <option value="normal">Normal</option>
                      <option value="verified">Verified</option>
                      <option value="priority">Priority</option>
                      <option value="vip">VIP (No deposit needed)</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">Trang thai ky quy</span>
                    <select
                      value={settingsData.deposit_status}
                      onChange={(e) => setSettingsData(p => ({ ...p, deposit_status: e.target.value as any }))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                    >
                      <option value="none">Chua ky quy</option>
                      <option value="pending">Dang cho xac nhan</option>
                      <option value="partial">Ky quy mot phan</option>
                      <option value="confirmed">Da ky quy du</option>
                      <option value="waived">Mien ky quy</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">Luot dung thu (trial leads)</span>
                    <input
                      type="number"
                      value={settingsData.lead_trial_limit}
                      onChange={(e) => setSettingsData(p => ({ ...p, lead_trial_limit: parseInt(e.target.value) || 0 }))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">Yeu cau ky quy sau (leads)</span>
                    <input
                      type="number"
                      value={settingsData.require_deposit_after_leads}
                      onChange={(e) => setSettingsData(p => ({ ...p, require_deposit_after_leads: parseInt(e.target.value) || 0 }))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                    />
                  </label>
                </div>
              </section>

              {/* Quota & Plan Section */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Star className="h-5 w-5 text-amber-500" />
                  <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Goi cuoc & Han muc</h4>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">Goi cuoc</span>
                    <select
                      value={settingsData.plan_code}
                      onChange={(e) => setSettingsData(p => ({ ...p, plan_code: e.target.value as any }))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                    >
                      <option value="free">Free</option>
                      <option value="basic">Basic</option>
                      <option value="pro">Pro</option>
                      <option value="vip">VIP</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">Gioi han tin dang</span>
                    <input
                      type="number"
                      value={settingsData.free_job_posts_limit}
                      onChange={(e) => setSettingsData(p => ({ ...p, free_job_posts_limit: parseInt(e.target.value) || 0 }))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">Luot day tin (tuan)</span>
                    <input
                      type="number"
                      value={settingsData.weekly_push_limit}
                      onChange={(e) => setSettingsData(p => ({ ...p, weekly_push_limit: parseInt(e.target.value) || 0 }))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                    />
                  </label>
                  <div className="flex items-center pt-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settingsData.is_featured === 1}
                        onChange={(e) => setSettingsData(p => ({ ...p, is_featured: e.target.checked ? 1 : 0 }))}
                        className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-sm font-medium text-slate-700">Cong ty tieu bieu (Featured)</span>
                    </label>
                  </div>
                </div>
              </section>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                onClick={() => setSettingsCompany(null)}
                className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                disabled={saving}
              >
                Huy
              </button>
              <button
                onClick={handleSaveSettings}
                className="rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-300"
                disabled={saving}
              >
                {saving ? 'Dang luu...' : 'Cap nhat thiet lap'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
