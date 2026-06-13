type CompanyLead = {
  id: string;
  lead_code: string;
  status: string;
  claimed_by_company_id?: string | null;
  is_anonymous?: number | boolean;
  [key: string]: unknown;
};

type LeadAction = {
  from: string;
  to: string;
  label: string;
  message: string;
  kind?: 'primary' | 'danger';
  requireReason?: boolean;
};

declare global {
  interface Window {
    Clerk?: any;
    __VLGN_COMPANY_LEAD_WORKFLOW_BRIDGE__?: boolean;
  }
}

const API_URL = '/api';
const COMPANY_LEAD_REFRESH_MS = 15000;

const state: {
  companyId: string | null;
  clerkUserId: string | null;
  leadsByCode: Map<string, CompanyLead>;
  leadsById: Map<string, CompanyLead>;
  refreshInFlight: boolean;
} = {
  companyId: null,
  clerkUserId: null,
  leadsByCode: new Map(),
  leadsById: new Map(),
  refreshInFlight: false,
};

const FLOW: LeadAction[] = [
  {
    from: 'claimed',
    to: 'interviewing',
    label: 'Đang phỏng vấn',
    message: 'Chuyển lead sang trạng thái đang phỏng vấn?',
    kind: 'primary',
  },
  {
    from: 'interviewing',
    to: 'hired',
    label: 'Đã đi làm',
    message: 'Xác nhận ứng viên đã đi làm?',
    kind: 'primary',
  },
  {
    from: 'interviewing',
    to: 'disputed',
    label: 'Báo không đạt',
    message: 'Báo lead không đạt và gửi lý do cho admin?',
    kind: 'danger',
    requireReason: true,
  },
  {
    from: 'hired',
    to: 'disputed',
    label: 'Báo nghỉ / không đạt',
    message: 'Báo ứng viên nghỉ hoặc không đạt và gửi lý do cho admin?',
    kind: 'danger',
    requireReason: true,
  },
];

const STATUS_LABELS: Record<string, string> = {
  claimed: 'Đã nhận',
  interviewing: 'Đang phỏng vấn',
  hired: 'Đã đi làm',
  qualified: 'Đủ điều kiện',
  disputed: 'Chờ admin xử lý',
};

function normalizeUrl(input: RequestInfo | URL): URL | null {
  try {
    if (typeof input === 'string') return new URL(input, window.location.origin);
    if (input instanceof URL) return new URL(input.toString(), window.location.origin);
    if (input instanceof Request) return new URL(input.url, window.location.origin);
  } catch {
    return null;
  }
  return null;
}

function isAccountMeUrl(url: URL | null) {
  return url?.pathname === `${API_URL}/account/me`;
}

function isCompanyLeadListUrl(url: URL | null) {
  return url?.pathname === `${API_URL}/company/leads`;
}

function getClerkUserId() {
  const userId = window.Clerk?.user?.id || window.Clerk?.session?.user?.id || null;
  if (userId) state.clerkUserId = userId;
  return state.clerkUserId;
}

function publishLeadRefresh(leads: CompanyLead[]) {
  try {
    window.dispatchEvent(new CustomEvent('vlgn:company-leads-refreshed', { detail: { leads } }));
  } catch {
    // Best effort only. The bridge must not break the dashboard if CustomEvent fails.
  }
}

function rememberLeads(leads: CompanyLead[]) {
  for (const lead of leads) {
    if (lead.lead_code) state.leadsByCode.set(String(lead.lead_code), lead);
    if (lead.id) state.leadsById.set(String(lead.id), lead);
  }
  publishLeadRefresh(leads);
  scheduleInjectStatusActions();
}

