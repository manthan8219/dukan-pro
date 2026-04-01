const USER_KEY = 'dukaanpro_userId';
const BACKEND_USER_KEY = 'dukaanpro_backendUserId';
const CUSTOMER_CAP_KEY = 'dukaanpro_isCustomer';
const SELLER_CAP_KEY = 'dukaanpro_isSeller';
const SHOP_KEY = 'dukaanpro_lastShopId';
const SELLER_ONBOARDING_DONE_KEY = 'dukaanpro_sellerOnboardingDone';

/** @deprecated Legacy single-role hint; use capability flags. */
const ROLE_KEY = 'dukaanpro_role';

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
  localStorage.removeItem(CUSTOMER_CAP_KEY);
  localStorage.removeItem(SELLER_CAP_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(SHOP_KEY);
  localStorage.removeItem(SELLER_ONBOARDING_DONE_KEY);
}

export function setCapabilities(isCustomer: boolean, isSeller: boolean): void {
  if (isCustomer) {
    localStorage.setItem(CUSTOMER_CAP_KEY, '1');
  } else {
    localStorage.removeItem(CUSTOMER_CAP_KEY);
  }
  if (isSeller) {
    localStorage.setItem(SELLER_CAP_KEY, '1');
  } else {
    localStorage.removeItem(SELLER_CAP_KEY);
  }
  localStorage.removeItem(ROLE_KEY);
}

/** Clear stored capability hints (e.g. while server profile has no capabilities yet). */
export function clearPersistedRole(): void {
  localStorage.removeItem(CUSTOMER_CAP_KEY);
  localStorage.removeItem(SELLER_CAP_KEY);
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
