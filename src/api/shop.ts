import { getApiBase } from './baseUrl';
import { readErrorMessage } from './readErrorMessage';
import type { CreateShopPayload } from './createShop';

export type ShopDetail = {
  id: string;
  userId: string;
  name: string;
  displayName: string;
  billingName: string;
  location: {
    coordinates: { latitude: number | null; longitude: number | null };
    addressText: string | null;
  };
  offering: CreateShopPayload['offering'];
  contact: NonNullable<CreateShopPayload['contact']>;
  gst: CreateShopPayload['gst'];
  notes: string | null;
  isActive: boolean;
};

export async function fetchShop(shopId: string): Promise<ShopDetail> {
  const res = await fetch(`${getApiBase()}/shops/${shopId}`);
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as ShopDetail;
}

/** Shops whose delivery radius covers this point (see GET /shops/discover/nearby). */
export type ShopNearbySummary = {
  id: string;
  displayName: string;
  name: string;
  distanceKm: number;
  effectiveMaxServiceRadiusKm: number;
  addressText: string | null;
  city: string | null;
  shopType: string;
  dealIn: string[];
  averageRating: number | null;
  ratingCount: number;
};

export async function fetchDiscoverableShops(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
  orderAmountRupees?: number,
): Promise<ShopNearbySummary[]> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
  });
  if (orderAmountRupees != null && orderAmountRupees > 0) {
    params.set('orderAmountRupees', String(orderAmountRupees));
  }
  const res = await fetch(`${getApiBase()}/shops/discover/nearby?${params}`, {
    signal,
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as ShopNearbySummary[];
}

export type UpdateShopPayload = Partial<Omit<CreateShopPayload, 'gst'>> & {
  gst?: CreateShopPayload['gst'];
};

export async function updateShop(shopId: string, payload: UpdateShopPayload): Promise<ShopDetail> {
  const res = await fetch(`${getApiBase()}/shops/${shopId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as ShopDetail;
}