function patchClaimedFilterForCurrentCompany(data: any) {
  if (!data?.success || !Array.isArray(data.data) || !state.companyId) return data;

  const clerkUserId = getClerkUserId();
  rememberLeads(data.data);

  if (!clerkUserId) return data;

  return {
    ...data,
    data: data.data.map((lead: CompanyLead) => {
      if (lead.claimed_by_company_id !== state.companyId) return lead;
      return {
        ...lead,
        // CompanyDashboardPage currently filters tab "Đã nhận" by Clerk user.id.
        // Keep display working until the large page can be refactored directly.
        claimed_by_company_id: clerkUserId,
        original_claimed_by_company_id: state.companyId,
      };
    }),
  };
}

function jsonResponse(data: any, response: Response) {
  const headers = new Headers(response.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function patchFetch() {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await originalFetch(input, init);
    const url = normalizeUrl(input);

    if (isAccountMeUrl(url)) {
      response
        .clone()
        .json()
        .then((data) => {
          const companyId = data?.data?.company?.id;
          if (companyId) state.companyId = String(companyId);
          getClerkUserId();
          if (companyId && isCompanyDashboardPage()) void refreshCompanyLeads();
        })
        .catch(() => undefined);
      return response;
    }

    if (isCompanyLeadListUrl(url) && response.ok) {
      try {
        const data = await response.clone().json();
        const patchedData = patchClaimedFilterForCurrentCompany(data);
        return jsonResponse(patchedData, response);
      } catch {
        return response;
      }
    }

    return response;
  };
}

function isCompanyDashboardPage() {
  return window.location.pathname.includes('/company') || window.location.pathname.includes('/cong-ty');
}

async function refreshCompanyLeads() {
  if (!isCompanyDashboardPage() || !state.companyId || state.refreshInFlight) return null;

  state.refreshInFlight = true;
  try {
    const response = await fetch(`${API_URL}/company/leads?company_id=${encodeURIComponent(state.companyId)}`, {
      cache: 'no-store',
    });
    if (!response.ok) return null;

    const data = await response.json();
    if (!data?.success || !Array.isArray(data.data)) return null;

    rememberLeads(data.data);
    return data.data as CompanyLead[];
  } catch {
    return null;
  } finally {
    state.refreshInFlight = false;
  }
}

let injectTimer: number | null = null;
function scheduleInjectStatusActions() {
  if (!isCompanyDashboardPage()) return;
  if (injectTimer) window.clearTimeout(injectTimer);
  injectTimer = window.setTimeout(injectStatusActions, 150);
}

function getRowLead(row: HTMLTableRowElement) {
  const leadCode = row.querySelector('td')?.textContent?.trim() || '';
  if (!leadCode) return null;
  return state.leadsByCode.get(leadCode) || null;
}

function isLeadOwnedByCurrentCompany(lead: CompanyLead) {
  const owner = lead.claimed_by_company_id || (lead as any).original_claimed_by_company_id;
  const clerkUserId = getClerkUserId();
  return !!owner && (owner === state.companyId || owner === clerkUserId);
}

function createButton(label: string, onClick: () => void, kind: 'primary' | 'danger' = 'primary') {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.className = kind === 'danger'
    ? 'rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100'
    : 'rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100';
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
  return button;
}

function renderStatusHint(cell: Element, lead: CompanyLead) {
  const current = String(lead.status || '');
  const label = STATUS_LABELS[current];
  if (!label) return;

  const badge = cell.querySelector('[data-vlgn-company-status-label]');
  if (badge) {
    badge.textContent = label;
    return;
  }

  const hint = document.createElement('div');
  hint.dataset.vlgnCompanyStatusLabel = 'true';
  hint.className = 'mt-2 text-[11px] font-semibold text-slate-500';
  hint.textContent = label;
  cell.appendChild(hint);
}

function askReportReason() {
  const reason = window.prompt(
    'Nhập lý do báo nghỉ / không đạt.\n\nVí dụ:\n- Ứng viên nghỉ việc\n- Không đến nhận việc\n- Không đạt sau phỏng vấn\n- Sai thông tin / không liên hệ được\n- Lý do khác'
  );

  if (reason === null) return null;

  const trimmed = reason.trim();
  if (trimmed.length < 5) {
    alert('Vui lòng nhập lý do rõ hơn, tối thiểu 5 ký tự.');
    return null;
  }

  return trimmed;
}

function getLeadActions(status: string) {
  return FLOW.filter((item) => item.from === status);
}

function renderStatusActionGroup(cell: Element, lead: CompanyLead) {
  const currentStatus = String(lead.status || '');
  const existing = cell.querySelector('[data-vlgn-company-status-actions]');
  const actions = getLeadActions(currentStatus);

  if (actions.length === 0) {
    existing?.remove();
    return;
  }

  if (existing?.getAttribute('data-current-status') === currentStatus) return;

  existing?.remove();

  const group = document.createElement('div');
  group.dataset.vlgnCompanyStatusActions = 'true';
  group.setAttribute('data-current-status', currentStatus);
  group.className = 'mt-2 flex flex-wrap gap-1';

  for (const action of actions) {
    group.appendChild(
      createButton(
        action.label,
        () => {
          const reason = action.requireReason ? askReportReason() : undefined;
          if (action.requireReason && !reason) return;
          void updateLeadStatus(lead, action.to, action.message, reason || undefined);
        },
        action.kind || 'primary',
      ),
    );
  }

  cell.appendChild(group);
}

function injectStatusActions() {
  if (!isCompanyDashboardPage()) return;

  const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>('tbody tr'));
  for (const row of rows) {
    const lead = getRowLead(row);
    if (!lead || !isLeadOwnedByCurrentCompany(lead)) continue;

    const cells = row.querySelectorAll('td');
    const statusCell = cells[3];
    if (!statusCell) continue;

    renderStatusHint(statusCell, lead);
    renderStatusActionGroup(statusCell, lead);
  }
}

