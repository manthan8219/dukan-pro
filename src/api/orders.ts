import { getApiBase } from './baseUrl';
import { readErrorMessage } from './readErrorMessage';

export type OrderPaymentMethod = 'upi' | 'card' | 'cod' | 'wallet';

export type OrderStatus =
  | 'PLACED'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export type OrderItemDto = {
  id: string;
  shopProductId: string;
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
  productNameSnapshot: string;
};

export type OrderDto = {
  id: string;
  userId: string;
  shopId: string;
  shopDisplayName?: string;
  deliveryAddressId: string;
  status: OrderStatus;
  itemsSubtotalMinor: number;
  deliveryFeeMinor: number;
  totalMinor: number;
  paymentMethod: OrderPaymentMethod | null;
  deliveredAt: string | null;
  createdAt: string;
  items: OrderItemDto[];
};

export type CheckoutOrderPayload = {
  deliveryAddressId: string;
  paymentMethod?: OrderPaymentMethod;
  items: { shopProductId: string; quantity: number }[];
};

function errWithStatus(message: string, status: number): Error & { status: number } {
  const e = new Error(message) as Error & { status: number };
  e.status = status;
  return e;
}

export async function checkoutOrders(
  userId: string,
  body: CheckoutOrderPayload,
): Promise<OrderDto[]> {
  const res = await fetch(`${getApiBase()}/users/${userId}/orders/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw errWithStatus(await readErrorMessage(res), res.status);
  }
  return (await res.json()) as OrderDto[];
}

export async function listCustomerOrders(userId: string): Promise<OrderDto[]> {
  const res = await fetch(`${getApiBase()}/users/${userId}/orders`);
  if (!res.ok) {
    throw errWithStatus(await readErrorMessage(res), res.status);
  }
  return (await res.json()) as OrderDto[];
}

export async function listShopOrders(
  ownerUserId: string,
  shopId: string,
): Promise<OrderDto[]> {
  const res = await fetch(
    `${getApiBase()}/users/${ownerUserId}/shops/${shopId}/orders`,
  );
  if (!res.ok) {
    throw errWithStatus(await readErrorMessage(res), res.status);
  }
  return (await res.json()) as OrderDto[];
}

export async function updateShopOrderStatus(
  ownerUserId: string,
  shopId: string,
  orderId: string,
  status: OrderStatus,
): Promise<OrderDto> {
  const res = await fetch(
    `${getApiBase()}/users/${ownerUserId}/shops/${shopId}/orders/${orderId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    },
  );
  if (!res.ok) {
    throw errWithStatus(await readErrorMessage(res), res.status);
  }
  return (await res.json()) as OrderDto;
}
