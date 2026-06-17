const API_PREFIX = '/api/admin/company/';
const API_PREFIX_PLURAL = '/api/admin/companies/';

type CompanyAction = 'approve' | 'reject' | 'block' | 'unblock';

function parseCompanyActionUrl(input: RequestInfo | URL): { companyId: string; action: CompanyAction } | null {
  const raw = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;
  const url = new URL(raw, window.location.origin);
  const path = url.pathname;
  const prefixes = [API_PREFIX, API_PREFIX_PLURAL];

  for (const prefix of prefixes) {
    if (!path.startsWith(prefix)) continue;
    const parts = path.slice(prefix.length).split('/').filter(Boolean);
    if (parts.length !== 2) continue;
    const [companyId, action] = parts;
    if (action === 'approve' || action === 'reject' || action === 'block' || action === 'unblock') {
      return { companyId, action };
    }
  }

  return null;
}

async function readJsonBody(init?: RequestInit): Promise<Record<string, any>> {
  if (!init?.body) return {};
  if (typeof init.body === 'string') {
    try {
      return JSON.parse(init.body);
    } catch {
      return {};
    }
  }
  return {};
}

function actionToStatus(action: CompanyAction) {
  if (action === 'approve' || action === 'unblock') return 'active';
  return 'suspended';
}

if (typeof window !== 'undefined' && !(window as any).__vlgnAdminCompanyActionBridgeInstalled) {
  (window as any).__vlgnAdminCompanyActionBridgeInstalled = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const match = parseCompanyActionUrl(input);
    const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();

    if (!match || method !== 'POST') {
      return originalFetch(input, init);
    }

    const body = await readJsonBody(init);
    const shouldClearReason = match.action === 'approve' || match.action === 'unblock';
    const nextBody = {
      ...body,
      status: actionToStatus(match.action),
      rejection_reason: shouldClearReason ? '' : (body.reason || body.rejection_reason || body.note || undefined),
    };

    return originalFetch(`/api/admin/company/${encodeURIComponent(match.companyId)}`, {
      ...init,
      method: 'PUT',
      body: JSON.stringify(nextBody),
      headers: {
        ...(init?.headers || {}),
        'Content-Type': 'application/json',
      },
    });
  };
}