async function updateLeadStatus(lead: CompanyLead, status: string, message: string, reason?: string) {
  if (!state.companyId) {
    alert('Chưa xác định được công ty. Vui lòng tải lại trang.');
    return;
  }

  if (!window.confirm(message)) return;

  try {
    const token = await window.Clerk?.session?.getToken?.();
    const response = await fetch(`${API_URL}/company/leads/${lead.id}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ company_id: state.companyId, status, reason }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      alert(error.message || error.error || 'Không thể cập nhật trạng thái lead');
      return;
    }

    const updated = { ...lead, status };
    rememberLeads([updated]);
    await refreshCompanyLeads();
    scheduleInjectStatusActions();

    if (status === 'disputed') {
      alert('Đã gửi phản hồi nghỉ / không đạt cho admin xử lý.');
    } else {
      alert(`Đã chuyển lead sang: ${STATUS_LABELS[status] || status}`);
    }
  } catch {
    alert('Lỗi kết nối server');
  }
}

let autoRefreshStarted = false;
function startAutoRefresh() {
  if (autoRefreshStarted) return;
  autoRefreshStarted = true;

  window.setInterval(() => {
    if (document.visibilityState === 'visible' && isCompanyDashboardPage()) {
      void refreshCompanyLeads();
    }
  }, COMPANY_LEAD_REFRESH_MS);

  window.addEventListener('focus', () => {
    if (isCompanyDashboardPage()) void refreshCompanyLeads();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isCompanyDashboardPage()) {
      void refreshCompanyLeads();
    }
  });
}

function observeDom() {
  if (!document.body) return;

  const observer = new MutationObserver(() => {
    if (isCompanyDashboardPage()) scheduleInjectStatusActions();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('popstate', () => {
    if (isCompanyDashboardPage()) scheduleInjectStatusActions();
  });
  startAutoRefresh();
  scheduleInjectStatusActions();
}

export function initCompanyLeadWorkflowBridge() {
  if (typeof window === 'undefined' || window.__VLGN_COMPANY_LEAD_WORKFLOW_BRIDGE__) return;
  window.__VLGN_COMPANY_LEAD_WORKFLOW_BRIDGE__ = true;
  patchFetch();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeDom, { once: true });
  } else {
    observeDom();
  }
}

initCompanyLeadWorkflowBridge();
