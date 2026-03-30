import { panFromGstin, rupeesToWords, stateNameFromCode } from './gstInvoiceUtils';
import { computeBillTotals, lineTaxableValue, type GenerateBillInput } from './generateBillPdf';
import './gstBillPrint.css';

function fmt(n: number): string {
  return n.toFixed(2);
}

function fmtPct(n: number): string {
  return n.toFixed(2);
}

const DEFAULT_TERMS = `1. Goods once sold will not be taken back or exchanged.
2. Interest @ 18% p.a. will be charged on overdue invoices.
3. Subject to local jurisdiction only.
4. E. & O.E.`;

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

  const dueDate = input.dueDate?.trim() || billDate;
  const copyLabel = input.invoiceCopyLabel?.trim() || 'Original Copy';
  const termsText = (input.termsAndConditions?.trim() || DEFAULT_TERMS).trim();

  const sellerPan = (seller.pan?.trim() || (seller.gstin ? panFromGstin(seller.gstin) : null) || '—') as string;

  const custGstin = isGst && gst?.customerGstin?.trim();

  const posCode = isGst && gst ? gst.placeOfSupplyStateCode.trim().padStart(2, '0').slice(0, 2) : '';
  const posName =
    isGst && gst
      ? gst.placeOfSupplyStateName.trim() || stateNameFromCode(posCode) || `Code ${posCode}`
      : '';

  const sameShip = customer.sameShippingAsBilling !== false;
  const shipName = sameShip ? customer.name : customer.shipToName?.trim() || '—';
  const shipAddr = sameShip ? customer.address : customer.shipToAddress?.trim() || '—';
  const shipPhone = sameShip ? customer.phone : customer.shipToPhone?.trim() || '—';
  const shipGst = sameShip ? (custGstin || '') : customer.shipToGstin?.trim() || '';

  const title = isGst ? 'TAX INVOICE' : 'QUOTATION';

  const dominantGstPct =
    lines.length > 0 ? lines.reduce((a, l) => a + (l.gstPercent || 0), 0) / lines.length : 0;

  return (
    <div className={`gst-bill gst-bill--std ${isGst ? 'gst-bill--gst' : 'gst-bill--quote'}`}>
      <div className="gst-bill__stdHeader">
        <span className="gst-bill__stdPage">Page No. 1 of 1</span>
        <span className="gst-bill__stdTitle">{title}</span>
        <span className="gst-bill__stdCopy">{copyLabel}</span>
      </div>

      <div className="gst-bill__stdCompanyRow">
        <div className="gst-bill__stdLogo" aria-hidden>
          Logo
        </div>
        <div className="gst-bill__stdCompanyCenter">
          <div className="gst-bill__stdCoName">{seller.name || '—'}</div>
          <div className="gst-bill__stdCoAddr">{(seller.address || '—').replace(/\n/g, ', ')}</div>
          <div className="gst-bill__stdCoMeta">
            <span>Mobile: {seller.phone || '—'}</span>
            <span>Email: {seller.email?.trim() || '—'}</span>
            <span>GSTIN: {seller.gstin || '—'}</span>
            <span>PAN: {sellerPan}</span>
          </div>
          {seller.fssai?.trim() ? (
            <div className="gst-bill__stdFssai">FSSAI: {seller.fssai.trim()}</div>
          ) : null}
        </div>
        <div className="gst-bill__stdCompanyRight" />
      </div>

      <div className="gst-bill__stdRule" />

      <div className="gst-bill__stdMetaGrid">
        <div className="gst-bill__stdMetaLine">
          <span className="gst-bill__stdMetaLabel">Invoice Number</span>
          <span className="gst-bill__stdMetaVal">{billNumber}</span>
        </div>
        <div className="gst-bill__stdMetaLine">
          <span className="gst-bill__stdMetaLabel">Invoice Date</span>
          <span className="gst-bill__stdMetaVal">{billDate}</span>
        </div>
        <div className="gst-bill__stdMetaLine">
          <span className="gst-bill__stdMetaLabel">Due Date</span>
          <span className="gst-bill__stdMetaVal">{dueDate}</span>
        </div>
        {isGst ? (
          <>
            <div className="gst-bill__stdMetaLine">
              <span className="gst-bill__stdMetaLabel">Place of Supply</span>
              <span className="gst-bill__stdMetaVal">
                {posName} ({posCode})
              </span>
            </div>
            <div className="gst-bill__stdMetaLine">
              <span className="gst-bill__stdMetaLabel">Reverse Charge</span>
              <span className="gst-bill__stdMetaVal">{gst?.reverseCharge ? 'Yes' : 'No'}</span>
            </div>
          </>
        ) : null}
      </div>

      <div className="gst-bill__stdBillShip">
        <div className="gst-bill__stdBlock">
          <div className="gst-bill__stdBlockTitle">Billing Details</div>
          <div className="gst-bill__stdField">
            <span className="gst-bill__stdFieldLabel">Name</span>
            <span className="gst-bill__stdFieldVal">{customer.name || '—'}</span>
          </div>
          <div className="gst-bill__stdField">
            <span className="gst-bill__stdFieldLabel">GSTIN</span>
            <span className="gst-bill__stdFieldVal">{custGstin || 'Unregistered'}</span>
          </div>
          <div className="gst-bill__stdField">
            <span className="gst-bill__stdFieldLabel">Mobile</span>
            <span className="gst-bill__stdFieldVal">{customer.phone || '—'}</span>
          </div>
          {customer.fssai?.trim() ? (
            <div className="gst-bill__stdField">
              <span className="gst-bill__stdFieldLabel">FSSAI</span>
              <span className="gst-bill__stdFieldVal">{customer.fssai.trim()}</span>
            </div>
          ) : null}
          <div className="gst-bill__stdField">
            <span className="gst-bill__stdFieldLabel">Email</span>
            <span className="gst-bill__stdFieldVal">{customer.email || '—'}</span>
          </div>
          <div className="gst-bill__stdField gst-bill__stdField--addr">
            <span className="gst-bill__stdFieldLabel">Address</span>
            <span className="gst-bill__stdFieldVal">{(customer.address || '—').replace(/\n/g, ', ')}</span>
          </div>
        </div>
        <div className="gst-bill__stdBlock">
          <div className="gst-bill__stdBlockTitle">Shipping Details</div>
          <div className="gst-bill__stdField">
            <span className="gst-bill__stdFieldLabel">Name</span>
            <span className="gst-bill__stdFieldVal">{shipName}</span>
          </div>
          <div className="gst-bill__stdField">
            <span className="gst-bill__stdFieldLabel">GSTIN</span>
            <span className="gst-bill__stdFieldVal">{shipGst || '—'}</span>
          </div>
          <div className="gst-bill__stdField">
            <span className="gst-bill__stdFieldLabel">Mobile</span>
            <span className="gst-bill__stdFieldVal">{shipPhone}</span>
          </div>
          <div className="gst-bill__stdField">
            <span className="gst-bill__stdFieldLabel">Email</span>
            <span className="gst-bill__stdFieldVal">{sameShip ? customer.email || '—' : '—'}</span>
          </div>
          <div className="gst-bill__stdField gst-bill__stdField--addr">
            <span className="gst-bill__stdFieldLabel">Address</span>
            <span className="gst-bill__stdFieldVal">{shipAddr.replace(/\n/g, ', ')}</span>
          </div>
        </div>
      </div>

      <div className="gst-bill__tableWrap gst-bill__tableWrap--std">
        {!isGst ? (
          <table className="gst-bill__stdTable">
            <thead>
              <tr>
                <th className="gst-bill__cSl">Sr.</th>
                <th className="gst-bill__cDesc">Item Description</th>
                <th className="gst-bill__cHsn">HSN/SAC</th>
                <th className="gst-bill__cQty">Qty</th>
                <th className="gst-bill__cUnit">Unit</th>
                <th className="gst-bill__cRate">List Price</th>
                <th className="gst-bill__cDisc">Disc. %</th>
                <th className="gst-bill__cAmt">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => {
                const lineTx = lineTaxableValue(line);
                return (
                  <tr key={i}>
                    <td className="gst-bill__tdCenter">{i + 1}</td>
                    <td>{line.description || '—'}</td>
                    <td className="gst-bill__tdCenter">{line.hsnCode.trim() || '—'}</td>
                    <td className="gst-bill__tdCenter">{line.quantity}</td>
                    <td className="gst-bill__tdCenter">{(line.unit || 'NOS').toUpperCase().slice(0, 8)}</td>
                    <td className="gst-bill__tdNum">{fmt(line.unitPrice)}</td>
                    <td className="gst-bill__tdNum">{fmtPct(line.discountPercent ?? 0)}</td>
                    <td className="gst-bill__tdNum">{fmt(lineTx)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tbody>
              <tr className="gst-bill__stdSubtotal">
                <td colSpan={7} className="gst-bill__tdNum">
                  Discount
                </td>
                <td className="gst-bill__tdNum">₹ {fmt(totals.totalDiscountAmount)}</td>
              </tr>
              <tr className="gst-bill__stdGrand">
                <td colSpan={7} className="gst-bill__tdNum">
                  Total
                </td>
                <td className="gst-bill__tdNum">₹ {fmt(totals.grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <table className="gst-bill__stdTable">
            <thead>
              <tr>
                <th className="gst-bill__cSl">Sr.</th>
                <th className="gst-bill__cDesc">Item Description</th>
                <th className="gst-bill__cHsn">HSN/SAC</th>
                <th className="gst-bill__cQty">Qty</th>
                <th className="gst-bill__cUnit">Unit</th>
                <th className="gst-bill__cRate">List Price</th>
                <th className="gst-bill__cDisc">Disc. %</th>
                <th className="gst-bill__cTax">Tax %</th>
                <th className="gst-bill__cAmt">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => {
                const tx = lineTaxableValue(line);
                const gstAmt = tx * ((line.gstPercent || 0) / 100);
                const lineTotal = tx + gstAmt;
                return (
                  <tr key={i}>
                    <td className="gst-bill__tdCenter">{i + 1}</td>
                    <td>{line.description || '—'}</td>
                    <td className="gst-bill__tdCenter">{line.hsnCode.trim() || '—'}</td>
                    <td className="gst-bill__tdCenter">{line.quantity}</td>
                    <td className="gst-bill__tdCenter">{(line.unit || 'NOS').toUpperCase().slice(0, 8)}</td>
                    <td className="gst-bill__tdNum">{fmt(line.unitPrice)}</td>
                    <td className="gst-bill__tdNum">{fmtPct(line.discountPercent ?? 0)}</td>
                    <td className="gst-bill__tdNum">{fmtPct(line.gstPercent || 0)}</td>
                    <td className="gst-bill__tdNum">{fmt(lineTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tbody>
              <tr className="gst-bill__stdSubtotal">
                <td colSpan={8} className="gst-bill__tdNum">
                  Discount
                </td>
                <td className="gst-bill__tdNum">₹ {fmt(totals.totalDiscountAmount)}</td>
              </tr>
              <tr className="gst-bill__stdGrand">
                <td colSpan={8} className="gst-bill__tdNum">
                  Total
                </td>
                <td className="gst-bill__tdNum">₹ {fmt(totals.grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <div className="gst-bill__stdWords">
        <strong>Amount in words:</strong> Rs. {rupeesToWords(totals.grandTotal)} Only
      </div>

      {isGst ? (
        <div className="gst-bill__stdSettlement">
          <div className="gst-bill__stdSettleRow">
            <span>Settled by — Bank (NEFT / UPI / Cash as applicable)</span>
          </div>
          <div className="gst-bill__stdSettleGrid">
            <div>
              <span className="gst-bill__stdSettleLabel">Invoice balance</span>
              <span className="gst-bill__stdSettleFig">₹ {fmt(totals.grandTotal)}</span>
            </div>
            <div>
              <span className="gst-bill__stdSettleLabel">Taxable value</span>
              <span className="gst-bill__stdSettleFig">₹ {fmt(totals.taxableTotal)}</span>
            </div>
            <div>
              <span className="gst-bill__stdSettleLabel">Sale (avg. GST @ {fmtPct(dominantGstPct)}%)</span>
              <span className="gst-bill__stdSettleFig">₹ {fmt(totals.taxableTotal)}</span>
            </div>
          </div>
          <div className="gst-bill__stdTaxBreak">
            {isInter ? (
              <div className="gst-bill__stdTaxLine">
                <span>IGST</span>
                <span>₹ {fmt(totals.igst ?? 0)}</span>
              </div>
            ) : (
              <>
                <div className="gst-bill__stdTaxLine">
                  <span>CGST</span>
                  <span>₹ {fmt(totals.cgst)}</span>
                </div>
                <div className="gst-bill__stdTaxLine">
                  <span>SGST / UTGST</span>
                  <span>₹ {fmt(totals.sgst)}</span>
                </div>
              </>
            )}
            <div className="gst-bill__stdTaxLine">
              <span>Total tax</span>
              <span>₹ {fmt(totals.gstTotal)}</span>
            </div>
            <div className="gst-bill__stdTaxLine">
              <span>Cess</span>
              <span>₹ 0.00</span>
            </div>
            <div className="gst-bill__stdTaxLine">
              <span>Additional Cess</span>
              <span>₹ 0.00</span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="gst-bill__stdFooter3">
        <div className="gst-bill__stdFootCol">
          <div className="gst-bill__stdFootTitle">Terms and Conditions</div>
          <pre className="gst-bill__stdTerms">{termsText}</pre>
        </div>
        <div className="gst-bill__stdFootCol gst-bill__stdFootCol--bank">
          <div className="gst-bill__stdQrSmall" aria-hidden>
            QR
          </div>
          <div className="gst-bill__stdFootTitle">Bank Details</div>
          <div className="gst-bill__stdBankLine">
            <span>Account No.</span>
            <span>{seller.bankAccount?.trim() || '—'}</span>
          </div>
          <div className="gst-bill__stdBankLine">
            <span>Bank Name</span>
            <span>{seller.bankName?.trim() || '—'}</span>
          </div>
          <div className="gst-bill__stdBankLine">
            <span>IFSC</span>
            <span>{seller.bankIfsc?.trim() || '—'}</span>
          </div>
          <div className="gst-bill__stdBankLine">
            <span>Branch</span>
            <span>{seller.bankBranch?.trim() || '—'}</span>
          </div>
          <div className="gst-bill__stdBankLine">
            <span>Name</span>
            <span>{seller.accountHolderName?.trim() || seller.name || '—'}</span>
          </div>
        </div>
        <div className="gst-bill__stdFootCol gst-bill__stdFootCol--sign">
          <div className="gst-bill__stdFootTitle">E-Invoice QR</div>
          <div className="gst-bill__stdQrLarge" aria-hidden>
            E-Invoice
            <br />
            QR
          </div>
          <div className="gst-bill__stdSignBlock">
            <div>For {seller.name || 'Company'}</div>
            <div className="gst-bill__stdSignLine">Authorised Signature</div>
          </div>
        </div>
      </div>

      {isGst ? (
        <div className="gst-bill__stdDeclare">
          Declaration: We declare that the particulars of goods/services and the amounts in this tax invoice are true and
          correct.
        </div>
      ) : (
        <div className="gst-bill__stdDeclare">This document is a quotation only and is not a tax invoice under GST law.</div>
      )}

      <div className="gst-bill__stdCredit">Invoice created with DukaanPro</div>
    </div>
  );
}
