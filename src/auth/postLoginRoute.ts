import type { BackendSession } from '../api/authSync';
import { urlForBusinessPath, urlForCustomerPath } from '../config/appOrigins';
import { getAppSurface } from '../config/appSurface';

/** Default path after Firebase login, based on subdomain and buyer/seller capabilities. */
export function defaultPostLoginPath(profile: BackendSession): string {
  const surface = getAppSurface();

  if (surface === 'customer') {
    if (!profile.isCustomer && !profile.isSeller) {
      return '/welcome/role';
    }
    return '/app/customer';
  }

  if (surface === 'business') {
    if (!profile.isCustomer && !profile.isSeller) {
      return '/welcome/role';
    }
    if (!profile.isSeller) {
      return '/app/customer';
    }
    if (!profile.sellerOnboardingComplete) {
      return '/onboarding/seller';
    }
    return '/app/seller';
  }

  if (!profile.isCustomer && !profile.isSeller) {
    return '/welcome/role';
  }
  if (profile.isSeller && !profile.sellerOnboardingComplete) {
    return '/onboarding/seller';
  }
  if (profile.isCustomer) {
    return '/app/customer';
  }
  if (profile.isSeller && profile.sellerOnboardingComplete) {
    return '/app/seller';
  }
  return '/welcome/role';
}

/**
 * Full URL when the target path must open on the other subdomain
 * (business.* vs customer.*). Sellers are not kicked off the customer app.
 */
export function resolvePostLoginDestination(profile: BackendSession): string {
  const path = defaultPostLoginPath(profile);
  const surface = getAppSurface();
  if (surface === 'legacy') {
    return path;
  }
  if (path.startsWith('/welcome/role')) {
    return path;
  }
  if (surface === 'business') {
    if (path.startsWith('/app/customer')) {
      return urlForCustomerPath(path);
    }
    return path;
  }
  if (surface === 'customer') {
    if (path.startsWith('/app/seller') || path.startsWith('/onboarding/seller')) {
      return urlForBusinessPath(path);
    }
    return path;
  }
  return path;
}
