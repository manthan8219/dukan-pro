const PROFILE_KEY = 'dukaanpro_billing_profile_v1';
const HISTORY_KEY = 'dukaanpro_bills_history_v1';

export type BillingProfile = {
  businessName: string;
  gstin: string;
  address: string;
  phone: string;
  email: string;
  /** Optional; else PAN is taken from GSTIN in invoices */
  pan: string;
  fssai: string;
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  bankBranch: string;
  accountHolderName: string;
  /** Default terms for printed invoice */
  termsAndConditions: string;
};

export type BillLineSnapshot = {
  description: string;
  hsnCode: string;
  quantity: number;
  /** Unit of measure (UQC), e.g. NOS, KGS */
  unit?: string;
  unitPrice: number;
  /** Line discount % on qty × list price */
  discountPercent?: number;
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
  customerFssai?: string;
  /** ISO date string (end of day) or same-day display */
  dueDate?: string;
  shipToName?: string;
  shipToAddress?: string;
  shipToPhone?: string;
  shipToGstin?: string;
  sameShippingAsBilling?: boolean;
  sellerName: string;
  sellerGstin: string;
  sellerAddress: string;
  sellerPhone: string;
  sellerEmail?: string;
  sellerPan?: string;
  sellerFssai?: string;
  bankName?: string;
  bankAccount?: string;
  bankIfsc?: string;
  bankBranch?: string;
  accountHolderName?: string;
  lines: BillLineSnapshot[];
  taxableTotal: number;
  gstTotal: number;
  cgst: number;
  sgst: number;
  /** Inter-state supplies (IGST) */
  igst?: number;
  grandTotal: number;
  totalDiscountAmount?: number;
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
  email: '',
  pan: '',
  fssai: '',
  bankName: '',
  bankAccount: '',
  bankIfsc: '',
  bankBranch: '',
  accountHolderName: '',
  termsAndConditions: '',
};

const defaultTerms = `1. Goods once sold will not be taken back or exchanged.
2. Interest @ 18% p.a. will be charged on overdue invoices.
3. Subject to local jurisdiction only.
4. E. & O.E.`;

export function loadBillingProfile(): BillingProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { ...defaultProfile, termsAndConditions: defaultTerms };
    const p = JSON.parse(raw) as Partial<BillingProfile>;
    return {
      businessName: typeof p.businessName === 'string' ? p.businessName : '',
      gstin: typeof p.gstin === 'string' ? p.gstin : '',
      address: typeof p.address === 'string' ? p.address : '',
      phone: typeof p.phone === 'string' ? p.phone : '',
      email: typeof p.email === 'string' ? p.email : '',
      pan: typeof p.pan === 'string' ? p.pan : '',
      fssai: typeof p.fssai === 'string' ? p.fssai : '',
      bankName: typeof p.bankName === 'string' ? p.bankName : '',
      bankAccount: typeof p.bankAccount === 'string' ? p.bankAccount : '',
      bankIfsc: typeof p.bankIfsc === 'string' ? p.bankIfsc : '',
      bankBranch: typeof p.bankBranch === 'string' ? p.bankBranch : '',
      accountHolderName: typeof p.accountHolderName === 'string' ? p.accountHolderName : '',
      termsAndConditions:
        typeof p.termsAndConditions === 'string' && p.termsAndConditions.trim()
          ? p.termsAndConditions
          : defaultTerms,
    };
  } catch {
    return { ...defaultProfile, termsAndConditions: defaultTerms };
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
