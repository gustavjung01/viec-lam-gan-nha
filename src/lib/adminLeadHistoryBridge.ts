declare global {
  interface Window {
    __VLGN_ADMIN_LEAD_HISTORY_BRIDGE__?: boolean;
  }
}

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

function rewriteAdminLeadHistoryUrl(url: URL | null) {
  if (!url) return null;
  const match = url.pathname.match(/^\/api\/admin\/leads\/([^/]+)\/history$/);
  if (!match) return null;
  const rewritten = new URL(url.toString());
  rewritten.pathname = `/api/admin/auth/leads/${encodeURIComponent(decodeURIComponent(match[1]))}/history`;
  return rewritten;
}

function installAdminLeadHistoryBridge() {
  if (typeof window === 'undefined') return;
  if (window.__VLGN_ADMIN_LEAD_HISTORY_BRIDGE__) return;
  window.__VLGN_ADMIN_LEAD_HISTORY_BRIDGE__ = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const rewritten = rewriteAdminLeadHistoryUrl(normalizeUrl(input));
    if (!rewritten) return originalFetch(input, init);
    return originalFetch(rewritten.toString(), init);
  };
}

installAdminLeadHistoryBridge();

export {};
