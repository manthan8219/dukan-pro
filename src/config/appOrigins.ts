import type { NavigateFunction } from 'react-router-dom';
import { getAppSurface } from './appSurface';

function trimSlash(s: string) {
  return s.replace(/\/+$/, '');
}

function normalizePath(path: string) {
  return path.startsWith('/') ? path : `/${path}`;
}

/** First label of host: customer | business | seller, plus remainder (e.g. localhost). */
function parseSubdomainHost(host: string): { kind: 'customer' | 'business' | 'seller'; rest: string } | null {
  const h = host.toLowerCase();
  if (h.startsWith('customer.')) {
    return { kind: 'customer', rest: h.slice('customer.'.length) };
  }
  if (h.startsWith('business.')) {
    return { kind: 'business', rest: h.slice('business.'.length) };
  }
  if (h.startsWith('seller.')) {
    return { kind: 'seller', rest: h.slice('seller.'.length) };
  }
  return null;
}

/**
 * Subdomain label for the seller app when deriving URLs from the customer host.
 * Use `seller` if you run the hub at seller.localhost instead of business.localhost.
 */
function sellerSubdomainLabel(): string {
  const raw = import.meta.env.VITE_SELLER_SUBDOMAIN_PREFIX?.trim().toLowerCase();
  if (raw === 'seller' || raw === 'business') {
    return raw;
  }
  return 'business';
}

/** Public buyer app origin (for links from seller host). */
export function getCustomerAppOrigin(): string {
  const env = import.meta.env.VITE_CUSTOMER_APP_ORIGIN?.trim();
  if (env) {
    return trimSlash(env);
  }
  const parsed = parseSubdomainHost(window.location.hostname);
  if (parsed && (parsed.kind === 'business' || parsed.kind === 'seller')) {
    const url = new URL(window.location.href);
    url.hostname = `customer.${parsed.rest}`;
    return url.origin;
  }
  return '';
}

/** Public seller-hub origin (for links from customer host). */
export function getBusinessAppOrigin(): string {
  const env = import.meta.env.VITE_BUSINESS_APP_ORIGIN?.trim();
  if (env) {
    return trimSlash(env);
  }
  const parsed = parseSubdomainHost(window.location.hostname);
  if (parsed?.kind !== 'customer') {
    return '';
  }
  const url = new URL(window.location.href);
  url.hostname = `${sellerSubdomainLabel()}.${parsed.rest}`;
  return url.origin;
}

/** Full URL to a path on the customer app, or a relative path when already on that app / legacy. */
export function urlForCustomerPath(path: string): string {
  const surface = getAppSurface();
  const p = normalizePath(path);
  if (surface === 'legacy' || surface === 'customer') {
    return p;
  }
  const base = getCustomerAppOrigin();
  return base ? `${base}${p}` : p;
}

/** Full URL to a path on the seller hub, or a relative path when already there / legacy. */
export function urlForBusinessPath(path: string): string {
  const surface = getAppSurface();
  const p = normalizePath(path);
  if (surface === 'legacy' || surface === 'business') {
    return p;
  }
  const base = getBusinessAppOrigin();
  return base ? `${base}${p}` : p;
}

export function isAbsoluteHttpUrl(s: string) {
  return s.startsWith('http://') || s.startsWith('https://');
}

/** Use after login / role pick: full URL only when the target lives on the other subdomain. */
export function navigateInSplitApp(
  navigate: NavigateFunction,
  pathOrUrl: string,
  options?: { replace?: boolean },
): void {
  const replace = options?.replace ?? false;
  if (isAbsoluteHttpUrl(pathOrUrl)) {
    if (replace) {
      window.location.replace(pathOrUrl);
    } else {
      window.location.assign(pathOrUrl);
    }
    return;
  }
  navigate(pathOrUrl, { replace });
}
