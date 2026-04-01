/**
 * Which “app” this browser tab is serving: seller hub vs buyer app vs legacy single-host.
 * Production: `business.*` or `seller.*` → seller app; `customer.*` → buyer app.
 * Local: set VITE_APP_SURFACE=business|customer on plain localhost, or use *.localhost subdomains.
 */
export type AppSurface = 'business' | 'customer' | 'legacy';

export function getAppSurface(): AppSurface {
  const h = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  if (h.startsWith('business.') || h.startsWith('seller.')) {
    return 'business';
  }
  if (h.startsWith('customer.')) {
    return 'customer';
  }
  if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]') {
    const v = import.meta.env.VITE_APP_SURFACE?.trim().toLowerCase();
    if (v === 'business' || v === 'customer') {
      return v;
    }
  }
  return 'legacy';
}
