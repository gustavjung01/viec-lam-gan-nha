import { useEffect, useRef, useState } from 'react';
import { TABS } from './types';
import type {
  AuditLog,
  Campaign,
  CTVAccount,
  CompanyAccount,
  Lead,
  LeadFilters,
  LeadStatusHistory,
  TaxReport,
} from './types';

const API_URL = '/api';
const ADMIN_LEAD_REFRESH_MS = 15000;

const buildLeadQuery = (page: number, limit: number, filters: LeadFilters) => {
  const query = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (filters.search) query.append('search', filters.search);
  if (filters.status !== 'all') query.append('status', filters.status);
  if (filters.campaignId !== 'all') query.append('campaign_id', filters.campaignId);
  if (filters.companyId !== 'all') query.append('company_id', filters.companyId);
  if (filters.ctvId !== 'all') query.append('ctv_id', filters.ctvId);
  if (filters.province.trim()) query.append('province', filters.province.trim());
  if (filters.district.trim()) query.append('district', filters.district.trim());
  if (filters.dateFrom) query.append('date_from', filters.dateFrom);
  if (filters.dateTo) query.append('date_to', filters.dateTo);

  return query;
};

const isAdminFormControlFocused = () => {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement;
  if (!active) return false;

  return (
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    active instanceof HTMLSelectElement ||
    (active instanceof HTMLElement && active.isContentEditable)
  );
};

