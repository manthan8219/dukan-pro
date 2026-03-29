const KEY = 'dukaanpro_customer_profile_v1';

export type CustomerProfile = {
  displayName: string;
  email: string;
};

const defaults: CustomerProfile = {
  displayName: '',
  email: '',
};

export function loadCustomerProfile(): CustomerProfile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };
    const p = JSON.parse(raw) as Partial<CustomerProfile>;
    return {
      displayName: typeof p.displayName === 'string' ? p.displayName : '',
      email: typeof p.email === 'string' ? p.email : '',
    };
  } catch {
    return { ...defaults };
  }
}

export function saveCustomerProfile(p: CustomerProfile): void {
  localStorage.setItem(KEY, JSON.stringify(p));
}
