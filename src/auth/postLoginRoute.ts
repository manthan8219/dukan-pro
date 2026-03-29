import type { BackendSession } from '../api/authSync';

/** Default in-app path after Firebase login, from server role + onboarding. */
export function defaultPostLoginPath(profile: BackendSession): string {
  if (profile.role === 'CUSTOMER') {
    return '/app/customer';
  }
  if (profile.role === 'SELLER') {
    return profile.sellerOnboardingComplete ? '/app/seller' : '/onboarding/seller';
  }
  return '/welcome/role';
}