const adminFetch = async (token: string, path: string, options: RequestInit = {}) => {
  const headers = {
    ...options.headers,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (response.status === 401 || response.status === 403) {
    throw new Error('UNAUTHORIZED');
  }
  return response;
};

export function useAdminConsole() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(TABS[0]);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsPagination, setLeadsPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [leadFilters, setLeadFilters] = useState<LeadFilters>({
    search: '',
    status: 'all',
    campaignId: 'all',
    companyId: 'all',
    ctvId: 'all',
    province: '',
    district: '',
    dateFrom: '',
    dateTo: '',
  });
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedLeadHistory, setSelectedLeadHistory] = useState<LeadStatusHistory[]>([]);

  const [ctvAccounts, setCtvAccounts] = useState<CTVAccount[]>([]);
  const [companyAccounts, setCompanyAccounts] = useState<CompanyAccount[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [taxReport, setTaxReport] = useState<TaxReport | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [ctvSearch, setCtvSearch] = useState('');
  const [ctvStatusFilter, setCtvStatusFilter] = useState('all');
  const [companySearch, setCompanySearch] = useState('');
  const [companyStatusFilter, setCompanyStatusFilter] = useState('all');

  const searchTimeoutRef = useRef<any>(null);
  const adminLeadRefreshInFlightRef = useRef(false);

  const clearLeadSearchTimer = () => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    const storedSession = localStorage.getItem('vlgn_admin_session');
    if (!storedSession) {
      setLoading(false);
      return;
    }

    adminFetch(storedSession, '/admin/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setSession(data.user);
          fetchData(storedSession);
        } else {
          handleLogout();
        }
      })
      .catch(() => handleLogout());
  }, []);

  const fetchLeads = async (
    page = leadsPagination.page,
    limit = leadsPagination.limit,
    filters: LeadFilters = leadFilters,
  ) => {
    const token = localStorage.getItem('vlgn_admin_session');
    if (!token) return;

    try {
      setLeadsLoading(true);
      const query = buildLeadQuery(page, limit, filters);
      const res = await adminFetch(token, `/admin/leads?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.data);
        setLeadsPagination(data.pagination || { page, limit, total: data.data.length, totalPages: 1 });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLeadsLoading(false);
    }
  };

  const fetchLeadHistory = async (leadId: string) => {
    const token = localStorage.getItem('vlgn_admin_session');
    if (!token) return;

    try {
      const res = await adminFetch(token, `/admin/leads/${leadId}/history`);
      if (res.ok) {
        const data = await res.json();
        setSelectedLeadHistory(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load lead history:', err);
      setSelectedLeadHistory([]);
    }
  };

  const refreshAdminLeadsSilently = async (force = false) => {
    const token = localStorage.getItem('vlgn_admin_session');
    if (!token || activeTab !== 'Lead' || adminLeadRefreshInFlightRef.current) return;
    if (!force && (searchTimeoutRef.current || isAdminFormControlFocused())) return;

    adminLeadRefreshInFlightRef.current = true;
    try {
      const page = leadsPagination.page;
      const limit = leadsPagination.limit;
      const query = buildLeadQuery(page, limit, leadFilters);
      const res = await adminFetch(token, `/admin/leads?${query.toString()}`, { cache: 'no-store' });
      if (!res.ok) return;

      const data = await res.json();
      if (!data.success || !Array.isArray(data.data)) return;

      setLeads(data.data);
      setLeadsPagination(data.pagination || { page, limit, total: data.data.length, totalPages: 1 });

      if (selectedLead?.id) {
        const freshLead = data.data.find((lead: Lead) => lead.id === selectedLead.id);
        if (freshLead) setSelectedLead((prev) => (prev ? { ...prev, ...freshLead } : prev));
        void fetchLeadHistory(selectedLead.id);
      }
    } catch (err) {
      console.error('Admin lead soft refresh failed:', err);
    } finally {
      adminLeadRefreshInFlightRef.current = false;
    }
  };

  const fetchData = async (token: string) => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const responses = await Promise.all([
        adminFetch(token, '/admin/campaigns'),
        adminFetch(token, '/admin/leads?page=1&limit=10'),
        adminFetch(token, '/admin/all-ctv'),
        adminFetch(token, '/admin/all-companies'),
        adminFetch(token, '/admin/audit-logs?limit=10'),
        adminFetch(token, '/admin/tax-report'),
      ]);

      const [campaignsRes, leadsRes, ctvRes, companyRes, logsRes, taxRes] = responses;

      if (campaignsRes.ok) setCampaigns((await campaignsRes.json()).data);
      if (leadsRes.ok) {
        const data = await leadsRes.json();
        setLeads(data.data);
        if (data.pagination) setLeadsPagination(data.pagination);
      }
      if (ctvRes.ok) setCtvAccounts((await ctvRes.json()).data);
      if (companyRes.ok) setCompanyAccounts((await companyRes.json()).data);
      if (logsRes.ok) setAuditLogs((await logsRes.json()).data);
      if (taxRes.ok) {
        const taxData = await taxRes.json();
        const payload = taxData.data || {};
        const normalizedTaxReport = payload.summary && Array.isArray(payload.qualified_leads)
          ? payload
          : {
              summary: {
                total_qualified_leads: payload.total_qualified_leads || 0,
                total_company_bounty: payload.total_company_charged || payload.total_company_bounty || 0,
                total_platform_fees_20_percent: payload.total_platform_revenue || payload.total_platform_fees_20_percent || 0,
                total_ctv_payouts_80_percent: payload.total_ctv_payable || payload.total_ctv_payouts_80_percent || 0,
              },
              qualified_leads: payload.qualified_leads || [],
              platform_fees: payload.platform_fees || [],
              ctv_payouts: payload.ctv_payouts || [],
              pending_company_debt: payload.pending_company_debt || [],
              split_verification: payload.split_verification || { math_check: true },
              period: payload.period,
            };
        setTaxReport(normalizedTaxReport);
      }

      if (!campaignsRes.ok || !leadsRes.ok || !ctvRes.ok || !companyRes.ok || !logsRes.ok || !taxRes.ok) {
        const errorData = await (
          campaignsRes.ok ? leadsRes.ok ? ctvRes.ok ? companyRes.ok ? logsRes.ok ? taxRes : logsRes : companyRes : ctvRes : leadsRes : campaignsRes
        ).json();
        throw new Error(`Không thể tải được dữ liệu admin: ${errorData.message || 'Lỗi API'}`);
      }
    } catch (err: any) {
      console.error('API Error:', err);
      if (err.message === 'UNAUTHORIZED') {
        setError('Phiên đăng nhập hết hạn hoặc không hợp lệ.');
        handleLogout();
      } else {
        setError(err.message || 'Không thể kết nối đến server.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      const response = await fetch(`${API_URL}/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (data.success) {
        localStorage.setItem('vlgn_admin_session', data.token);
        setSession({ email, role: 'super_admin' });
        fetchData(data.token);
      } else {
        setLoginError(data.message || 'Đăng nhập thất bại.');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Lỗi kết nối đến server.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    clearLeadSearchTimer();
    localStorage.removeItem('vlgn_admin_session');
    setSession(null);
    setEmail('');
    setPassword('');
    setCampaigns([]);
    setLeads([]);
    setCtvAccounts([]);
    setCompanyAccounts([]);
    setAuditLogs([]);
    setTaxReport(null);
    setLoading(false);
  };

  const handleGenericAction = async (actionName: string, endpoint: string, body?: any) => {
    const token = localStorage.getItem('vlgn_admin_session');
    if (!token) return;

    try {
      const path = endpoint.replace('/api', '');
      const options: RequestInit = { method: 'POST' };
      // Tự động thêm admin_id vào body
      const requestBody = {
        ...body,
        admin_id: session?.id || session?.email || 'admin'
      };
      options.body = JSON.stringify(requestBody);

      const res = await adminFetch(token, path, options);
      const data = await res.json();
      if (data.success) {
        alert(`${actionName} thành công!`);
        fetchData(token);
      } else {
        alert(`Lỗi: ${data.message}`);
      }
    } catch (err: any) {
      alert(`Lỗi kết nối: ${err.message}`);
    }
  };

  const handleCompanyUpdate = async (companyId: string, body: Partial<CompanyAccount>) => {
    const token = localStorage.getItem('vlgn_admin_session');
    if (!token) return;

    try {
      const res = await adminFetch(token, `/admin/company/${companyId}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...body,
          admin_id: session?.id || session?.email || 'admin'
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Khong the cap nhat cong ty');
      }

      alert('Cap nhat cong ty thanh cong!');
      fetchData(token);
    } catch (err: any) {
      alert(`Loi: ${err.message}`);
      throw err;
    }
  };

  const handleCompanyDelete = async (companyId: string) => {
    const token = localStorage.getItem('vlgn_admin_session');
    if (!token) return;

    try {
      const res = await adminFetch(token, `/admin/company/${companyId}`, {
        method: 'DELETE',
        body: JSON.stringify({
          admin_id: session?.id || session?.email || 'admin'
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.error === 'COMPANY_HAS_DATA' && data.dependencies) {
          const deps = data.dependencies;
          throw new Error(
            `Cong ty dang co du lieu: ${deps.campaigns || 0} chien dich, ${deps.claimedLeads || 0} lead, ${deps.walletTransactions || 0} giao dich. Hay khoa cong ty thay vi xoa.`
          );
        }
        throw new Error(data.message || data.error || 'Khong the xoa cong ty');
      }

      alert('Xoa cong ty thanh cong!');
      fetchData(token);
    } catch (err: any) {
      alert(`Loi: ${err.message}`);
      throw err;
    }
  };

  useEffect(() => {
    if (!selectedLead?.id) {
      setSelectedLeadHistory([]);
      return;
    }

    fetchLeadHistory(selectedLead.id);
  }, [selectedLead?.id]);

  useEffect(() => {
    if (!session || activeTab !== 'Lead') return;

    const runRefresh = () => {
      if (document.visibilityState === 'visible') void refreshAdminLeadsSilently();
    };

    runRefresh();
    const timer = window.setInterval(runRefresh, ADMIN_LEAD_REFRESH_MS);

    const handleFocus = () => runRefresh();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') runRefresh();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session, activeTab, leadsPagination.page, leadsPagination.limit, leadFilters, selectedLead?.id]);

  const handleLeadStatusChange = async (leadId: string, newStatus: string, reason?: string) => {
    const token = localStorage.getItem('vlgn_admin_session');
    if (!token) return;

    const actionMap: Record<string, 'approve' | 'reject'> = {
      approved: 'approve',
      rejected: 'reject',
    };

    const action = actionMap[newStatus];

    if (!action) {
      alert('Admin chỉ duyệt hoặc từ chối lead. Các trạng thái sau đó do công ty xử lý.');
      return;
    }

    try {
      const res = await adminFetch(token, `/admin/leads/${leadId}/verify`, {
        method: 'POST',
        body: JSON.stringify({
          action,
          reason,
          admin_id: session?.id || session?.email || 'admin'
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Không thể cập nhật trạng thái lead');
      }

      await Promise.all([
        refreshAdminLeadsSilently(true),
        selectedLead?.id === leadId ? fetchLeadHistory(leadId) : Promise.resolve(),
      ]);

      if (selectedLead?.id === leadId) {
        setSelectedLead((prev) => (prev ? { ...prev, status: newStatus } : prev));
      }
    } catch (err: any) {
      alert(err.message || 'Không thể cập nhật trạng thái lead');
    }
  };

  const handleLeadAddNote = async (leadId: string, note: string) => {
    const token = localStorage.getItem('vlgn_admin_session');
    if (!token) return;

    try {
      const res = await adminFetch(token, `/admin/leads/${leadId}/note`, {
        method: 'POST',
        body: JSON.stringify({
          note,
          admin_id: session?.id || session?.email || 'admin'
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Không thể lưu ghi chú');
      }

      await Promise.all([
        refreshAdminLeadsSilently(true),
        selectedLead?.id === leadId ? fetchLeadHistory(leadId) : Promise.resolve(),
      ]);

      if (selectedLead?.id === leadId) {
        setSelectedLead((prev) => (prev ? { ...prev, notes: note, processed_by: session?.email || session?.id || 'admin' } : prev));
      }
    } catch (err: any) {
      alert(err.message || 'Không thể lưu ghi chú');
    }
  };

  const safeText = (val: any) => String(val || '').toLowerCase();

  const filteredCtvAccounts = ctvAccounts
    .filter((ctv) => ctvStatusFilter === 'all' || ctv.status === ctvStatusFilter)
    .filter(
      (ctv) =>
        safeText(ctv.name).includes(safeText(ctvSearch)) ||
        safeText(ctv.phone).includes(safeText(ctvSearch)) ||
        safeText(ctv.email).includes(safeText(ctvSearch)),
    );

  const filteredCompanyAccounts = companyAccounts
    .filter((company) => companyStatusFilter === 'all' || company.status === companyStatusFilter)
    .filter(
      (company) =>
        safeText(company.name).includes(safeText(companySearch)) ||
        safeText(company.phone).includes(safeText(companySearch)) ||
        safeText(company.email).includes(safeText(companySearch)),
    );

  const handleLeadSearchChange = (value: string) => {
    const nextFilters = { ...leadFilters, search: value };
    setLeadFilters(nextFilters);
    clearLeadSearchTimer();
    searchTimeoutRef.current = setTimeout(() => {
      searchTimeoutRef.current = null;
      fetchLeads(1, leadsPagination.limit, nextFilters);
    }, 500);
  };

  const handleLeadFilterChange = (key: keyof LeadFilters, value: string) => {
    const nextFilters = { ...leadFilters, [key]: value } as LeadFilters;
    setLeadFilters(nextFilters);
    clearLeadSearchTimer();
    fetchLeads(1, leadsPagination.limit, nextFilters);
  };

  const handleLeadPageChange = (page: number) => {
    clearLeadSearchTimer();
    fetchLeads(page, leadsPagination.limit, leadFilters);
  };

  return {
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
    selectedLeadHistory,
    handleLeadStatusChange,
    handleLeadAddNote,
    handleLeadSearchChange,
    handleLeadFilterChange,
    handleLeadPageChange,
  };
}
