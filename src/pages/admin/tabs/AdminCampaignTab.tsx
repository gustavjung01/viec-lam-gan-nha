import { useMemo, useState } from 'react';
import { Briefcase, Building2 } from 'lucide-react';
import type { Campaign } from '../types';
import { TH_CLASS, TD_CLASS } from '../types';
import { AdminFilterBar } from '../components/AdminFilterBar';

interface AdminCampaignTabProps {
  campaigns: Campaign[];
  onAction: (actionName: string, endpoint: string, body?: any) => void;
}

const EMPTY_FILTERS = {
  search: '',
  status: 'all',
  visibility: 'all',
};

function safeText(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function statusLabel(status: string) {
  return ({ active: 'Hoạt động', pending: 'Chờ duyệt', closed: 'Đã đóng', paused: 'Tạm dừng', draft: 'Nháp' } as Record<string, string>)[status] || status;
}

function statusClass(status: string) {
  if (status === 'active') return 'bg-green-100 text-green-800';
  if (status === 'pending') return 'bg-amber-100 text-amber-800';
  if (status === 'closed') return 'bg-slate-100 text-slate-700';
  return 'bg-blue-50 text-blue-700';
}

function visibilityLabel(visibility: string) {
  return visibility === 'public_candidate' ? 'Public ứng viên' : visibility === 'ctv_private' ? 'Riêng CTV' : visibility || 'Không rõ';
}

export function AdminCampaignTab({ campaigns, onAction }: AdminCampaignTabProps) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const filteredCampaigns = useMemo(() => {
    const q = safeText(filters.search);
    return campaigns.filter((campaign) => {
      const matchesSearch = !q || [campaign.title, campaign.campaign_code, campaign.company_name, campaign.company_code].some((value) => safeText(value).includes(q));
      const matchesStatus = filters.status === 'all' || campaign.status === filters.status;
      const matchesVisibility = filters.visibility === 'all' || campaign.visibility === filters.visibility;
      return matchesSearch && matchesStatus && matchesVisibility;
    });
  }, [campaigns, filters]);

  const actionButton = (campaign: Campaign) => {
    if (campaign.status === 'pending') return <button onClick={() => onAction('Duyệt chiến dịch', `/admin/campaigns/${campaign.id}/approve`)} className="min-h-10 rounded-xl bg-green-50 px-3 text-sm font-bold text-green-700">Duyệt</button>;
    if (campaign.status === 'active') return <button onClick={() => onAction('Đóng chiến dịch', `/admin/campaigns/${campaign.id}/close`)} className="min-h-10 rounded-xl bg-red-50 px-3 text-sm font-bold text-red-700">Đóng</button>;
    if (campaign.status === 'closed') return <button onClick={() => onAction('Mở lại chiến dịch', `/admin/campaigns/${campaign.id}/reopen`)} className="min-h-10 rounded-xl bg-blue-50 px-3 text-sm font-bold text-blue-700">Mở lại</button>;
    return <span className="text-xs text-slate-400">Không có thao tác</span>;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <AdminFilterBar
        title="Bộ lọc chiến dịch"
        count={filteredCampaigns.length}
        fields={[
          { key: 'search', label: 'Tìm kiếm', type: 'search', value: filters.search, placeholder: 'Tên tin, mã tin, công ty' },
          { key: 'status', label: 'Trạng thái', type: 'select', value: filters.status, options: [
            { value: 'all', label: 'Tất cả trạng thái' },
            { value: 'pending', label: 'Chờ duyệt' },
            { value: 'active', label: 'Hoạt động' },
            { value: 'closed', label: 'Đã đóng' },
            { value: 'paused', label: 'Tạm dừng' },
            { value: 'draft', label: 'Nháp' },
          ]},
          { key: 'visibility', label: 'Hiển thị', type: 'select', value: filters.visibility, options: [
            { value: 'all', label: 'Tất cả hiển thị' },
            { value: 'public_candidate', label: 'Public ứng viên' },
            { value: 'ctv_private', label: 'Riêng CTV' },
          ]},
        ]}
        onChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
        onReset={() => setFilters(EMPTY_FILTERS)}
      />

      <div className="grid gap-3 md:hidden">
        {filteredCampaigns.map((campaign) => (
          <article key={campaign.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900">{campaign.title}</h3>
                <p className="font-mono text-xs text-slate-500">{campaign.campaign_code}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(campaign.status)}`}>{statusLabel(campaign.status)}</span>
            </div>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-slate-400" />{campaign.company_name}</div>
              <div className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-slate-400" />{campaign.total_leads || 0} lead · {visibilityLabel(campaign.visibility)}</div>
              <div className="font-semibold text-slate-900">{Number(campaign.bounty_amount || 0).toLocaleString('vi-VN')}đ bounty</div>
            </div>
            <div className="mt-4">{actionButton(campaign)}</div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr><th className={TH_CLASS}>Chiến dịch</th><th className={TH_CLASS}>Công ty</th><th className={TH_CLASS}>Trạng thái</th><th className={TH_CLASS}>Hiển thị</th><th className={TH_CLASS}>Thao tác</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredCampaigns.map((campaign) => (
                <tr key={campaign.id} className="transition-colors hover:bg-slate-50">
                  <td className={TD_CLASS}><div className="font-medium text-slate-900">{campaign.title}</div><div className="text-xs text-slate-500">Mã: {campaign.campaign_code}</div><div className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Briefcase className="h-3 w-3" />{campaign.total_leads} leads</div></td>
                  <td className={TD_CLASS}><div className="text-slate-900">{campaign.company_name}</div><div className="text-xs text-slate-500">Mã: {campaign.company_code}</div></td>
                  <td className={TD_CLASS}><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(campaign.status)}`}>{statusLabel(campaign.status)}</span></td>
                  <td className={TD_CLASS}><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${campaign.visibility === 'public_candidate' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>{visibilityLabel(campaign.visibility)}</span></td>
                  <td className={TD_CLASS}>{actionButton(campaign)}</td>
                </tr>
              ))}
              {filteredCampaigns.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">Không tìm thấy chiến dịch nào</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
