import { AlertTriangle, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { LeadDetailsModal } from './components/LeadDetailsModal';
import { AdminMobileBottomNav } from './components/AdminMobileBottomNav';
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
    setCtvSearch,
    setCtvStatusFilter,
    setCompanySearch,
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
        return <AdminOverviewTab campaigns={campaigns} leads={leads} ctvAccounts={ctvAccounts} companyAccounts={companyAccounts} taxReport={taxReport} />;
      case 'CTV':
        return <AdminCtvTab ctvAccounts={filteredCtvAccounts} onSearch={setCtvSearch} onFilter={setCtvStatusFilter} onAction={handleGenericAction} />;
      case 'Công ty':
        return <AdminCompanyTab companyAccounts={filteredCompanyAccounts} onSearch={setCompanySearch} onFilter={setCompanyStatusFilter} onAction={handleGenericAction} onUpdate={handleCompanyUpdate} onDelete={handleCompanyDelete} />;
      case 'Chiến dịch':
        return <AdminCampaignTab campaigns={campaigns} onAction={handleGenericAction} />;
      case 'Lead':
        return <AdminLeadTab leads={leads} pagination={leadsPagination} filters={leadFilters} loading={leadsLoading} campaigns={campaigns} companyAccounts={companyAccounts} ctvAccounts={ctvAccounts} onSearchChange={handleLeadSearchChange} onFilterChange={handleLeadFilterChange} onPageChange={handleLeadPageChange} onViewDetails={(lead) => setSelectedLead(lead)} />;
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
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-slate-900">
        <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
          <div className="mb-5 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-700">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h2 className="text-2xl font-black text-slate-900">VLGN Admin</h2>
            <p className="mt-1 text-sm text-slate-500">Bảng quản trị riêng cho nội bộ</p>
          </div>
          {loginError && (
            <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-4">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-500" />
                <div>
                  <h3 className="text-sm font-bold text-red-800">Không đăng nhập được</h3>
                  <p className="mt-1 text-sm text-red-700">{loginError}</p>
                </div>
              </div>
            </div>
          )}
          <div className="space-y-4">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email quản trị" autoComplete="username" className="min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-base outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-100" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mật khẩu" autoComplete="current-password" className="min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-base outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-100" />
            <button onClick={handleLogin} className="min-h-12 w-full rounded-2xl bg-red-700 px-4 font-black text-white transition-all hover:bg-red-800 disabled:bg-red-300" disabled={loginLoading || !email || !password}>
              {loginLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : 'Đăng nhập'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 text-slate-600 shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin text-red-700" />
          <span>Đang tải dữ liệu...</span>
        </div>
      </div>
    );
  }

  const token = localStorage.getItem('vlgn_admin_session');

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-100 pb-[calc(env(safe-area-inset-bottom)+76px)] md:pb-0">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6">
          <div className="flex items-center justify-between gap-3 py-3 sm:py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-700">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-black text-slate-900 sm:text-2xl">Admin Console</h1>
                <p className="truncate text-xs text-slate-500 sm:text-sm">{session?.email || 'VLGN Internal Management'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => token && fetchData(token)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-100 px-3 text-sm font-bold text-slate-700 hover:bg-slate-200">
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">Tải lại</span>
              </button>
              <button onClick={handleLogout} className="min-h-10 rounded-xl bg-slate-900 px-3 text-sm font-bold text-white hover:bg-slate-800 sm:px-4">Đăng xuất</button>
            </div>
          </div>

          <div className="hidden border-t border-slate-100 md:block">
            <nav className="-mb-px flex space-x-6 overflow-x-auto">
              {TABS.map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-bold ${activeTab === tab ? 'border-red-600 text-red-700' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'}`}>{tab}</button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8">
        <div className="mb-4 md:hidden">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Tab hiện tại</p>
          <h2 className="text-2xl font-black text-slate-900">{activeTab}</h2>
        </div>

        {error && (
          <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-red-100 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 flex-shrink-0 text-red-500" />
              <div><h3 className="font-semibold text-red-900">Lỗi dữ liệu</h3><p className="text-sm text-red-700">{error}</p></div>
            </div>
            <button onClick={() => token && fetchData(token)} className="min-h-10 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700">Tải lại dữ liệu</button>
          </div>
        )}

        {renderTabContent()}
      </main>

      <AdminMobileBottomNav activeTab={activeTab} onChange={setActiveTab} />

      {selectedLead && <LeadDetailsModal lead={selectedLead} history={selectedLeadHistory} onClose={() => setSelectedLead(null)} onStatusChange={handleLeadStatusChange} onAddNote={handleLeadAddNote} />}
    </div>
  );
}
