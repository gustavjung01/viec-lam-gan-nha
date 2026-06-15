import { AlertTriangle, ChevronLeft, ChevronRight, Clock, Loader2, MapPin } from 'lucide-react';
import type { Campaign, CompanyAccount, CTVAccount, Lead, LeadFilters } from '../types';
import { TD_CLASS, TH_CLASS } from '../types';
import { AdminFilterBar } from '../components/AdminFilterBar';

interface AdminLeadTabProps {
  leads: Lead[];
  pagination: { page: number; limit: number; total: number; totalPages: number; hasMore?: boolean };
  filters: LeadFilters;
  loading: boolean;
  campaigns: Campaign[];
  companyAccounts: CompanyAccount[];
  ctvAccounts: CTVAccount[];
  onSearchChange: (value: string) => void;
  onFilterChange: (key: keyof LeadFilters, value: string) => void;
  onPageChange: (page: number) => void;
  onViewDetails: (lead: Lead) => void;
}

const SLA_DEFAULTS = { approvedHours: 6, claimedHours: 24, interviewingHours: 72, reminderMinutes: 60, qualificationDays: 7 };
const EMPTY_LEAD_FILTERS: LeadFilters = { search: '', status: 'all', campaignId: 'all', companyId: 'all', ctvId: 'all', province: '', district: '', dateFrom: '', dateTo: '' };

function safeDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(String(value).includes('T') ? String(value) : `${value}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function timeLeft(ms: number) {
  if (ms <= 0) return 'Đã quá hạn';
  const minutes = Math.ceil(ms / 60000);
  if (minutes < 60) return `Còn ${minutes} phút`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 48) return `Còn ${hours} giờ`;
  return `Còn ${Math.ceil(hours / 24)} ngày`;
}

export function AdminLeadTab({ leads, pagination, filters, loading, campaigns, companyAccounts, ctvAccounts, onSearchChange, onFilterChange, onPageChange, onViewDetails }: AdminLeadTabProps) {
  const statusBadge = (status: string) => {
    switch (status) {
      case 'submitted': return 'bg-blue-100 text-blue-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'claimed': return 'bg-purple-100 text-purple-800';
      case 'interviewing': return 'bg-amber-100 text-amber-800';
      case 'hired': return 'bg-emerald-100 text-emerald-800';
      case 'qualified': return 'bg-teal-100 text-teal-800';
      case 'disputed': return 'bg-rose-100 text-rose-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const statusLabel = (status: string) => ({ submitted: 'Mới gửi', approved: 'Hợp lệ', rejected: 'Từ chối', claimed: 'Cty đã nhận', interviewing: 'Đang PV', hired: 'Đã nhận việc', qualified: 'Đủ ĐK', disputed: 'Tranh chấp', closed: 'Đã đóng' } as Record<string, string>)[status] || status;

  const slaInfo = (lead: Lead) => {
    const raw = lead as Lead & Record<string, any>;
    const campaign = campaigns.find((item) => item.id === lead.campaign_id) as (Campaign & Record<string, any>) | undefined;
    const base = safeDate(raw.status_changed_at) || safeDate(raw.claimed_at) || safeDate(lead.submitted_at) || new Date();
    let dueAt: Date | null = null;
    let label = '';
    if (lead.status === 'approved') { dueAt = addHours(base, Number(raw.sla_approved_response_hours || campaign?.sla_approved_response_hours || SLA_DEFAULTS.approvedHours)); label = 'Công ty xác nhận nhận lead'; }
    if (lead.status === 'claimed') { dueAt = addHours(base, Number(raw.sla_claimed_interview_hours || campaign?.sla_claimed_interview_hours || SLA_DEFAULTS.claimedHours)); label = 'Công ty cập nhật phỏng vấn'; }
    if (lead.status === 'interviewing') { dueAt = addHours(base, Number(raw.sla_interviewing_result_hours || campaign?.sla_interviewing_result_hours || SLA_DEFAULTS.interviewingHours)); label = 'Công ty báo kết quả'; }
    if (lead.status === 'hired') { dueAt = addHours(base, Number(raw.qualification_days || campaign?.qualification_days || SLA_DEFAULTS.qualificationDays) * 24); label = 'Chờ đủ điều kiện'; }
    const remaining = dueAt ? dueAt.getTime() - Date.now() : 0;
    const reminderMinutes = Number(raw.sla_reminder_before_minutes || campaign?.sla_reminder_before_minutes || SLA_DEFAULTS.reminderMinutes);
    return { label, remaining, overdue: lead.status === 'disputed' || Boolean(dueAt && remaining <= 0), soon: Boolean(dueAt && remaining > 0 && remaining <= reminderMinutes * 60000) };
  };

  const attention = leads.map((lead) => ({ lead, sla: slaInfo(lead) })).filter((item) => item.sla.overdue || item.sla.soon).slice(0, 6);

  const resetFilters = () => {
    (Object.keys(EMPTY_LEAD_FILTERS) as (keyof LeadFilters)[]).forEach((key) => onFilterChange(key, EMPTY_LEAD_FILTERS[key]));
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {attention.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-700" /><div><h3 className="font-bold text-amber-950">Lead quá hạn / cần xử lý</h3><p className="text-xs text-amber-800">Ưu tiên lead công ty chưa cập nhật đúng mốc SLA hoặc đã báo không đạt.</p></div></div><span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200">{attention.length} lead</span></div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {attention.map(({ lead, sla }) => (
              <button key={lead.id} onClick={() => onViewDetails(lead)} className="rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-amber-100 hover:bg-amber-100/60"><div className="mb-2 flex items-center justify-between gap-2"><span className="font-mono text-xs font-bold text-slate-700">{lead.lead_code}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${lead.status === 'disputed' || sla.overdue ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{lead.status === 'disputed' ? 'Cần admin' : sla.overdue ? 'Quá hạn' : 'Sắp quá hạn'}</span></div><div className="text-sm font-semibold text-slate-900">{lead.candidate_name}</div><div className="mt-1 truncate text-xs text-slate-600">{lead.company_name || 'N/A'} · {lead.campaign_title}</div><div className="mt-2 flex items-center gap-1 text-xs text-amber-800"><Clock className="h-3 w-3" />{lead.status === 'disputed' ? 'Công ty báo nghỉ / không đạt' : `${sla.label}: ${timeLeft(sla.remaining)}`}</div></button>
            ))}
          </div>
        </div>
      )}

      <AdminFilterBar
        title="Bộ lọc Lead"
        count={pagination.total}
        fields={[
          { key: 'search', label: 'Tìm kiếm', type: 'search', value: filters.search, placeholder: 'Mã lead, tên, SĐT' },
          { key: 'status', label: 'Trạng thái', type: 'select', value: filters.status, options: [
            { value: 'all', label: 'Tất cả trạng thái' }, { value: 'submitted', label: 'Mới gửi' }, { value: 'approved', label: 'Hợp lệ' }, { value: 'rejected', label: 'Bị từ chối' }, { value: 'claimed', label: 'Cty đã nhận' }, { value: 'interviewing', label: 'Đang phỏng vấn' }, { value: 'hired', label: 'Đã nhận việc' }, { value: 'qualified', label: 'Đủ điều kiện' }, { value: 'disputed', label: 'Tranh chấp' }
          ]},
          { key: 'campaignId', label: 'Chiến dịch', type: 'select', value: filters.campaignId, options: [{ value: 'all', label: 'Tất cả chiến dịch' }, ...campaigns.map((c) => ({ value: c.id, label: c.title }))] },
          { key: 'companyId', label: 'Công ty', type: 'select', value: filters.companyId, options: [{ value: 'all', label: 'Tất cả công ty' }, ...companyAccounts.map((c) => ({ value: c.id, label: c.name }))] },
          { key: 'ctvId', label: 'CTV', type: 'select', value: filters.ctvId, options: [{ value: 'all', label: 'Tất cả CTV' }, { value: 'direct', label: 'Direct' }, ...ctvAccounts.map((c) => ({ value: c.id, label: c.name }))] },
          { key: 'province', label: 'Tỉnh/Thành', type: 'text', value: filters.province, placeholder: 'Tỉnh/Thành' },
          { key: 'district', label: 'Quận/Huyện', type: 'text', value: filters.district, placeholder: 'Quận/Huyện' },
          { key: 'dateFrom', label: 'Từ ngày', type: 'date', value: filters.dateFrom },
          { key: 'dateTo', label: 'Đến ngày', type: 'date', value: filters.dateTo },
        ]}
        onChange={(key, value) => key === 'search' ? onSearchChange(value) : onFilterChange(key as keyof LeadFilters, value)}
        onReset={resetFilters}
      />

      <div className="grid gap-3 md:hidden">
        {loading && <div className="flex justify-center rounded-2xl bg-white p-6"><Loader2 className="h-7 w-7 animate-spin text-red-600" /></div>}
        {leads.map((lead) => (
          <article key={lead.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-3"><div><p className="font-mono text-xs font-bold text-slate-500">{lead.lead_code}</p><h3 className="font-bold text-slate-900">{lead.candidate_name}</h3></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusBadge(lead.status)}`}>{statusLabel(lead.status)}</span></div>
            <div className="space-y-2 text-sm text-slate-600"><p>{lead.zalo_phone || lead.candidate_phone}</p><p className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-slate-400" />{[lead.district, lead.province].filter(Boolean).join(', ') || '-'}</p><p className="truncate">{lead.company_name || 'N/A'} · {lead.campaign_title}</p><p className="text-xs text-slate-500">Nguồn: {lead.ctv_name || 'Direct'} · {new Date(lead.submitted_at).toLocaleDateString('vi-VN')}</p></div>
            <button onClick={() => onViewDetails(lead)} className="mt-4 min-h-10 w-full rounded-xl bg-red-50 text-sm font-bold text-red-700">Chi tiết & xử lý</button>
          </article>
        ))}
        {leads.length === 0 && !loading && <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500">Không tìm thấy lead nào phù hợp với bộ lọc.</div>}
      </div>

      <div className="hidden overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 md:block">
        {loading && <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-sm"><Loader2 className="h-8 w-8 animate-spin text-red-600" /></div>}
        <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200"><thead className="bg-slate-50"><tr><th className={TH_CLASS}>Mã lead</th><th className={TH_CLASS}>Ngày gửi</th><th className={TH_CLASS}>Ứng viên</th><th className={TH_CLASS}>SĐT/Zalo</th><th className={TH_CLASS}>Khu vực</th><th className={TH_CLASS}>Công ty</th><th className={TH_CLASS}>CTV/Nguồn</th><th className={TH_CLASS}>Trạng thái</th><th className={TH_CLASS}>Người xử lý</th><th className={TH_CLASS}>Thao tác</th></tr></thead><tbody className="divide-y divide-slate-200 bg-white">{leads.map((lead) => (<tr key={lead.id} className="hover:bg-slate-50"><td className={TD_CLASS}><span className="font-mono text-xs font-medium text-slate-600">{lead.lead_code}</span></td><td className={TD_CLASS}>{new Date(lead.submitted_at).toLocaleDateString('vi-VN')}</td><td className={TD_CLASS}><div className="font-medium text-slate-900">{lead.candidate_name}</div></td><td className={TD_CLASS}><div>{lead.zalo_phone || lead.candidate_phone}</div>{lead.zalo_phone && <div className="text-[10px] font-medium text-blue-600">Zalo</div>}</td><td className={TD_CLASS}><div className="flex items-center gap-1"><MapPin className="h-3 w-3 text-slate-400" /><span className="text-xs">{lead.province || '-'}</span></div>{lead.district && <div className="ml-4 text-[10px] text-slate-500">{lead.district}</div>}</td><td className={TD_CLASS}><div className="max-w-[120px] truncate font-medium text-slate-700">{lead.company_name || 'N/A'}</div><div className="mt-1 max-w-[120px] truncate text-xs text-slate-500">{lead.campaign_title}</div></td><td className={TD_CLASS}><span className="text-xs text-slate-600">{lead.ctv_name || 'Direct'}</span></td><td className={TD_CLASS}><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(lead.status)}`}>{statusLabel(lead.status)}</span></td><td className={TD_CLASS}><span className="text-xs text-slate-500">{lead.processed_by || '-'}</span></td><td className={TD_CLASS}><button onClick={() => onViewDetails(lead)} className="rounded-lg bg-white px-3 py-1 text-sm font-medium text-red-600 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50">Chi tiết</button></td></tr>))}{leads.length === 0 && !loading && <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-slate-500">Không tìm thấy lead nào phù hợp với bộ lọc.</td></tr>}</tbody></table></div>
        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 sm:px-6"><button onClick={() => onPageChange(pagination.page - 1)} disabled={pagination.page === 1} className="inline-flex min-h-10 items-center rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 disabled:opacity-50"><ChevronLeft className="h-4 w-4" /> Trước</button><p className="text-sm text-slate-700">Trang <b>{pagination.page}</b> / <b>{pagination.totalPages}</b> · Tổng <b>{pagination.total}</b></p><button onClick={() => onPageChange(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} className="inline-flex min-h-10 items-center rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 disabled:opacity-50">Sau <ChevronRight className="h-4 w-4" /></button></div>
      </div>
    </div>
  );
}
