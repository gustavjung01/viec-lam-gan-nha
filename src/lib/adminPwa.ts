const PUBLIC_MANIFEST = '/manifest.webmanifest';
const ADMIN_MANIFEST = '/admin-manifest.webmanifest';
const PUBLIC_THEME = '#0B2A63';
const ADMIN_THEME = '#7f1d1d';

function getOrCreateMeta(name: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  return el;
}

function getManifestLink() {
  let el = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!el) {
    el = document.createElement('link');
    el.rel = 'manifest';
    document.head.appendChild(el);
  }
  return el;
}

export function syncAdminPwaMetadata(pathname = window.location.pathname) {
  const isAdmin = pathname.startsWith('/admin');
  const manifest = getManifestLink();
  const theme = getOrCreateMeta('theme-color');
  const appName = getOrCreateMeta('application-name');
  const appleTitle = getOrCreateMeta('apple-mobile-web-app-title');

  manifest.href = isAdmin ? ADMIN_MANIFEST : PUBLIC_MANIFEST;
  theme.content = isAdmin ? ADMIN_THEME : PUBLIC_THEME;
  appName.content = isAdmin ? 'VLGN Admin' : 'Việc Gần Nhà';
  appleTitle.content = isAdmin ? 'VLGN Admin' : 'Việc Gần Nhà';
  document.documentElement.dataset.appShell = isAdmin ? 'admin' : 'public';
}
