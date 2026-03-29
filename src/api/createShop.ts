import { getApiBase } from './baseUrl';
import { readErrorMessage } from './readErrorMessage';

export type CreateShopPayload = {
  name: string;
  displayName: string;
  billingName: string;
  location: {
    coordinates?: { latitude?: number | null; longitude?: number | null };
    addressText?: string | null;
    structured?: {
      line1?: string | null;
      line2?: string | null;
      city?: string | null;
      stateRegion?: string | null;
      postalCode?: string | null;
      country?: string | null;
    };
  };
  offering: {
    shopType: string;
    dealIn: string[];
    serviceRadiusKm: number;
  };
  contact?: {
    phone?: string | null;
    email?: string | null;
    website?: string | null;
  };
  gst: {
    isGstApplicable: boolean;
    gstNo?: string | null;
  };
  notes?: string | null;
  isActive?: boolean;
};

export type ShopResponse = {
  id: string;
  userId: string;
  name: string;
  displayName: string;
};

export async function createShopForUser(userId: string, payload: CreateShopPayload): Promise<ShopResponse> {
  const res = await fetch(`${getApiBase()}/users/${userId}/shops`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }

  return (await res.json()) as ShopResponse;
}
