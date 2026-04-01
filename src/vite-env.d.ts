/// <reference types="vite/client" />

declare module '*.css?raw' {
  const content: string;
  export default content;
}

interface ImportMetaEnv {
  /** Local dev: `business` | `customer` to mimic subdomain split on localhost. */
  readonly VITE_APP_SURFACE?: string;
  /** Optional explicit buyer app origin when cross-linking (defaults to swapping subdomain from business host). */
  readonly VITE_CUSTOMER_APP_ORIGIN?: string;
  /** Optional explicit seller app origin when cross-linking (defaults to swapping subdomain from customer host). */
  readonly VITE_BUSINESS_APP_ORIGIN?: string;
  /**
   * When deriving the hub URL from customer.{host}, first DNS label: `business` (default) or `seller`
   * e.g. customer.localhost → seller.localhost if set to seller.
   */
  readonly VITE_SELLER_SUBDOMAIN_PREFIX?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
