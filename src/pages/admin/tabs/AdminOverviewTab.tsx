import { Briefcase, Users, Building2, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { Campaign, Lead, CTVAccount, CompanyAccount, TaxReport } from '../types';

interface AdminOverviewTabProps {
  campaigns: Campaign[];
  leads: Lead[];
  ctvAccounts: CTVAccount[];
  companyAccounts: CompanyAccount[];
  taxReport: TaxReport | null;
}

export function AdminOverviewTab({ campaigns, leads, ctvAccounts, companyAccounts, taxReport }: AdminOverviewTabProps) {
  const pendingCtvCount = ctvAccounts.filter(c => c.status === 'pending').length;
  const pendingCompanyCount = companyAccounts.filter(c => c.status === 'pending').length;
  
  // Stats calculation logic could be moved to backend for larger datasets, 
  // but keeping it simple for now based on current structure.
  const activeCampaignsCount = campaigns.filter(c => c.status === 'active').length;
  const disputedLeadsCount = leads.filter(l => l.status === 'disputed').length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Campaign Stats */}
        <div className="rounded-2xl border-l-4 border-blue-500 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="truncate">
              <p className="text-sm font-medium text-slate-500">Chiến dịch đang chạy</p>
              <p className="mt-2 text-3xl font-bold text-slate-900 truncate">
                {activeCampaignsCount}/{campaigns.length}
              </p>
            </div>
            <div className="rounded-xl bg-blue-50 p-2">
              <Briefcase className="h-6 w-6 text-blue-500" />
            </div>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div 
              className="h-full bg-blue-500 transition-all" 
              style={{ width: `${Math.min((activeCampaignsCount / Math.max(campaigns.length, 1)) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Lead Stats */}
        <div className="rounded-2xl border-l-4 border-indigo-500 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="truncate">
              <p className="text-sm font-medium text-slate-500">Tổng Lead</p>
              <p className="mt-2 text-3xl font-bold text-slate-900 truncate">{leads.length}</p>
            </div>
            <div className="rounded-xl bg-indigo-50 p-2">
              <Users className="h-6 w-6 text-indigo-500" />
            </div>
          </div>
        </div>

        {/* CTV Stats */}
        <div className="rounded-2xl border-l-4 border-amber-500 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="truncate">
              <p className="text-sm font-medium text-slate-500">CTV chờ duyệt</p>
              <p className="mt-2 text-3xl font-bold text-amber-600 truncate">{pendingCtvCount}</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-2">
              <ShieldCheck className="h-6 w-6 text-amber-500" />
            </div>
          </div>
          {pendingCtvCount > 0 && (
             <p className="mt-4 text-xs font-medium text-amber-600">Cần xử lý ngay</p>
          )}
        </div>

        {/* Company Stats */}
        <div className="rounded-2xl border-l-4 border-rose-500 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="truncate">
              <p className="text-sm font-medium text-slate-500">Công ty chờ duyệt</p>
              <p className="mt-2 text-3xl font-bold text-rose-600 truncate">{pendingCompanyCount}</p>
            </div>
            <div className="rounded-xl bg-rose-50 p-2">
              <Building2 className="h-6 w-6 text-rose-500" />
            </div>
          </div>
           {pendingCompanyCount > 0 && (
             <p className="mt-4 text-xs font-medium text-rose-600">Cần xử lý ngay</p>
          )}
        </div>
      </div>

      {/* Cảnh báo & Tranh chấp */}
      {(disputedLeadsCount > 0 || pendingCtvCount > 0 || pendingCompanyCount > 0) && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            <h3 className="text-lg font-semibold text-red-900">Cảnh báo & Cần xử lý</h3>
          </div>
          <div className="mt-4 space-y-2">
            {disputedLeadsCount > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm">
                <span className="font-medium text-slate-700">Lead đang tranh chấp (Disputed)</span>
                <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-bold text-red-700">{disputedLeadsCount}</span>
              </div>
            )}
             {pendingCtvCount > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm">
                <span className="font-medium text-slate-700">CTV đang chờ duyệt</span>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700">{pendingCtvCount}</span>
              </div>
            )}
            {pendingCompanyCount > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm">
                <span className="font-medium text-slate-700">Công ty đang chờ duyệt</span>
                <span className="rounded-full bg-rose-100 px-3 py-1 text-sm font-bold text-rose-700">{pendingCompanyCount}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
