const ACTION_PATH = /\/api\/admin\/compan(?:y|ies)\/[^/]+\/(approve|reject|block|unblock)(?:\?|$)/;

function isCompanyActionUrl(input: RequestInfo | URL) {
  const raw = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;
  const url = new URL(raw, window.location.origin);
  return ACTION_PATH.test(url.pathname);
}

if (typeof window !== 'undefined' && !(window as any).__vlgnAdminCompanyActionBridgeInstalled) {
  (window as any).__vlgnAdminCompanyActionBridgeInstalled = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    // Backend now owns approve/reject/block/unblock. Keep this bridge as a transparent shim
    // so older imports do not install the previous PUT rewrite behavior.
    if (isCompanyActionUrl(input)) return originalFetch(input, init);
    return originalFetch(input, init);
  };
}

export {};
