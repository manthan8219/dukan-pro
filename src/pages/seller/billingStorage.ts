const PROFILE_KEY = 'dukaanpro_billing_profile_v1';
const HISTORY_KEY = 'dukaanpro_bills_history_v1';

export type BillingProfile = {
  businessName: string;
  gstin: string;
  address: string;
  phone: string;
};

export type BillLineSnapshot = {
  description: string;
  hsnCode: string;
  quantity: number;
  /** Unit of measure (UQC), e.g. NOS, KGS */
  unit?: string;
  unitPrice: number;
  gstPercent: number;
};

export type SavedBill = {
  id: string;
  billNumber: string;
  createdAt: string;
  type: 'gst' | 'quotation';
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  sellerName: string;
  sellerGstin: string;
  sellerAddress: string;
  sellerPhone: string;
  lines: BillLineSnapshot[];
  taxableTotal: number;
  gstTotal: number;
  cgst: number;
  sgst: number;
  /** Inter-state supplies (IGST) */
  igst?: number;
  grandTotal: number;
  gstSupplyType?: 'intrastate' | 'interstate';
  customerGstin?: string;
  placeOfSupplyStateName?: string;
  placeOfSupplyStateCode?: string;
  reverseCharge?: boolean;
};

const defaultProfile: BillingProfile = {
  businessName: '',
  gstin: '',
  address: '',
  phone: '',
};

export function loadBillingProfile(): BillingProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { ...defaultProfile };
    const p = JSON.parse(raw) as Partial<BillingProfile>;
    return {
      businessName: typeof p.businessName === 'string' ? p.businessName : '',
      gstin: typeof p.gstin === 'string' ? p.gstin : '',
      address: typeof p.address === 'string' ? p.address : '',
      phone: typeof p.phone === 'string' ? p.phone : '',
    };
  } catch {
    return { ...defaultProfile };
  }
}

export function saveBillingProfile(p: BillingProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

export function loadBillHistory(): SavedBill[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is SavedBill => x && typeof x.id === 'string' && typeof x.billNumber === 'string');
  } catch {
    return [];
  }
}

export function saveBillHistory(bills: SavedBill[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(bills));
}

export function appendBill(bill: SavedBill): void {
  const list = loadBillHistory();
  list.unshift(bill);
  saveBillHistory(list.slice(0, 200));
}

export function nextBillNumber(): string {
  const list = loadBillHistory();
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const prefix = `DP-${y}${m}${d}`;
  let maxSeq = 0;
  for (const b of list) {
    if (b.billNumber.startsWith(prefix + '-')) {
      const n = Number(b.billNumber.slice(prefix.length + 1));
      if (Number.isFinite(n) && n > maxSeq) maxSeq = n;
    }
  }
  return `${prefix}-${String(maxSeq + 1).padStart(3, '0')}`;
}
