import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';
import { LeadDetailsModal } from './components/LeadDetailsModal';
import { AdminCampaignTab } from './tabs/AdminCampaignTab';
import { AdminCompanyTab } from './tabs/AdminCompanyTab';
import { AdminConfigTab } from './tabs/AdminConfigTab';
import { AdminCtvTab } from './tabs/AdminCtvTab';
import { AdminFinanceTab } from './tabs/AdminFinanceTab';
import { AdminLeadTab } from './tabs/AdminLeadTab';
import { AdminOverviewTab } from './tabs/AdminOverviewTab';
import { useAdminConsole } from './useAdminConsole';
import { TABS } from './types';

export function AdminConsolePage() {
  const {
    session,
    email,
    setEmail,
    password,
    setPassword,
    loginLoading,
    loginError,
    activeTab,
    setActiveTab,
    campaigns,
    leads,
    leadsPagination,
    leadFilters,
    leadsLoading,
    selectedLead,
    selectedLeadHistory,
    setSelectedLead,
    ctvAccounts,
    companyAccounts,
    taxReport,
    loading,
    error,
    ctvSearch,
    setCtvSearch,
    ctvStatusFilter,
    setCtvStatusFilter,
    companySearch,
    setCompanySearch,
    companyStatusFilter,
    setCompanyStatusFilter,
    filteredCtvAccounts,
    filteredCompanyAccounts,
    handleLogin,
    handleLogout,
    fetchData,
    handleGenericAction,
    handleCompanyUpdate,
    handleCompanyDelete,
    handleLeadStatusChange,
    handleLeadAddNote,
    handleLeadSearchChange,
    handleLeadFilterChange,
    handleLeadPageChange,
  } = useAdminConsole();

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Tổng quan':
        return (
          <AdminOverviewTab
            campaigns={campaigns}
            leads={leads}
            ctvAccounts={ctvAccounts}
            companyAccounts={companyAccounts}
            taxReport={taxReport}
          />
        );
      case 'CTV':
        return (
          <AdminCtvTab 
            ctvAccounts={filteredCtvAccounts} 
            onSearch={setCtvSearch} 
            onFilter={setCtvStatusFilter} 
            onAction={handleGenericAction} 
          />
        );
      case 'Công ty':
        return (
          <AdminCompanyTab 
            companyAccounts={filteredCompanyAccounts} 
            onSearch={setCompanySearch} 
            onFilter={setCompanyStatusFilter} 
            onAction={handleGenericAction} 
            onUpdate={handleCompanyUpdate}
            onDelete={handleCompanyDelete}
          />
        );
      case 'Chiến dịch':
        return (
          <AdminCampaignTab 
            campaigns={campaigns} 
            onAction={handleGenericAction} 
          />
        );
      case 'Lead':
        return (
          <AdminLeadTab
            leads={leads}
            pagination={leadsPagination}
            filters={leadFilters}
            loading={leadsLoading}
            campaigns={campaigns}
            companyAccounts={companyAccounts}
            ctvAccounts={ctvAccounts}
            onSearchChange={handleLeadSearchChange}
            onFilterChange={handleLeadFilterChange}
            onPageChange={handleLeadPageChange}
            onViewDetails={(lead) => setSelectedLead(lead)}
          />
        );
      case 'Tài chính nội bộ':
        return <AdminFinanceTab taxReport={taxReport} />;
      case 'Cấu hình':
        return <AdminConfigTab />;
      default:
        return null;
    }
  };

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
          <h2 className="mb-4 text-center text-2xl font-bold text-slate-900">Đăng nhập quản trị</h2>
          {loginError && (
            <div className="mb-4 rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-400" aria-hidden="true" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Lỗi</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{loginError}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email quản trị"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none transition-all focus:border-red-500"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mật khẩu"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none transition-all focus:border-red-500"
            />
            <button
              onClick={handleLogin}
              className="w-full rounded-xl bg-red-600 px-4 py-3 font-bold text-white transition-all hover:bg-red-700 disabled:bg-red-300"
              disabled={loginLoading || !email || !password}
            >
              {loginLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : 'Đăng nhập'}
            </button>
          </div>
        </div>
      </div>
    );
  }

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

  return (
    <div className="min-h-screen bg-slate-100 overflow-x-hidden">
      <div className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-red-100 p-3 text-red-600">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Admin Console</h1>
                <p className="text-slate-500">VLGN Internal Management</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-xl bg-slate-200 px-4 py-2 font-semibold text-slate-800 hover:bg-slate-300"
            >
              Đăng xuất
            </button>
          </div>

          <div className="border-b border-slate-200">
            <nav className="-mb-px flex space-x-6 overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium ${
                    activeTab === tab
                      ? 'border-red-500 text-red-600'
                      : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        {error && (
          <div className="mb-6 flex items-center justify-between rounded-2xl bg-red-50 p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-red-500" />
              <div>
                <h3 className="font-semibold text-red-900">Lỗi dữ liệu</h3>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
            <button
              onClick={() => {
                const token = localStorage.getItem('vlgn_admin_session');
                if (token) fetchData(token);
              }}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Tải lại dữ liệu
            </button>
          </div>
        )}

        {renderTabContent()}
      </main>

      {selectedLead && (
        <LeadDetailsModal
          lead={selectedLead}
          history={selectedLeadHistory}
          onClose={() => setSelectedLead(null)}
          onStatusChange={handleLeadStatusChange}
          onAddNote={handleLeadAddNote}
        />
      )}
    </div>
  );
}
