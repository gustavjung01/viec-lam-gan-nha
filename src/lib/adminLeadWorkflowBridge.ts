const ADMIN_LEAD_STATUS_PATH = /\/api\/admin\/leads\/[^/]+\/status(?:\?|$)/;

const LEGACY_CLOSED_REASON = 'Lead closed in legacy admin UI, mapped to rejected because closed is not a valid lead status.';

function isAdminLeadStatusUrl(input: RequestInfo | URL): boolean {
  const value = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;

  try {
    const url = new URL(value, window.location.origin);
    return ADMIN_LEAD_STATUS_PATH.test(url.pathname);
  } catch {
    return ADMIN_LEAD_STATUS_PATH.test(value);
  }
}

function removeClosedOptions() {
  const options = document.querySelectorAll<HTMLOptionElement>('option[value="closed"]');
  options.forEach((option) => {
    const select = option.closest('select');
    option.remove();

    if (select?.value === 'closed') {
      select.value = 'disputed';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  document.querySelectorAll<HTMLSelectElement>('select').forEach((select) => {
    Array.from(select.options).forEach((option) => {
      if (option.textContent?.trim().toLowerCase() === 'đã đóng') {
        option.remove();
      }
    });
  });
}

function normalizeAdminLeadStatusBody(init?: RequestInit): RequestInit | undefined {
  if (!init?.body || typeof init.body !== 'string') return init;

  try {
    const body = JSON.parse(init.body);
    if (body?.status !== 'closed') return init;

    return {
      ...init,
      body: JSON.stringify({
        ...body,
        status: 'rejected',
        reason: body.reason || LEGACY_CLOSED_REASON,
      }),
    };
  } catch {
    return init;
  }
}

function installAdminLeadFetchGuard() {
  const marker = '__vlgnAdminLeadWorkflowBridgeInstalled';
  const win = window as typeof window & { [marker]?: boolean };
  if (win[marker]) return;
  win[marker] = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (isAdminLeadStatusUrl(input)) {
      return originalFetch(input, normalizeAdminLeadStatusBody(init));
    }

    return originalFetch(input, init);
  };
}

function installClosedOptionGuard() {
  removeClosedOptions();

  const observer = new MutationObserver(() => removeClosedOptions());
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

if (typeof window !== 'undefined') {
  installAdminLeadFetchGuard();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installClosedOptionGuard, { once: true });
  } else {
    installClosedOptionGuard();
  }
}

export {};
