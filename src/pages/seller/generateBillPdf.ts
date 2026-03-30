/** Bill totals and types shared by GST bill HTML template and billing form. */

export type GstSupplyType = 'intrastate' | 'interstate';

export type BillLineInput = {
  description: string;
  hsnCode: string;
  quantity: number;
  /** UQC — NOS, KGS, etc. */
  unit?: string;
  /** List price per unit (before line discount); GST is computed on discounted taxable value */
  unitPrice: number;
  /** Line discount % on (qty × list price); default 0 */
  discountPercent?: number;
  gstPercent: number;
};

export type GstInvoiceMeta = {
  supplyType: GstSupplyType;
  placeOfSupplyStateName: string;
  placeOfSupplyStateCode: string;
  customerGstin: string;
  reverseCharge: boolean;
};

export type SellerInvoiceDetails = {
  name: string;
  gstin: string;
  address: string;
  phone: string;
  email?: string;
  /** Shown if set; else derived from GSTIN via template */
  pan?: string;
  /** FSSAI licence no. (food businesses) */
  fssai?: string;
  bankName?: string;
  bankAccount?: string;
  bankIfsc?: string;
  bankBranch?: string;
  accountHolderName?: string;
};

export type CustomerInvoiceDetails = {
  name: string;
  email: string;
  phone: string;
  address: string;
  fssai?: string;
  /** Shipping — if omitted / same as billing, template duplicates billing */
  shipToName?: string;
  shipToAddress?: string;
  shipToPhone?: string;
  shipToGstin?: string;
  sameShippingAsBilling?: boolean;
};

export type GenerateBillInput = {
  billNumber: string;
  billDate: string;
  /** Due date label (display); defaults to billDate if empty */
  dueDate?: string;
  type: 'gst' | 'quotation';
  seller: SellerInvoiceDetails;
  customer: CustomerInvoiceDetails;
  lines: BillLineInput[];
  /** Required when type === 'gst' */
  gst?: GstInvoiceMeta;
  /** Shown top-right, e.g. Original Copy / Duplicate */
  invoiceCopyLabel?: string;
  /** Numbered terms; default supplied by template */
  termsAndConditions?: string;
};

/** Gross line value before discount */
export function lineGross(line: BillLineInput): number {
  return line.quantity * line.unitPrice;
}

export function lineDiscountAmount(line: BillLineInput): number {
  const pct = line.discountPercent ?? 0;
  return lineGross(line) * (pct / 100);
}

export function lineTaxableValue(line: BillLineInput): number {
  return Math.max(0, lineGross(line) - lineDiscountAmount(line));
}

export function computeBillTotals(
  type: 'gst' | 'quotation',
  lines: BillLineInput[],
  supplyType: GstSupplyType = 'intrastate',
) {
  let taxableTotal = 0;
  let gstTotal = 0;
  let totalDiscountAmount = 0;
  for (const line of lines) {
    totalDiscountAmount += lineDiscountAmount(line);
    const lineTaxable = lineTaxableValue(line);
    taxableTotal += lineTaxable;
    if (type === 'gst') {
      const pct = line.gstPercent || 0;
      gstTotal += lineTaxable * (pct / 100);
    }
  }
  const isInter = type === 'gst' && supplyType === 'interstate';
  const cgst = type === 'gst' && !isInter ? gstTotal / 2 : 0;
  const sgst = type === 'gst' && !isInter ? gstTotal / 2 : 0;
  const igst = type === 'gst' && isInter ? gstTotal : 0;
  const grandTotal = taxableTotal + gstTotal;
  return { taxableTotal, gstTotal, cgst, sgst, igst, grandTotal, totalDiscountAmount };
}

export function pdfFileName(billNumber: string, type: 'gst' | 'quotation'): string {
  const safe = billNumber.replace(/[^\w.-]+/g, '_');
  return type === 'gst' ? `GST-Invoice-${safe}.pdf` : `Quotation-${safe}.pdf`;
}
