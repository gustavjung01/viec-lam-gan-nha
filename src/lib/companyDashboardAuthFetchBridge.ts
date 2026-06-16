const protectedCompanyDashboardPaths = [
  '/api/company/campaigns',
  '/api/company/leads',
];

function shouldAttachClerkToken(input: RequestInfo | URL): boolean {
  const raw = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;

  try {
    const url = new URL(raw, window.location.origin);
    return protectedCompanyDashboardPaths.some((path) => url.pathname === path);
  } catch {
    return protectedCompanyDashboardPaths.some((path) => raw.startsWith(path));
  }
}

function hasAuthorization(headers: Headers): boolean {
  return Boolean(headers.get('Authorization') || headers.get('authorization'));
}

async function getClerkToken(): Promise<string | null> {
  const clerk = (window as any).Clerk;
  try {
    if (clerk?.session?.getToken) {
      return await clerk.session.getToken();
    }
  } catch {
    return null;
  }
  return null;
}

export function installCompanyDashboardAuthFetchBridge() {
  const win = window as any;
  if (win.__vlgnCompanyDashboardAuthFetchBridgeInstalled) return;
  win.__vlgnCompanyDashboardAuthFetchBridgeInstalled = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!shouldAttachClerkToken(input)) {
      return originalFetch(input, init);
    }

    const headers = new Headers(
      init?.headers || (input instanceof Request ? input.headers : undefined)
    );

    if (!hasAuthorization(headers)) {
      const token = await getClerkToken();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    return originalFetch(input, { ...init, headers });
  };
}
