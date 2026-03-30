import {
  panFromGstin,
  rupeesToWords,
  stateCodeFromGstin,
  stateNameFromCode,
} from './gstInvoiceUtils';
import { computeBillTotals } from './generateBillPdf';
import type { GenerateBillInput } from './generateBillPdf';
import './gstBillPrint.css';

function fmt(n: number): string {
  return n.toFixed(2);
}

function addrLines(text: string, maxLines = 5): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length === 0) return ['—'];
  return lines.slice(0, maxLines);
}

export type GstBillPrintTemplateProps = {
  input: GenerateBillInput;
};

export function GstBillPrintTemplate({ input }: GstBillPrintTemplateProps) {
  const { billNumber, billDate, type, seller, customer, lines } = input;
  const isGst = type === 'gst';
  const gst = input.gst;
  const supplyType = isGst ? (gst?.supplyType ?? 'intrastate') : 'intrastate';
  const isInter = isGst && supplyType === 'interstate';
  const totals = computeBillTotals(type, lines, supplyType);

  const sellerPan = seller.gstin ? panFromGstin(seller.gstin) : null;
  const sellerState = seller.gstin ? stateCodeFromGstin(seller.gstin) : null;
  const sellerStateName = sellerState ? stateNameFromCode(sellerState) : null;

  const custGstin = isGst && gst?.customerGstin?.trim();
  const custPan = custGstin ? panFromGstin(custGstin) : null;

  const posCode = isGst && gst ? gst.placeOfSupplyStateCode.trim().padStart(2, '0').slice(0, 2) : '';
  const posName =
    isGst && gst
      ? gst.placeOfSupplyStateName.trim() || stateNameFromCode(posCode) || `Code ${posCode}`
      : '';

  const title = isGst ? 'TAX INVOICE' : 'QUOTATION';

  return (
    <div className={`gst-bill ${isGst ? 'gst-bill--gst' : 'gst-bill--quote'}`}>
      <div className="gst-bill__top">
        <div className="gst-bill__sellerBlock">
          <div>
            <strong>{seller.name || '—'}</strong>
          </div>
          {addrLines(seller.address || '').map((line, i) => (
            <div key={i}>{line}</div>
          ))}
          {seller.phone ? <div>Phone: {seller.phone}</div> : null}
          {isGst && seller.gstin ? <div>GSTIN: {seller.gstin}</div> : null}
          {isGst && sellerPan ? <div>PAN: {sellerPan}</div> : null}
          {isGst && sellerState ? (
            <div>
              State: {sellerStateName ?? '—'} (Code {sellerState})
            </div>
          ) : null}
        </div>

        <div className="gst-bill__title">{title}</div>

        <div className="gst-bill__buyerBlock">
          <div className="gst-bill__billTo">Bill To:</div>
          <div>
            <strong>{customer.name || '—'}</strong>
          </div>
          {addrLines(customer.address || '').map((line, i) => (
            <div key={i}>{line}</div>
          ))}
          {customer.phone ? <div>Phone: {customer.phone}</div> : null}
          {customer.email ? <div>Email: {customer.email}</div> : null}
          {isGst ? (
            <>
              <div>{custGstin ? `GSTIN / UIN: ${custGstin}` : 'GSTIN / UIN: Unregistered'}</div>
              {custPan ? <div>PAN: {custPan}</div> : null}
              <div>
                Place of supply: {posName} ({posCode})
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="gst-bill__meta">
        <div className="gst-bill__metaRow">
          <span>Invoice#</span>
          <span>{billNumber}</span>
        </div>
        <div className="gst-bill__metaRow">
          <span>Invoice Date</span>
          <span>{billDate}</span>
        </div>
        <div className="gst-bill__metaRow">
          <span>Due Date</span>
          <span>{billDate}</span>
        </div>
        {isGst && gst ? (
          <div className="gst-bill__metaRow">
            <span>Reverse charge</span>
            <span>{gst.reverseCharge ? 'Yes' : 'No'}</span>
          </div>
        ) : null}
      </div>

      <div className="gst-bill__tableWrap">
        {!isGst ? (
          <table>
            <thead>
              <tr>
                <th className="gst-bill__thLeft" style={{ width: '2.5rem' }}>
                  Sl.
                </th>
                <th className="gst-bill__thLeft">Description</th>
                <th>Qty</th>
                <th>UQC</th>
                <th>Rate</th>
                <th className="gst-bill__thNum">Amount (INR)</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => {
                const amt = line.quantity * line.unitPrice;
                return (
                  <tr key={i}>
                    <td className="gst-bill__tdCenter">{i + 1}</td>
                    <td>{line.description || '—'}</td>
                    <td className="gst-bill__tdCenter">{line.quantity}</td>
                    <td className="gst-bill__tdCenter">{(line.unit || 'NOS').toUpperCase().slice(0, 8)}</td>
                    <td className="gst-bill__tdNum">{fmt(line.unitPrice)}</td>
                    <td className="gst-bill__tdNum">{fmt(amt)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tbody>
              <tr className="gst-bill__totalRow">
                <td colSpan={5} className="gst-bill__tdNum">
                  Total Amount
                </td>
                <td className="gst-bill__tdNum">₹ {fmt(totals.grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        ) : isInter ? (
          <table>
            <thead>
              <tr>
                <th rowSpan={2} className="gst-bill__tdCenter" style={{ width: '1.8rem' }}>
                  Sl.
                </th>
                <th rowSpan={2} className="gst-bill__thLeft">
                  Product / service
                </th>
                <th rowSpan={2}>HSN/SAC</th>
                <th rowSpan={2}>Qty</th>
                <th rowSpan={2}>UQC</th>
                <th rowSpan={2}>Rate</th>
                <th rowSpan={2} className="gst-bill__thNum">
                  Taxable
                </th>
                <th colSpan={2}>Tax</th>
                <th rowSpan={2} className="gst-bill__thNum">
                  Amount
                </th>
              </tr>
              <tr>
                <th>IGST %</th>
                <th className="gst-bill__thNum">IGST Amt</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => {
                const taxable = line.quantity * line.unitPrice;
                const gstAmt = taxable * ((line.gstPercent || 0) / 100);
                const total = taxable + gstAmt;
                return (
                  <tr key={i}>
                    <td className="gst-bill__tdCenter">{i + 1}</td>
                    <td>{line.description || '—'}</td>
                    <td className="gst-bill__tdCenter">{line.hsnCode.trim() || '—'}</td>
                    <td className="gst-bill__tdCenter">{line.quantity}</td>
                    <td className="gst-bill__tdCenter">{(line.unit || 'NOS').toUpperCase().slice(0, 8)}</td>
                    <td className="gst-bill__tdNum">{fmt(line.unitPrice)}</td>
                    <td className="gst-bill__tdNum">{fmt(taxable)}</td>
                    <td className="gst-bill__tdCenter">{line.gstPercent}%</td>
                    <td className="gst-bill__tdNum">{fmt(gstAmt)}</td>
                    <td className="gst-bill__tdNum">{fmt(total)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tbody>
              <tr className="gst-bill__totalRow">
                <td colSpan={9} className="gst-bill__tdNum">
                  Total Amount
                </td>
                <td className="gst-bill__tdNum">₹ {fmt(totals.grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <table>
            <thead>
              <tr>
                <th rowSpan={2} className="gst-bill__tdCenter" style={{ width: '1.8rem' }}>
                  Sl.
                </th>
                <th rowSpan={2} className="gst-bill__thLeft">
                  Product / service
                </th>
                <th rowSpan={2}>HSN/SAC</th>
                <th rowSpan={2}>Qty</th>
                <th rowSpan={2}>UQC</th>
                <th rowSpan={2}>Rate</th>
                <th rowSpan={2} className="gst-bill__thNum">
                  Taxable
                </th>
                <th colSpan={4}>Tax</th>
                <th rowSpan={2} className="gst-bill__thNum">
                  Amount
                </th>
              </tr>
              <tr>
                <th>CGST %</th>
                <th className="gst-bill__thNum">CGST</th>
                <th>SGST %</th>
                <th className="gst-bill__thNum">SGST</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => {
                const taxable = line.quantity * line.unitPrice;
                const gstAmt = taxable * ((line.gstPercent || 0) / 100);
                const half = gstAmt / 2;
                const pct = line.gstPercent || 0;
                const halfPct = pct / 2;
                const total = taxable + gstAmt;
                return (
                  <tr key={i}>
                    <td className="gst-bill__tdCenter">{i + 1}</td>
                    <td>{line.description || '—'}</td>
                    <td className="gst-bill__tdCenter">{line.hsnCode.trim() || '—'}</td>
                    <td className="gst-bill__tdCenter">{line.quantity}</td>
                    <td className="gst-bill__tdCenter">{(line.unit || 'NOS').toUpperCase().slice(0, 8)}</td>
                    <td className="gst-bill__tdNum">{fmt(line.unitPrice)}</td>
                    <td className="gst-bill__tdNum">{fmt(taxable)}</td>
                    <td className="gst-bill__tdCenter">{fmt(halfPct)}%</td>
                    <td className="gst-bill__tdNum">{fmt(half)}</td>
                    <td className="gst-bill__tdCenter">{fmt(halfPct)}%</td>
                    <td className="gst-bill__tdNum">{fmt(half)}</td>
                    <td className="gst-bill__tdNum">{fmt(total)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tbody>
              <tr className="gst-bill__totalRow">
                <td colSpan={11} className="gst-bill__tdNum">
                  Total Amount
                </td>
                <td className="gst-bill__tdNum">₹ {fmt(totals.grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <div className="gst-bill__words">
        <strong>Taxable value (INR):</strong> {fmt(totals.taxableTotal)}
        {isGst ? (
          <>
            {isInter ? (
              <>
                {' '}
                | <strong>IGST (INR):</strong> {fmt(totals.igst)}
              </>
            ) : (
              <>
                {' '}
                | <strong>CGST (INR):</strong> {fmt(totals.cgst)} | <strong>SGST / UTGST (INR):</strong> {fmt(totals.sgst)}
              </>
            )}
          </>
        ) : null}
        <br />
        <strong>Amount chargeable (in words):</strong> {rupeesToWords(totals.grandTotal)} only.
      </div>

      <div className="gst-bill__footer">
        {isGst ? (
          <p>
            Declaration: We declare that the particulars of goods/services and the amounts in this tax invoice are true
            and correct.
          </p>
        ) : (
          <p>This document is a quotation only and is not a tax invoice under the GST law.</p>
        )}
        <p>This is a computer-generated document.</p>
      </div>

      <div className="gst-bill__sign">
        <div>For {seller.name || 'Supplier'}</div>
        <div style={{ marginTop: '2.5rem' }}>Authorised signatory</div>
      </div>

      <div className="gst-bill__notes">
        <h4>Notes</h4>
        <p>Thank you for your business.</p>
        <h4>Terms &amp; conditions</h4>
        <p>Please retain this document for your records. For GST invoices, please verify GSTIN and tax amounts.</p>
      </div>
    </div>
  );
}
