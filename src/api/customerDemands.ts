import { getApiBase } from './baseUrl';
import { readErrorMessage } from './readErrorMessage';

export type CustomerDemandStatus = 'DRAFT' | 'LIVE' | 'AWARDED' | 'CLOSED';

export type CustomerDemandRecord = {
  id: string;
  userId: string;
  title: string;
  details: string;
  budgetHint: string | null;
  receiptContentId: string | null;
  receiptImageUrl: string | null;
  receiptOrderTotalMinor: number | null;
  status: CustomerDemandStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  notifiedShopCount: number;
  quotationCount: number;
  awardedInvitationId?: string | null;
  awardedShopDisplayName?: string | null;
};

export type QuotedLineItem = {
  shopProductId: string;
  quantity: number;
  productNameSnapshot: string;
  unitPriceMinor: number;
  unit: string;
};

export type CustomerDemandQuotation = {
  invitationId: string;
  shopId: string;
  shopDisplayName: string;
  quotationText: string;
  quotationDocumentUrl: string | null;
  respondedAt: string;
  quotedLineItems?: QuotedLineItem[];
};

export type CreateCustomerDemandPayload = {
  title: string;
  details: string;
  budgetHint?: string | null;
  receiptContentId?: string | null;
  receiptOrderTotalMinor?: number | null;
  deliveryLatitude?: number | null;
  deliveryLongitude?: number | null;
};

export type UpdateCustomerDemandPayload = Partial<CreateCustomerDemandPayload>;

export async function listCustomerDemands(userId: string): Promise<CustomerDemandRecord[]> {
  const res = await fetch(`${getApiBase()}/users/${userId}/demands`);
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as CustomerDemandRecord[];
}

export async function createCustomerDemand(
  userId: string,
  payload: CreateCustomerDemandPayload,
): Promise<CustomerDemandRecord> {
  const res = await fetch(`${getApiBase()}/users/${userId}/demands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as CustomerDemandRecord;
}

export async function publishCustomerDemand(
  userId: string,
  demandId: string,
  body: { deliveryLatitude?: number; deliveryLongitude?: number } = {},
): Promise<CustomerDemandRecord> {
  const res = await fetch(`${getApiBase()}/users/${userId}/demands/${demandId}/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as CustomerDemandRecord;
}

export async function closeCustomerDemand(
  userId: string,
  demandId: string,
): Promise<CustomerDemandRecord> {
  const res = await fetch(`${getApiBase()}/users/${userId}/demands/${demandId}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as CustomerDemandRecord;
}

export async function listDemandQuotations(
  userId: string,
  demandId: string,
): Promise<CustomerDemandQuotation[]> {
  const res = await fetch(`${getApiBase()}/users/${userId}/demands/${demandId}/quotations`);
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as CustomerDemandQuotation[];
}

export async function acceptDemandQuotation(
  userId: string,
  demandId: string,
  invitationId: string,
): Promise<CustomerDemandRecord> {
  const res = await fetch(
    `${getApiBase()}/users/${userId}/demands/${demandId}/accept-quotation`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitationId }),
    },
  );
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as CustomerDemandRecord;
}
