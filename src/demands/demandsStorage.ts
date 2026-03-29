const DEMANDS_KEY = 'dukaanpro_demands_v1';
const BIDS_KEY = 'dukaanpro_demand_bids_v1';

/** Minimum order value (₹) shown on the receipt before a customer can post to sellers. */
export const MIN_ORDER_TO_POST_RUPEES = 2000;

export const MAX_RECEIPT_IMAGE_BYTES = 2 * 1024 * 1024;

export type DemandStatus = 'open' | 'awarded' | 'closed';

export type Demand = {
  id: string;
  customerUserId: string;
  /** Display name customer chooses */
  customerName: string;
  title: string;
  details: string;
  /** Optional e.g. "around ₹500" */
  budgetHint: string;
  /** Order total from receipt (rupees); required for new posts */
  orderTotalRupees: number;
  /** data:image/…;base64,… saved locally for demo */
  receiptImageDataUrl: string | null;
  createdAt: string;
  status: DemandStatus;
  awardedBidId: string | null;
};

export type Bid = {
  id: string;
  demandId: string;
  shopId: string;
  shopName: string;
  amount: number;
  note: string;
  createdAt: string;
};

function normalizeDemand(row: Demand): Demand {
  const orderTotalRupees =
    typeof row.orderTotalRupees === 'number' && Number.isFinite(row.orderTotalRupees)
      ? row.orderTotalRupees
      : 0;
  const receiptImageDataUrl =
    typeof row.receiptImageDataUrl === 'string' && row.receiptImageDataUrl.length > 0
      ? row.receiptImageDataUrl
      : null;
  return { ...row, orderTotalRupees, receiptImageDataUrl };
}

function loadDemands(): Demand[] {
  try {
    const raw = localStorage.getItem(DEMANDS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return (arr as Demand[]).map((d) => normalizeDemand(d));
  } catch {
    return [];
  }
}

function saveDemands(list: Demand[]): void {
  localStorage.setItem(DEMANDS_KEY, JSON.stringify(list));
}

function loadBids(): Bid[] {
  try {
    const raw = localStorage.getItem(BIDS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? (arr as Bid[]) : [];
  } catch {
    return [];
  }
}

function saveBids(list: Bid[]): void {
  localStorage.setItem(BIDS_KEY, JSON.stringify(list));
}

export function listAllDemands(): Demand[] {
  return loadDemands().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function listOpenDemands(): Demand[] {
  return listAllDemands().filter((d) => d.status === 'open');
}

export function listDemandsForCustomer(userId: string): Demand[] {
  return listAllDemands().filter((d) => d.customerUserId === userId);
}

export function getDemand(id: string): Demand | undefined {
  return loadDemands().find((d) => d.id === id);
}

export function createDemand(input: {
  customerUserId: string;
  customerName: string;
  title: string;
  details: string;
  budgetHint: string;
  orderTotalRupees: number;
  receiptImageDataUrl: string;
}): Demand {
  if (!Number.isFinite(input.orderTotalRupees) || input.orderTotalRupees < MIN_ORDER_TO_POST_RUPEES) {
    throw new Error(
      `Order total must be at least ₹${MIN_ORDER_TO_POST_RUPEES.toLocaleString('en-IN')}.`,
    );
  }
  const receipt = input.receiptImageDataUrl.trim();
  if (!receipt.startsWith('data:image/')) {
    throw new Error('A receipt photo is required.');
  }
  const list = loadDemands();
  const d: Demand = {
    id: crypto.randomUUID(),
    customerUserId: input.customerUserId,
    customerName: input.customerName.trim() || 'Customer',
    title: input.title.trim(),
    details: input.details.trim(),
    budgetHint: input.budgetHint.trim(),
    orderTotalRupees: Math.round(input.orderTotalRupees * 100) / 100,
    receiptImageDataUrl: receipt,
    createdAt: new Date().toISOString(),
    status: 'open',
    awardedBidId: null,
  };
  list.unshift(d);
  saveDemands(list.slice(0, 300));
  return d;
}

export function listBidsForDemand(demandId: string): Bid[] {
  return loadBids()
    .filter((b) => b.demandId === demandId)
    .sort((a, b) => a.amount - b.amount || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function getBidForShop(demandId: string, shopId: string): Bid | undefined {
  return loadBids().find((b) => b.demandId === demandId && b.shopId === shopId);
}

export function upsertBid(input: {
  demandId: string;
  shopId: string;
  shopName: string;
  amount: number;
  note: string;
}): Bid {
  const bids = loadBids();
  const idx = bids.findIndex((b) => b.demandId === input.demandId && b.shopId === input.shopId);
  const now = new Date().toISOString();
  const row: Bid = {
    id: idx >= 0 ? bids[idx]!.id : crypto.randomUUID(),
    demandId: input.demandId,
    shopId: input.shopId,
    shopName: input.shopName.trim() || 'Shop',
    amount: input.amount,
    note: input.note.trim(),
    createdAt: idx >= 0 ? bids[idx]!.createdAt : now,
  };
  const finalRow: Bid = idx >= 0 ? { ...row, createdAt: now } : row;
  if (idx >= 0) {
    bids[idx] = finalRow;
  } else {
    bids.push(finalRow);
  }
  saveBids(bids.slice(0, 5000));
  return finalRow;
}

export function acceptBid(demandId: string, bidId: string, customerUserId: string): boolean {
  const demands = loadDemands();
  const d = demands.find((x) => x.id === demandId);
  if (!d || d.customerUserId !== customerUserId || d.status !== 'open') return false;
  const bid = loadBids().find((b) => b.id === bidId && b.demandId === demandId);
  if (!bid) return false;
  d.status = 'awarded';
  d.awardedBidId = bidId;
  saveDemands(demands);
  return true;
}

export function closeDemand(demandId: string, customerUserId: string): boolean {
  const demands = loadDemands();
  const d = demands.find((x) => x.id === demandId);
  if (!d || d.customerUserId !== customerUserId) return false;
  d.status = 'closed';
  d.awardedBidId = null;
  saveDemands(demands);
  return true;
}

export function bidCountForDemand(demandId: string): number {
  return loadBids().filter((b) => b.demandId === demandId).length;
}
