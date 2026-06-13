import { Download, Wallet, ArrowRightLeft, Building2, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { TaxReport } from '../types';
import { TH_CLASS, TD_CLASS } from '../types';

interface AdminFinanceTabProps {
  taxReport: TaxReport | null;
}

export function AdminFinanceTab({ taxReport }: AdminFinanceTabProps) {
  if (!taxReport) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <p className="text-slate-500">Chưa có dữ liệu báo cáo tài chính.</p>
      </div>
    );
  }

  const summary = taxReport.summary ?? {
    total_qualified_leads: 0,
    total_company_bounty: 0,
    total_platform_fees_20_percent: 0,
    total_ctv_payouts_80_percent: 0,
  };

  const split_verification = taxReport.split_verification ?? {
    math_check: true,
  };

  const handleExportCSV = () => {
    // Basic CSV export functionality
    const headers = ['Ma Lead', 'Ngay', 'Chien Dich', 'Cong Ty', 'CTV', 'Tong Bounty', 'Platform Fee (20%)', 'CTV Payout (80%)'];
    const rows = (taxReport.qualified_leads || []).map(lead => [
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Báo cáo tài chính nội bộ</h2>
          <p className="text-sm text-slate-500">Dữ liệu phân bổ hoa hồng (Split 20/80)</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Download className="h-4 w-4" />
          Xuất Excel/CSV
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Qualified Leads */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Lead đủ điều kiện</p>
              <p className="text-2xl font-bold text-slate-900">{summary.total_qualified_leads}</p>
            </div>
          </div>
        </div>

        {/* Total Bounty */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-slate-50 p-3 text-slate-600">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Tổng Bounty Cty trả</p>
              <p className="text-2xl font-bold text-slate-900">{Number(summary.total_company_bounty || 0).toLocaleString()}đ</p>
            </div>
          </div>
        </div>

        {/* Platform Fee (20%) */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 border-t-4 border-red-500">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-red-50 p-3 text-red-600">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Nền tảng thu (20%)</p>
              <p className="text-2xl font-bold text-red-600">{Number(summary.total_platform_fees_20_percent || 0).toLocaleString()}đ</p>
            </div>
          </div>
        </div>

        {/* CTV Payouts (80%) */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 border-t-4 border-green-500">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-green-50 p-3 text-green-600">
              <ArrowRightLeft className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Chi trả CTV (80%)</p>
              <p className="text-2xl font-bold text-green-600">{Number(summary.total_ctv_payouts_80_percent || 0).toLocaleString()}đ</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Verification Warning */}
      {split_verification && !split_verification.math_check && (
         <div className="rounded-xl bg-red-50 p-4 border border-red-200 flex items-start gap-3">
           <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
           <div>
             <h4 className="text-sm font-bold text-red-800">Cảnh báo lệch dữ liệu đối soát!</h4>
             <p className="text-sm text-red-700 mt-1">Tổng Platform Fee + CTV Payout không khớp với Tổng Bounty công ty trả. Vui lòng kiểm tra lại cấu hình chiến dịch.</p>
           </div>
         </div>
      )}

      {/* Details Table */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
         <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900">Chi tiết Lead đủ điều kiện</h3>
         </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className={TH_CLASS}>Mã Lead</th>
                <th scope="col" className={TH_CLASS}>Ngày Qualified</th>
                <th scope="col" className={TH_CLASS}>Nguồn</th>
                <th scope="col" className={TH_CLASS}>Chiến dịch / Công ty</th>
                <th scope="col" className={`${TH_CLASS} text-right`}>Tổng Bounty</th>
                <th scope="col" className={`${TH_CLASS} text-right text-red-700`}>Platform (20%)</th>
                <th scope="col" className={`${TH_CLASS} text-right text-green-700`}>CTV (80%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {(taxReport.qualified_leads || []).map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                  <td className={TD_CLASS}>
                    <span className="font-mono text-xs text-slate-600">{lead.lead_code}</span>
                  </td>
                  <td className={TD_CLASS}>
                    {new Date(lead.qualified_at).toLocaleDateString('vi-VN')}
                  </td>
                  <td className={TD_CLASS}>
                    <span className="font-medium">{lead.ctv_name || 'Direct'}</span>
                  </td>
                  <td className={TD_CLASS}>
                    <div className="truncate max-w-[200px] text-slate-900">{lead.campaign_title}</div>
                    <div className="truncate max-w-[200px] text-xs text-slate-500">{lead.company_name}</div>
                  </td>
                  <td className={`${TD_CLASS} text-right font-medium`}>
                    {Number(lead.bounty_amount || 0).toLocaleString()}đ
                  </td>
                  <td className={`${TD_CLASS} text-right text-red-600 font-medium`}>
                    {Number(lead.platform_fee_amount || 0).toLocaleString()}đ
                  </td>
                  <td className={`${TD_CLASS} text-right text-green-600 font-medium`}>
                    {Number(lead.ctv_reward_amount || 0).toLocaleString()}đ
                  </td>
                </tr>
              ))}
              {(!taxReport.qualified_leads || taxReport.qualified_leads.length === 0) && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                    Chưa có lead nào đủ điều kiện thanh toán.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
