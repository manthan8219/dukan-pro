import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { panFromGstin, rupeesToWords, stateCodeFromGstin, stateNameFromCode } from './gstInvoiceUtils';

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

function fmt(n: number): string {
  return n.toFixed(2);
}

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

type HsnAggKey = string;

function hsnKey(hsn: string, gstPct: number): HsnAggKey {
  return `${hsn.trim() || '—'}|${gstPct}`;
}

type PdfWithTable = jsPDF & { lastAutoTable?: { finalY: number } };

export function buildBillPdf(input: GenerateBillInput): jsPDF {
  const { billNumber, billDate, type, seller, customer, lines } = input;
  const isGst = type === 'gst';
  const gst = input.gst;
  const supplyType: GstSupplyType = isGst ? (gst?.supplyType ?? 'intrastate') : 'intrastate';
  const totals = computeBillTotals(type, lines, supplyType);

  const pdf = new jsPDF({ orientation: isGst ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  let y = 10;

  pdf.setFontSize(16);
  pdf.setTextColor(15, 61, 58);
  pdf.setFont('helvetica', 'bold');
  pdf.text(isGst ? 'TAX INVOICE' : 'QUOTATION', pageW / 2, y, { align: 'center' });
  y += 7;

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(50, 50, 50);
  if (isGst && seller.name) {
    pdf.text(seller.name, pageW / 2, y, { align: 'center' });
    y += 5;
  }

  pdf.setFont('helvetica', 'bold');
  pdf.text(`Invoice No.: ${billNumber}`, 14, y);
  pdf.text(`Invoice Date: ${billDate}`, pageW / 2 - 25, y);
  if (isGst && gst) {
    const posCode = gst.placeOfSupplyStateCode.trim().padStart(2, '0').slice(0, 2);
    const posName =
      gst.placeOfSupplyStateName.trim() ||
      stateNameFromCode(posCode) ||
      `State code ${posCode}`;
    pdf.text(`Place of Supply: ${posName} (Code ${posCode})`, pageW - 14, y, { align: 'right' });
  }
  y += 5;

  if (isGst && gst) {
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Reverse charge: ${gst.reverseCharge ? 'Yes' : 'No'}`, 14, y);
    y += 6;
  } else {
    y += 2;
  }

  const boxTop = y;
  const boxH = 38;
  const mid = pageW / 2;
  pdf.setDrawColor(180, 180, 180);
  pdf.rect(14, boxTop, mid - 19, boxH);
  pdf.rect(mid + 5, boxTop, pageW - 14 - (mid + 5), boxH);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text('Details of Supplier', 16, boxTop + 4);
  pdf.text('Details of Receiver (Bill to)', mid + 7, boxTop + 4);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);

  let sy = boxTop + 8;
  const sellerPan = seller.gstin ? panFromGstin(seller.gstin) : null;
  const sellerStateCode = seller.gstin ? stateCodeFromGstin(seller.gstin) : null;
  const sellerStateName = sellerStateCode ? stateNameFromCode(sellerStateCode) : null;

  const sellerLines: string[] = [
    `Name: ${seller.name || '—'}`,
    `Address: ${(seller.address || '—').replace(/\n/g, ', ')}`,
    seller.phone ? `Phone: ${seller.phone}` : '',
    seller.gstin ? `GSTIN: ${seller.gstin}` : '',
    sellerPan ? `PAN: ${sellerPan}` : '',
    sellerStateCode
      ? `State: ${sellerStateName ?? 'Code ' + sellerStateCode} (Code ${sellerStateCode})`
      : '',
  ].filter(Boolean);

  const custGstin = isGst && gst?.customerGstin?.trim();
  const custPan = custGstin ? panFromGstin(custGstin) : null;
  const receiverLines: string[] = [
    `Name: ${customer.name || '—'}`,
    `Address: ${(customer.address || '—').replace(/\n/g, ', ')}`,
    customer.phone ? `Phone: ${customer.phone}` : '',
    customer.email ? `Email: ${customer.email}` : '',
    custGstin ? `GSTIN / UIN: ${custGstin}` : 'GSTIN / UIN: Unregistered',
    custPan ? `PAN: ${custPan}` : '',
    isGst && gst
      ? `POS (State): ${gst.placeOfSupplyStateName.trim() || stateNameFromCode(gst.placeOfSupplyStateCode.trim().padStart(2, '0')) || '—'} (${gst.placeOfSupplyStateCode.trim().padStart(2, '0').slice(0, 2)})`
      : '',
  ].filter(Boolean);

  const maxL = Math.max(sellerLines.length, receiverLines.length);
  for (let i = 0; i < maxL; i++) {
    pdf.text(sellerLines[i] ?? '', 16, sy, { maxWidth: mid - 24 });
    pdf.text(receiverLines[i] ?? '', mid + 7, sy, { maxWidth: pageW - mid - 22 });
    sy += 4.2;
  }

  y = boxTop + boxH + 6;

  const doc = pdf as PdfWithTable;

  if (isGst) {
    const isInter = supplyType === 'interstate';
    const halfRate = (pct: number) => fmt(pct / 2);

    const hsnMap = new Map<
      HsnAggKey,
      { hsn: string; taxable: number; gstPct: number; cgst: number; sgst: number; igst: number }
    >();

    for (const line of lines) {
      const taxable = line.quantity * line.unitPrice;
      const pct = line.gstPercent || 0;
      const gstAmt = taxable * (pct / 100);
      const key = hsnKey(line.hsnCode, pct);
      const prev = hsnMap.get(key) ?? {
        hsn: line.hsnCode.trim() || '—',
        taxable: 0,
        gstPct: pct,
        cgst: 0,
        sgst: 0,
        igst: 0,
      };
      prev.taxable += taxable;
      if (isInter) {
        prev.igst += gstAmt;
      } else {
        prev.cgst += gstAmt / 2;
        prev.sgst += gstAmt / 2;
      }
      hsnMap.set(key, prev);
    }

    if (isInter) {
      const head = [
        [
          'Sr',
          'Description of goods / services',
          'HSN/SAC',
          'Qty',
          'UQC',
          'Rate\n(INR)',
          'Taxable\n(INR)',
          'IGST %',
          'IGST Amt\n(INR)',
          'Total\n(INR)',
        ],
      ];
      const body = lines.map((line, i) => {
        const taxable = line.quantity * line.unitPrice;
        const gstAmt = taxable * ((line.gstPercent || 0) / 100);
        const total = taxable + gstAmt;
        return [
          String(i + 1),
          line.description,
          line.hsnCode.trim() || '—',
          String(line.quantity),
          (line.unit || 'NOS').toUpperCase().slice(0, 8),
          fmt(line.unitPrice),
          fmt(taxable),
          `${line.gstPercent}%`,
          fmt(gstAmt),
          fmt(total),
        ];
      });
      autoTable(pdf, {
        startY: y,
        head: head,
        body,
        styles: { fontSize: 6, cellPadding: 1 },
        headStyles: { fillColor: [15, 77, 72], textColor: 255, fontStyle: 'bold' },
        margin: { left: 14, right: 14 },
        columnStyles: {
          0: { cellWidth: 8 },
          1: { cellWidth: 52 },
          2: { cellWidth: 18 },
          3: { cellWidth: 12 },
          4: { cellWidth: 14 },
        },
      });
    } else {
      const head = [
        [
          'Sr',
          'Description of goods / services',
          'HSN/SAC',
          'Qty',
          'UQC',
          'Rate\n(INR)',
          'Taxable\n(INR)',
          'CGST\n%',
          'CGST Amt',
          'SGST\n%',
          'SGST Amt',
          'Total\n(INR)',
        ],
      ];
      const body = lines.map((line, i) => {
        const taxable = line.quantity * line.unitPrice;
        const gstAmt = taxable * ((line.gstPercent || 0) / 100);
        const half = gstAmt / 2;
        const total = taxable + gstAmt;
        const pct = line.gstPercent || 0;
        return [
          String(i + 1),
          line.description,
          line.hsnCode.trim() || '—',
          String(line.quantity),
          (line.unit || 'NOS').toUpperCase().slice(0, 8),
          fmt(line.unitPrice),
          fmt(taxable),
          `${halfRate(pct)}%`,
          fmt(half),
          `${halfRate(pct)}%`,
          fmt(half),
          fmt(total),
        ];
      });
      autoTable(pdf, {
        startY: y,
        head: head,
        body,
        styles: { fontSize: 5.8, cellPadding: 0.9 },
        headStyles: { fillColor: [15, 77, 72], textColor: 255, fontStyle: 'bold' },
        margin: { left: 14, right: 14 },
        columnStyles: {
          0: { cellWidth: 7 },
          1: { cellWidth: 42 },
          2: { cellWidth: 16 },
          3: { cellWidth: 10 },
          4: { cellWidth: 12 },
        },
      });
    }

    let ty = (doc.lastAutoTable?.finalY ?? y + 40) + 5;

    if (isInter) {
      const sumHead = [['HSN/SAC', 'Taxable value (INR)', 'Integrated tax rate', 'Integrated tax amt (INR)', 'Total tax (INR)']];
      const sumBody = Array.from(hsnMap.values()).map((row) => [
        row.hsn,
        fmt(row.taxable),
        `${row.gstPct}%`,
        fmt(row.igst),
        fmt(row.igst),
      ]);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Summary of tax on supplies (HSN / SAC wise)', 14, ty);
      ty += 4;
      autoTable(pdf, {
        startY: ty,
        head: sumHead,
        body: sumBody,
        styles: { fontSize: 7, cellPadding: 1.2 },
        headStyles: { fillColor: [40, 100, 90], textColor: 255 },
        margin: { left: 14, right: 14 },
      });
      ty = (doc.lastAutoTable?.finalY ?? ty) + 8;
    } else {
      const sumHead = [
        [
          'HSN/SAC',
          'Taxable value (INR)',
          'Central tax\nRate %',
          'Central tax\nAmt (INR)',
          'State / UT tax\nRate %',
          'State / UT tax\nAmt (INR)',
          'Total tax (INR)',
        ],
      ];
      const sumBody = Array.from(hsnMap.values()).map((row) => [
        row.hsn,
        fmt(row.taxable),
        `${fmt(row.gstPct / 2)}`,
        fmt(row.cgst),
        `${fmt(row.gstPct / 2)}`,
        fmt(row.sgst),
        fmt(row.cgst + row.sgst),
      ]);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Summary of tax on supplies (HSN / SAC wise)', 14, ty);
      ty += 4;
      autoTable(pdf, {
        startY: ty,
        head: sumHead,
        body: sumBody,
        styles: { fontSize: 7, cellPadding: 1.2 },
        headStyles: { fillColor: [40, 100, 90], textColor: 255 },
        margin: { left: 14, right: 14 },
      });
      ty = (doc.lastAutoTable?.finalY ?? ty) + 8;
    }

    const rightX = pageW - 14;
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(30, 30, 30);
    pdf.text(`Total taxable value: INR ${fmt(totals.taxableTotal)}`, rightX, ty, { align: 'right' });
    ty += 5;
    if (isInter) {
      pdf.text(`Integrated tax (IGST): INR ${fmt(totals.igst)}`, rightX, ty, { align: 'right' });
      ty += 5;
    } else {
      pdf.text(`Add: CGST: INR ${fmt(totals.cgst)}`, rightX, ty, { align: 'right' });
      ty += 5;
      pdf.text(`Add: SGST / UTGST: INR ${fmt(totals.sgst)}`, rightX, ty, { align: 'right' });
      ty += 5;
    }
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(`Invoice value (in figures): INR ${fmt(totals.grandTotal)}`, rightX, ty, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    ty += 8;

    const words = rupeesToWords(totals.grandTotal);
    pdf.setFontSize(8);
    pdf.text(`Amount chargeable (in words): ${words}`, 14, ty, { maxWidth: pageW - 28 });
    ty += 10;

    pdf.setFontSize(7.5);
    pdf.setTextColor(80, 80, 80);
    pdf.text(
      'Declaration: We declare that the particulars of goods/services and the amounts in this tax invoice are true and correct.',
      14,
      ty,
      { maxWidth: pageW - 28 },
    );
    ty += 10;

    pdf.text(`For ${seller.name || 'Supplier'}`, pageW - 14, ty, { align: 'right' });
    ty += 12;
    pdf.text('Authorised signatory', pageW - 14, ty, { align: 'right' });
    ty += 8;
    pdf.setFontSize(7);
    pdf.text('This is a computer-generated tax invoice and does not require a physical signature.', 14, pageH - 12, {
      maxWidth: pageW - 28,
    });
  } else {
    const head = [['Sr', 'Description', 'Qty', 'UOM', 'Rate (INR)', 'Amount (INR)']];
    const body = lines.map((line, i) => {
      const amt = line.quantity * line.unitPrice;
      return [
        String(i + 1),
        line.description,
        String(line.quantity),
        (line.unit || 'NOS').toUpperCase().slice(0, 8),
        fmt(line.unitPrice),
        fmt(amt),
      ];
    });
    autoTable(pdf, {
      startY: y,
      head,
      body,
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [15, 77, 72], textColor: 255 },
      margin: { left: 14, right: 14 },
    });

    let ty = (doc.lastAutoTable?.finalY ?? y + 50) + 10;
    const rightX = pageW - 14;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Total: INR ${fmt(totals.grandTotal)}`, rightX, ty, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    ty += 10;
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text('This document is a quotation only and is not a tax invoice under the GST law.', 14, ty, {
      maxWidth: pageW - 28,
    });
  }

  return pdf;
}

export function pdfFileName(billNumber: string, type: 'gst' | 'quotation'): string {
  const safe = billNumber.replace(/[^\w.-]+/g, '_');
  return type === 'gst' ? `GST-Invoice-${safe}.pdf` : `Quotation-${safe}.pdf`;
}
