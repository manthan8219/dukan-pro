/** Bill totals and types shared by GST bill HTML template and billing form. */

export type GstSupplyType = 'intrastate' | 'interstate';

export type BillLineInput = {
  description: string;
  hsnCode: string;
  quantity: number;
  /** UQC — NOS, KGS, etc. */
  unit?: string;
  unitPrice: number;
  gstPercent: number;
};

export type GstInvoiceMeta = {
  supplyType: GstSupplyType;
  placeOfSupplyStateName: string;
  placeOfSupplyStateCode: string;
  customerGstin: string;
  reverseCharge: boolean;
};

export type GenerateBillInput = {
  billNumber: string;
  billDate: string;
  type: 'gst' | 'quotation';
  seller: { name: string; gstin: string; address: string; phone: string };
  customer: { name: string; email: string; phone: string; address: string };
  lines: BillLineInput[];
  /** Required when type === 'gst' */
  gst?: GstInvoiceMeta;
};

export function computeBillTotals(
  type: 'gst' | 'quotation',
  lines: BillLineInput[],
  supplyType: GstSupplyType = 'intrastate',
) {
  let taxableTotal = 0;
  let gstTotal = 0;
  for (const line of lines) {
    const lineTaxable = line.quantity * line.unitPrice;
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
  return { taxableTotal, gstTotal, cgst, sgst, igst, grandTotal };
}

export function pdfFileName(billNumber: string, type: 'gst' | 'quotation'): string {
  const safe = billNumber.replace(/[^\w.-]+/g, '_');
  return type === 'gst' ? `GST-Invoice-${safe}.pdf` : `Quotation-${safe}.pdf`;
}
