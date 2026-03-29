const USER_KEY = 'dukaanpro_userId';
const BACKEND_USER_KEY = 'dukaanpro_backendUserId';
const ROLE_KEY = 'dukaanpro_role';
const SHOP_KEY = 'dukaanpro_lastShopId';
const SELLER_ONBOARDING_DONE_KEY = 'dukaanpro_sellerOnboardingDone';

export type PersistedRole = 'customer' | 'seller';

export function getUserId(): string | null {
  const v = localStorage.getItem(USER_KEY);
  return v && v.length > 0 ? v : null;
}

export function setUserId(id: string): void {
  localStorage.setItem(USER_KEY, id);
}

export function getBackendUserId(): string | null {
  const v = localStorage.getItem(BACKEND_USER_KEY);
  return v && v.length > 0 ? v : null;
}

export function setBackendUserId(id: string): void {
  localStorage.setItem(BACKEND_USER_KEY, id);
}

export function clearBackendUserId(): void {
  localStorage.removeItem(BACKEND_USER_KEY);
}

export function clearSession(): void {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(BACKEND_USER_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(SHOP_KEY);
  localStorage.removeItem(SELLER_ONBOARDING_DONE_KEY);
}

export function getRole(): PersistedRole | null {
  const v = localStorage.getItem(ROLE_KEY);
  if (v === 'customer' || v === 'seller') return v;
  return null;
}

export function setRole(role: PersistedRole): void {
  localStorage.setItem(ROLE_KEY, role);
}

/** Clear stored role hint (e.g. while server profile has no role yet). */
export function clearPersistedRole(): void {
  localStorage.removeItem(ROLE_KEY);
}

export function getLastShopId(): string | null {
  const v = localStorage.getItem(SHOP_KEY);
  return v && v.length > 0 ? v : null;
}

export function setLastShopId(id: string): void {
  localStorage.setItem(SHOP_KEY, id);
}

export function isSellerOnboardingComplete(): boolean {
  return localStorage.getItem(SELLER_ONBOARDING_DONE_KEY) === '1';
}

export function setSellerOnboardingComplete(): void {
  localStorage.setItem(SELLER_ONBOARDING_DONE_KEY, '1');
}
