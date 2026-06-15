import { useMemo, useState } from 'react';
import { Download, Wallet, ArrowRightLeft, Building2, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { TaxReport } from '../types';
import { TH_CLASS, TD_CLASS } from '../types';
import { AdminFilterBar } from '../components/AdminFilterBar';

interface AdminFinanceTabProps {
  taxReport: TaxReport | null;
}

const EMPTY_FILTERS = {
  search: '',
  source: 'all',
  dateFrom: '',
  dateTo: '',
};

function inDateRange(value: string | undefined, from: string, to: string) {
  if (!value) return true;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return true;
  if (from && time < new Date(`${from}T00:00:00`).getTime()) return false;
  if (to && time > new Date(`${to}T23:59:59`).getTime()) return false;
  return true;
}

function safeText(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

export function AdminFinanceTab({ taxReport }: AdminFinanceTabProps) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const summary = taxReport?.summary ?? {
    total_qualified_leads: 0,
    total_company_bounty: 0,
    total_platform_fees_20_percent: 0,
    total_ctv_payouts_80_percent: 0,
  };

  const split_verification = taxReport?.split_verification ?? { math_check: true };

  const filteredQualifiedLeads = useMemo(() => {
    const rows = taxReport?.qualified_leads || [];
    const q = safeText(filters.search);
    return rows.filter((lead) => {
      const matchesSearch = !q || [lead.lead_code, lead.campaign_title, lead.company_name, lead.ctv_name].some((value) => safeText(value).includes(q));
      const matchesSource = filters.source === 'all' || (filters.source === 'direct' ? !lead.ctv_name : Boolean(lead.ctv_name));
      const matchesDate = inDateRange(lead.qualified_at, filters.dateFrom, filters.dateTo);
      return matchesSearch && matchesSource && matchesDate;
    });
  }, [taxReport?.qualified_leads, filters]);

  const handleExportCSV = () => {
    const headers = ['Ma Lead', 'Ngay', 'Chien Dich', 'Cong Ty', 'CTV', 'Tong Bounty', 'Platform Fee (20%)', 'CTV Payout (80%)'];
    const rows = filteredQualifiedLeads.map(lead => [
      lead.lead_code,
      new Date(lead.qualified_at).toLocaleDateString('vi-VN'),
      `"${lead.campaign_title}"`,
      `"${lead.company_name}"`,
      `"${lead.ctv_name || 'Direct'}"`,
      Number(lead.bounty_amount || 0),
      Number(lead.platform_fee_amount || 0),
      Number(lead.ctv_reward_amount || 0)
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `vlgn_finance_report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (!taxReport) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <p className="text-slate-500">Chưa có dữ liệu báo cáo tài chính.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Báo cáo tài chính nội bộ</h2>
          <p className="text-sm text-slate-500">Dữ liệu phân bổ hoa hồng, có lọc theo ngày và nguồn.</p>
        </div>
        <button onClick={handleExportCSV} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800">
          <Download className="h-4 w-4" />
          Xuất CSV
        </button>
      </div>

      <AdminFilterBar
        title="Bộ lọc tài chính"
        count={filteredQualifiedLeads.length}
        fields={[
          { key: 'search', label: 'Tìm kiếm', type: 'search', value: filters.search, placeholder: 'Lead, chiến dịch, công ty, CTV' },
          { key: 'source', label: 'Nguồn', type: 'select', value: filters.source, options: [
            { value: 'all', label: 'Tất cả nguồn' },
            { value: 'ctv', label: 'Qua CTV' },
            { value: 'direct', label: 'Direct' },
          ]},
          { key: 'dateFrom', label: 'Từ ngày', type: 'date', value: filters.dateFrom },
          { key: 'dateTo', label: 'Đến ngày', type: 'date', value: filters.dateTo },
        ]}
        onChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
        onReset={() => setFilters(EMPTY_FILTERS)}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6"><div className="flex items-center gap-4"><div className="rounded-xl bg-blue-50 p-3 text-blue-600"><CheckCircle2 className="h-6 w-6" /></div><div><p className="text-sm font-medium text-slate-500">Lead đủ điều kiện</p><p className="text-2xl font-bold text-slate-900">{summary.total_qualified_leads}</p></div></div></div>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6"><div className="flex items-center gap-4"><div className="rounded-xl bg-slate-50 p-3 text-slate-600"><Building2 className="h-6 w-6" /></div><div><p className="text-sm font-medium text-slate-500">Tổng Bounty Cty trả</p><p className="text-2xl font-bold text-slate-900">{Number(summary.total_company_bounty || 0).toLocaleString()}đ</p></div></div></div>
        <div className="rounded-2xl border-t-4 border-red-500 bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6"><div className="flex items-center gap-4"><div className="rounded-xl bg-red-50 p-3 text-red-600"><Wallet className="h-6 w-6" /></div><div><p className="text-sm font-medium text-slate-500">Nền tảng thu</p><p className="text-2xl font-bold text-red-600">{Number(summary.total_platform_fees_20_percent || 0).toLocaleString()}đ</p></div></div></div>
        <div className="rounded-2xl border-t-4 border-green-500 bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6"><div className="flex items-center gap-4"><div className="rounded-xl bg-green-50 p-3 text-green-600"><ArrowRightLeft className="h-6 w-6" /></div><div><p className="text-sm font-medium text-slate-500">Chi trả CTV</p><p className="text-2xl font-bold text-green-600">{Number(summary.total_ctv_payouts_80_percent || 0).toLocaleString()}đ</p></div></div></div>
      </div>

      {!split_verification.math_check && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
          <div><h4 className="text-sm font-bold text-red-800">Cảnh báo lệch dữ liệu đối soát!</h4><p className="mt-1 text-sm text-red-700">Tổng Platform Fee + CTV Payout không khớp với Tổng Bounty công ty trả.</p></div>
        </div>
      )}

      <div className="grid gap-3 md:hidden">
        {filteredQualifiedLeads.map((lead) => (
          <article key={lead.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2"><span className="font-mono text-xs font-bold text-slate-600">{lead.lead_code}</span><span className="text-xs text-slate-500">{new Date(lead.qualified_at).toLocaleDateString('vi-VN')}</span></div>
            <h3 className="font-semibold text-slate-900">{lead.campaign_title}</h3>
            <p className="text-sm text-slate-500">{lead.company_name} · {lead.ctv_name || 'Direct'}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs"><div><p className="text-slate-500">Bounty</p><p className="font-bold">{Number(lead.bounty_amount || 0).toLocaleString()}đ</p></div><div><p className="text-red-500">Platform</p><p className="font-bold text-red-600">{Number(lead.platform_fee_amount || 0).toLocaleString()}đ</p></div><div><p className="text-green-600">CTV</p><p className="font-bold text-green-700">{Number(lead.ctv_reward_amount || 0).toLocaleString()}đ</p></div></div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 md:block">
        <div className="border-b border-slate-200 px-6 py-4"><h3 className="font-semibold text-slate-900">Chi tiết Lead đủ điều kiện</h3></div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50"><tr><th className={TH_CLASS}>Mã Lead</th><th className={TH_CLASS}>Ngày Qualified</th><th className={TH_CLASS}>Nguồn</th><th className={TH_CLASS}>Chiến dịch / Công ty</th><th className={`${TH_CLASS} text-right`}>Tổng Bounty</th><th className={`${TH_CLASS} text-right text-red-700`}>Platform</th><th className={`${TH_CLASS} text-right text-green-700`}>CTV</th></tr></thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredQualifiedLeads.map((lead) => (
                <tr key={lead.id} className="transition-colors hover:bg-slate-50"><td className={TD_CLASS}><span className="font-mono text-xs text-slate-600">{lead.lead_code}</span></td><td className={TD_CLASS}>{new Date(lead.qualified_at).toLocaleDateString('vi-VN')}</td><td className={TD_CLASS}><span className="font-medium">{lead.ctv_name || 'Direct'}</span></td><td className={TD_CLASS}><div className="max-w-[200px] truncate text-slate-900">{lead.campaign_title}</div><div className="max-w-[200px] truncate text-xs text-slate-500">{lead.company_name}</div></td><td className={`${TD_CLASS} text-right font-medium`}>{Number(lead.bounty_amount || 0).toLocaleString()}đ</td><td className={`${TD_CLASS} text-right font-medium text-red-600`}>{Number(lead.platform_fee_amount || 0).toLocaleString()}đ</td><td className={`${TD_CLASS} text-right font-medium text-green-600`}>{Number(lead.ctv_reward_amount || 0).toLocaleString()}đ</td></tr>
              ))}
              {filteredQualifiedLeads.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">Không có dữ liệu phù hợp bộ lọc.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
