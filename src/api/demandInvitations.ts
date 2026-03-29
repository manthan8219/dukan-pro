import { getApiBase } from './baseUrl';
import { readErrorMessage } from './readErrorMessage';

export type InvitationResponseKind = 'PENDING' | 'REJECTED' | 'QUOTED';

export type ShopDemandInvitation = {
  invitationId: string;
  demandId: string;
  demandTitle: string;
  demandDetails: string;
  demandBudgetHint: string | null;
  customerReceiptImageUrl: string | null;
  receiptOrderTotalMinor: number | null;
  demandStatus: string;
  responseKind: InvitationResponseKind;
  rejectReason: string | null;
  quotationText: string | null;
  quotationDocumentUrl: string | null;
  respondedAt: string | null;
  quotedLineItems?: {
    shopProductId: string;
    quantity: number;
    productNameSnapshot: string;
    unitPriceMinor: number;
    unit: string;
  }[];
};

export async function listShopDemandInvitations(shopId: string): Promise<ShopDemandInvitation[]> {
  const res = await fetch(`${getApiBase()}/shops/${shopId}/demand-invitations`);
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as ShopDemandInvitation[];
}

export async function rejectDemandInvitation(
  shopId: string,
  invitationId: string,
  reason?: string | null,
): Promise<ShopDemandInvitation> {
  const res = await fetch(
    `${getApiBase()}/shops/${shopId}/demand-invitations/${invitationId}/reject`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason ?? null }),
    },
  );
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as ShopDemandInvitation;
}

export async function submitDemandQuotation(
  shopId: string,
  invitationId: string,
  payload: {
    quotationText: string;
    quotationDocumentContentId?: string | null;
    lineItems?: { shopProductId: string; quantity: number }[];
  },
): Promise<ShopDemandInvitation> {
  const res = await fetch(
    `${getApiBase()}/shops/${shopId}/demand-invitations/${invitationId}/quote`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as ShopDemandInvitation;
}
