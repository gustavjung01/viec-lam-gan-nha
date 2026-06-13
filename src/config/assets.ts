/**
 * Asset paths configuration
 * All paths are relative to public folder
 */
export const ASSETS = {
  // Brand
  logo: "/images/brand/logo.png",
  
  // Hero images (responsive)
  heroDesktop: "/images/hero/hero-workers-desktop.webp",
  heroMobile: "/images/hero/hero-workers-mobile.webp",
  
  // OG/Social
  ogDefault: "/images/og/og-default.webp",
  
  // Placeholders
  jobPlaceholder: "/images/placeholders/job-placeholder.webp",
} as const;

/**
 * Helper to get full asset URL with optional base URL
 */
export function getAssetUrl(path: string, baseUrl?: string): string {
  if (baseUrl) {
    return `${baseUrl}${path}`;
  }
  return path;
}
