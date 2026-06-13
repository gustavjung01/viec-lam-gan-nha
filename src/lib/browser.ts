const IN_APP_BROWSER_TOKENS = [
  'fban',
  'fbav',
  'fbsv',
  'fb_iab',
  'fb4a',
  'fbios',
  'facebook',
  'messenger',
  'instagram',
  'line',
  'zalo',
  'webview',
];

export function isInAppBrowser(userAgent: string | undefined = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean {
  const ua = (userAgent || '').toLowerCase();
  if (!ua) return false;
  return IN_APP_BROWSER_TOKENS.some((token) => ua.includes(token));
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  if (typeof document === 'undefined') return false;

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  } finally {
    document.body.removeChild(textarea);
  }

  return copied;
}

export function openExternalUrl(url: string): boolean {
  if (typeof window === 'undefined') return false;

  const popup = window.open(url, '_blank', 'noopener,noreferrer');
  if (popup) {
    popup.opener = null;
    return true;
  }

  return false;
}
