import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  appendBill,
  loadBillHistory,
  loadBillingProfile,
  nextBillNumber,
  saveBillingProfile,
  type BillLineSnapshot,
  type BillingProfile,
  type SavedBill,
} from './billingStorage';
import { computeBillTotals, pdfFileName, type BillLineInput, type GenerateBillInput } from './generateBillPdf';
import { downloadGstBillPdf, printGstBill } from './gstBillPrintActions';
import { gstStateCodeOptions, stateCodeFromGstin, stateNameFromCode } from './gstInvoiceUtils';
import './seller-billing.css';

type FormLine = {
  id: string;
  description: string;
  hsnCode: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountPercent: number;
  gstPercent: number;
};

function newLine(): FormLine {
  return {
    id: crypto.randomUUID(),
    description: '',
    hsnCode: '',
    quantity: 1,
    unit: 'NOS',
    unitPrice: 0,
    discountPercent: 0,
    gstPercent: 18,
  };
}

function toGenerateInput(b: SavedBill): GenerateBillInput {
  const p = loadBillingProfile();
  const lines = b.lines.map((l) => ({
    description: l.description,
    hsnCode: l.hsnCode,
    quantity: l.quantity,
    unit: l.unit?.trim() || 'NOS',
    unitPrice: l.unitPrice,
    discountPercent: l.discountPercent ?? 0,
    gstPercent: l.gstPercent,
  }));
  const billDate = new Date(b.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  let dueDate = billDate;
  if (b.dueDate) {
    const d = new Date(b.dueDate);
    if (!Number.isNaN(d.getTime())) {
      dueDate = d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    }
  }
  const base: GenerateBillInput = {
    billNumber: b.billNumber,
    billDate,
    dueDate,
    type: b.type,
    seller: {
      name: b.sellerName,
      gstin: b.sellerGstin,
      address: b.sellerAddress,
      phone: b.sellerPhone,
      email: b.sellerEmail?.trim() || p.email?.trim(),
      pan: b.sellerPan?.trim() || p.pan?.trim(),
      fssai: b.sellerFssai?.trim() || p.fssai?.trim(),
      bankName: b.bankName?.trim() || p.bankName?.trim(),
      bankAccount: b.bankAccount?.trim() || p.bankAccount?.trim(),
      bankIfsc: b.bankIfsc?.trim() || p.bankIfsc?.trim(),
      bankBranch: b.bankBranch?.trim() || p.bankBranch?.trim(),
      accountHolderName: b.accountHolderName?.trim() || p.accountHolderName?.trim(),
    },
    customer: {
      name: b.customerName,
      email: b.customerEmail,
      phone: b.customerPhone,
      address: b.customerAddress,
      fssai: b.customerFssai?.trim(),
      shipToName: b.shipToName?.trim(),
      shipToAddress: b.shipToAddress?.trim(),
      shipToPhone: b.shipToPhone?.trim(),
      shipToGstin: b.shipToGstin?.trim(),
      sameShippingAsBilling: b.sameShippingAsBilling !== false,
    },
    lines,
    termsAndConditions: p.termsAndConditions,
  };
  if (b.type === 'gst') {
    const fallbackCode = (stateCodeFromGstin(b.sellerGstin) ?? '').padStart(2, '0').slice(0, 2);
    const posCode = (b.placeOfSupplyStateCode ?? fallbackCode).padStart(2, '0').slice(0, 2);
    const posName =
      b.placeOfSupplyStateName?.trim() ||
      stateNameFromCode(posCode) ||
      '';
    base.gst = {
      supplyType: b.gstSupplyType ?? 'intrastate',
      placeOfSupplyStateName: posName,
      placeOfSupplyStateCode: posCode,
      customerGstin: b.customerGstin ?? '',
      reverseCharge: b.reverseCharge ?? false,
    };
  }
  return base;
}

function buildEmailBody(b: SavedBill): string {
  const lines = b.lines
    .map(
      (l, i) =>
        `${i + 1}. ${l.description} — Qty ${l.quantity} × INR ${l.unitPrice.toFixed(2)} → line total INR ${(l.quantity * l.unitPrice * (1 + (b.type === 'gst' ? l.gstPercent / 100 : 0))).toFixed(2)}`,
    )
    .join('\n');
  const isInter = b.gstSupplyType === 'interstate';
  const gstNote =
    b.type === 'gst'
      ? isInter
        ? `\nTaxable: INR ${b.taxableTotal.toFixed(2)}\nIGST: INR ${(b.igst ?? 0).toFixed(2)}\n`
        : `\nTaxable: INR ${b.taxableTotal.toFixed(2)}\nCGST: INR ${b.cgst.toFixed(2)}\nSGST: INR ${b.sgst.toFixed(2)}\n`
      : '\n';
  return `Dear ${b.customerName},

Here is a summary for ${b.type === 'gst' ? 'tax invoice' : 'quotation'} ${b.billNumber} dated ${new Date(b.createdAt).toLocaleDateString('en-IN')}.

${lines}
${gstNote}Grand total: INR ${b.grandTotal.toFixed(2)}

Note: Your email app cannot attach the PDF automatically. Please use Download in DukaanPro first, then attach the file to this email.

Regards,
${b.sellerName}`;
}

function openMailto(b: SavedBill): void {
  const email = b.customerEmail.trim();
  if (!email) return;
  const subject =
    b.type === 'gst'
      ? `Tax invoice ${b.billNumber} — ${b.sellerName}`
      : `Quotation ${b.billNumber} — ${b.sellerName}`;
  let body = buildEmailBody(b);
  const max = 1800;
  if (body.length > max) {
    body = body.slice(0, max) + '\n…(truncated — open PDF for full detail)';
  }
  window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function downloadBill(b: SavedBill): void {
  void downloadGstBillPdf(toGenerateInput(b), pdfFileName(b.billNumber, b.type));
}

function printBill(b: SavedBill): void {
  printGstBill(toGenerateInput(b));
}

export function SellerBillingPage() {
  const bizNameId = useId();
  const gstinId = useId();

  const [profile, setProfile] = useState<BillingProfile>(() => loadBillingProfile());
  const [history, setHistory] = useState<SavedBill[]>(() => loadBillHistory());

  const [billType, setBillType] = useState<'gst' | 'quotation'>('quotation');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [gstSupplyType, setGstSupplyType] = useState<'intrastate' | 'interstate'>('intrastate');
  const [placeOfSupplyStateCode, setPlaceOfSupplyStateCode] = useState('');
  const [placeOfSupplyStateName, setPlaceOfSupplyStateName] = useState('');
  const [reverseCharge, setReverseCharge] = useState(false);
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [customerFssai, setCustomerFssai] = useState('');
  const [sameShippingAsBilling, setSameShippingAsBilling] = useState(true);
  const [shipToName, setShipToName] = useState('');
  const [shipToAddress, setShipToAddress] = useState('');
  const [shipToPhone, setShipToPhone] = useState('');
  const [shipToGstin, setShipToGstin] = useState('');
  const [lines, setLines] = useState<FormLine[]>(() => [newLine()]);

  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [lastBill, setLastBill] = useState<SavedBill | null>(null);

  useEffect(() => {
    setProfile(loadBillingProfile());
    setHistory(loadBillHistory());
  }, []);

  useEffect(() => {
    if (billType !== 'gst' || placeOfSupplyStateCode) return;
    const p = loadBillingProfile();
    const code = p.gstin.trim().toUpperCase().slice(0, 2);
    if (code.length === 2 && /^\d{2}$/.test(code)) {
      setPlaceOfSupplyStateCode(code);
      setPlaceOfSupplyStateName(stateNameFromCode(code) ?? '');
    }
  }, [billType, placeOfSupplyStateCode]);

  const lineInputs: BillLineInput[] = useMemo(
    () =>
      lines.map((l) => ({
        description: l.description.trim(),
        hsnCode: l.hsnCode.trim(),
        quantity: l.quantity,
        unit: (l.unit || 'NOS').trim() || 'NOS',
        unitPrice: l.unitPrice,
        discountPercent: l.discountPercent,
        gstPercent: l.gstPercent,
      })),
    [lines],
  );

  const liveTotals = useMemo(
    () => computeBillTotals(billType, lineInputs, billType === 'gst' ? gstSupplyType : 'intrastate'),
    [billType, lineInputs, gstSupplyType],
  );

  const saveProfile = useCallback(() => {
    saveBillingProfile(profile);
    setOkMsg('Business details saved on this device.');
    window.setTimeout(() => setOkMsg(null), 2500);
  }, [profile]);

  function addLine() {
    setLines((prev) => [...prev, newLine()]);
  }

  function removeLine(id: string) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.id !== id)));
  }

  function patchLine(id: string, patch: Partial<FormLine>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function validateForm(): string | null {
    if (!profile.businessName.trim()) {
      return 'Add your business name under “Your business on bills”.';
    }
    if (billType === 'gst' && !profile.gstin.trim()) {
      return 'GST invoices need your GSTIN — fill it in business details or choose Quotation.';
    }
    if (!customerName.trim()) {
      return 'Enter the customer name.';
    }
    if (billType === 'gst') {
      const pos = placeOfSupplyStateCode.trim().padStart(2, '0').slice(0, 2);
      if (!/^\d{2}$/.test(pos)) {
        return 'Choose place of supply (2-digit state / UT code).';
      }
      const cg = customerGstin.trim().toUpperCase().replace(/\s/g, '');
      if (cg && cg.length !== 15) {
        return 'Customer GSTIN must be 15 characters if entered.';
      }
    }
    const validLines = lines.filter((l) => l.description.trim().length > 0);
    if (validLines.length === 0) {
      return 'Add at least one line item with a description.';
    }
    for (const l of validLines) {
      if (!Number.isFinite(l.quantity) || l.quantity <= 0 || !Number.isInteger(l.quantity)) {
        return 'Each line needs a whole-number quantity greater than zero.';
      }
      if (!Number.isFinite(l.unitPrice) || l.unitPrice < 0) {
        return 'Each line needs a valid rate (zero or more).';
      }
      if (billType === 'gst') {
        if (!Number.isFinite(l.gstPercent) || l.gstPercent < 0 || l.gstPercent > 99) {
          return 'GST % on each line should be between 0 and 99.';
        }
      }
      if (!Number.isFinite(l.discountPercent) || l.discountPercent < 0 || l.discountPercent > 100) {
        return 'Line discount % must be between 0 and 100.';
      }
    }
    return null;
  }

  async function handleGenerate() {
    setError(null);
    setOkMsg(null);
    const v = validateForm();
    if (v) {
      setError(v);
      return;
    }

    const validLines = lines.filter((l) => l.description.trim().length > 0);
    const snapshots: BillLineSnapshot[] = validLines.map((l) => ({
      description: l.description.trim(),
      hsnCode: l.hsnCode.trim(),
      quantity: l.quantity,
      unit: (l.unit || 'NOS').trim() || 'NOS',
      unitPrice: l.unitPrice,
      discountPercent: l.discountPercent,
      gstPercent: billType === 'gst' ? l.gstPercent : 0,
    }));

    const inputs: BillLineInput[] = snapshots.map((s) => ({
      description: s.description,
      hsnCode: s.hsnCode,
      quantity: s.quantity,
      unit: s.unit,
      unitPrice: s.unitPrice,
      discountPercent: s.discountPercent ?? 0,
      gstPercent: s.gstPercent,
    }));
    const totals = computeBillTotals(
      billType,
      inputs,
      billType === 'gst' ? gstSupplyType : 'intrastate',
    );

    const posCode = placeOfSupplyStateCode.trim().padStart(2, '0').slice(0, 2);

    const dueIso = dueDate ? new Date(dueDate + 'T12:00:00').toISOString() : undefined;

    const bill: SavedBill = {
      id: crypto.randomUUID(),
      billNumber: nextBillNumber(),
      createdAt: new Date().toISOString(),
      type: billType,
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerPhone: customerPhone.trim(),
      customerAddress: customerAddress.trim(),
      customerFssai: customerFssai.trim() || undefined,
      dueDate: dueIso,
      sameShippingAsBilling,
      shipToName: sameShippingAsBilling ? undefined : shipToName.trim() || undefined,
      shipToAddress: sameShippingAsBilling ? undefined : shipToAddress.trim() || undefined,
      shipToPhone: sameShippingAsBilling ? undefined : shipToPhone.trim() || undefined,
      shipToGstin: sameShippingAsBilling
        ? undefined
        : shipToGstin.trim().toUpperCase().replace(/\s/g, '') || undefined,
      sellerName: profile.businessName.trim(),
      sellerGstin: profile.gstin.trim(),
      sellerAddress: profile.address.trim(),
      sellerPhone: profile.phone.trim(),
      sellerEmail: profile.email.trim() || undefined,
      sellerPan: profile.pan.trim() || undefined,
      sellerFssai: profile.fssai.trim() || undefined,
      bankName: profile.bankName.trim() || undefined,
      bankAccount: profile.bankAccount.trim() || undefined,
      bankIfsc: profile.bankIfsc.trim() || undefined,
      bankBranch: profile.bankBranch.trim() || undefined,
      accountHolderName: profile.accountHolderName.trim() || undefined,
      lines: snapshots,
      taxableTotal: totals.taxableTotal,
      gstTotal: totals.gstTotal,
      cgst: totals.cgst,
      sgst: totals.sgst,
      igst: totals.igst,
      grandTotal: totals.grandTotal,
      totalDiscountAmount: totals.totalDiscountAmount,
      ...(billType === 'gst'
        ? {
            gstSupplyType,
            customerGstin: customerGstin.trim().toUpperCase().replace(/\s/g, ''),
            placeOfSupplyStateName: placeOfSupplyStateName.trim(),
            placeOfSupplyStateCode: posCode,
            reverseCharge,
          }
        : {}),
    };

    appendBill(bill);
    setHistory(loadBillHistory());
    setLastBill(bill);
    try {
      await downloadGstBillPdf(toGenerateInput(bill), pdfFileName(bill.billNumber, bill.type));
      setOkMsg('PDF downloaded. You can print, email, or find it in history below.');
    } catch {
      setError('Could not create the PDF. Try Print and use “Save as PDF”, or try again.');
      setOkMsg(null);
    }
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setCustomerAddress('');
    setCustomerGstin('');
    setCustomerFssai('');
    setReverseCharge(false);
    setDueDate(new Date().toISOString().slice(0, 10));
    setSameShippingAsBilling(true);
    setShipToName('');
    setShipToAddress('');
    setShipToPhone('');
    setShipToGstin('');
    setLines([newLine()]);
  }

  return (
    <div className="bill">
      <div className="sdash__panel">
        <h2>Billing & payouts</h2>
        <p className="bill__intro">
          Create a <strong>standard India GST tax invoice</strong> (billing &amp; shipping blocks, line items with list price
          &amp; discount, tax %, amount in words, bank details, terms, QR placeholders) or a <strong>quotation</strong>.
          Data stays in this browser. <strong>Email</strong> opens your mail app — attach the PDF yourself.
        </p>
      </div>

      <div className="bill__banner">
        PDFs are generated on your device. Bill history is saved in local storage (this browser only).
      </div>

      <div className="bill__grid2">
        <div className="bill__card">
          <h3 className="bill__cardTitle">Your business on bills</h3>
          <p className="bill__cardHint">Shown on every PDF. Required for GST invoices (GSTIN).</p>

          <label className="bill__label" htmlFor={bizNameId}>
            Business name
          </label>
          <input
            id={bizNameId}
            className="bill__input"
            value={profile.businessName}
            onChange={(e) => setProfile((p) => ({ ...p, businessName: e.target.value }))}
            placeholder="Sharma General Store"
          />

          <label className="bill__label" htmlFor={gstinId}>
            GSTIN (for tax invoices)
          </label>
          <input
            id={gstinId}
            className="bill__input"
            value={profile.gstin}
            onChange={(e) => setProfile((p) => ({ ...p, gstin: e.target.value }))}
            placeholder="22AAAAA0000A1Z5"
            autoComplete="off"
          />

          <label className="bill__label" htmlFor="bill-seller-addr">
            Address
          </label>
          <textarea
            id="bill-seller-addr"
            className="bill__textarea"
            value={profile.address}
            onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))}
            placeholder="Shop no., street, city"
          />

          <label className="bill__label" htmlFor="bill-seller-phone">
            Phone
          </label>
          <input
            id="bill-seller-phone"
            className="bill__input"
            value={profile.phone}
            onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
            placeholder="+91 …"
          />

          <label className="bill__label" htmlFor="bill-seller-email">
            Email (on invoice)
          </label>
          <input
            id="bill-seller-email"
            className="bill__input"
            type="email"
            value={profile.email}
            onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
            placeholder="shop@example.com"
          />

          <label className="bill__label" htmlFor="bill-seller-pan">
            PAN (optional if same as GSTIN)
          </label>
          <input
            id="bill-seller-pan"
            className="bill__input"
            value={profile.pan}
            onChange={(e) => setProfile((p) => ({ ...p, pan: e.target.value.toUpperCase() }))}
            placeholder="AAAAA0000A"
            maxLength={10}
          />

          <label className="bill__label" htmlFor="bill-seller-fssai">
            FSSAI (food businesses, optional)
          </label>
          <input
            id="bill-seller-fssai"
            className="bill__input"
            value={profile.fssai}
            onChange={(e) => setProfile((p) => ({ ...p, fssai: e.target.value }))}
            placeholder="Licence number"
          />

          <p className="bill__cardHint" style={{ marginTop: '0.75rem' }}>
            Bank details (printed on invoice)
          </p>
          <label className="bill__label" htmlFor="bill-bank-name">
            Bank name
          </label>
          <input
            id="bill-bank-name"
            className="bill__input"
            value={profile.bankName}
            onChange={(e) => setProfile((p) => ({ ...p, bankName: e.target.value }))}
          />
          <label className="bill__label" htmlFor="bill-bank-acct">
            Account number
          </label>
          <input
            id="bill-bank-acct"
            className="bill__input"
            value={profile.bankAccount}
            onChange={(e) => setProfile((p) => ({ ...p, bankAccount: e.target.value }))}
          />
          <div className="bill__row2">
            <div>
              <label className="bill__label" htmlFor="bill-bank-ifsc">
                IFSC
              </label>
              <input
                id="bill-bank-ifsc"
                className="bill__input"
                value={profile.bankIfsc}
                onChange={(e) => setProfile((p) => ({ ...p, bankIfsc: e.target.value.toUpperCase() }))}
              />
            </div>
            <div>
              <label className="bill__label" htmlFor="bill-bank-branch">
                Branch
              </label>
              <input
                id="bill-bank-branch"
                className="bill__input"
                value={profile.bankBranch}
                onChange={(e) => setProfile((p) => ({ ...p, bankBranch: e.target.value }))}
              />
            </div>
          </div>
          <label className="bill__label" htmlFor="bill-bank-holder">
            Account holder name
          </label>
          <input
            id="bill-bank-holder"
            className="bill__input"
            value={profile.accountHolderName}
            onChange={(e) => setProfile((p) => ({ ...p, accountHolderName: e.target.value }))}
            placeholder="As per bank"
          />

          <label className="bill__label" htmlFor="bill-terms">
            Terms &amp; conditions (printed)
          </label>
          <textarea
            id="bill-terms"
            className="bill__textarea"
            rows={4}
            value={profile.termsAndConditions}
            onChange={(e) => setProfile((p) => ({ ...p, termsAndConditions: e.target.value }))}
          />

          <button type="button" className="bill__btn bill__btn--ghost" onClick={saveProfile}>
            Save business details
          </button>
        </div>

        <div className="bill__card">
          <h3 className="bill__cardTitle">Document type</h3>
          <p className="bill__cardHint">Pick one before entering items. GST mode adds HSN/SAC and tax columns on the PDF.</p>

          <div className="bill__segRow">
            <button
              type="button"
              className={`bill__seg ${billType === 'gst' ? 'bill__seg--on' : ''}`}
              onClick={() => setBillType('gst')}
            >
              GST tax invoice
            </button>
            <button
              type="button"
              className={`bill__seg ${billType === 'quotation' ? 'bill__seg--on' : ''}`}
              onClick={() => setBillType('quotation')}
            >
              Quotation (non-tax)
            </button>
          </div>

          <h3 className="bill__cardTitle" style={{ marginTop: '0.5rem' }}>
            Customer
          </h3>

          <label className="bill__label" htmlFor="bill-cust-name">
            Name
          </label>
          <input
            id="bill-cust-name"
            className="bill__input"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Customer or business name"
          />

          <div className="bill__row2">
            <div>
              <label className="bill__label" htmlFor="bill-cust-email">
                Email (for send)
              </label>
              <input
                id="bill-cust-email"
                className="bill__input"
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>
            <div>
              <label className="bill__label" htmlFor="bill-cust-phone">
                Phone
              </label>
              <input
                id="bill-cust-phone"
                className="bill__input"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
          </div>

          <label className="bill__label" htmlFor="bill-cust-addr">
            Address (optional)
          </label>
          <textarea
            id="bill-cust-addr"
            className="bill__textarea"
            value={customerAddress}
            onChange={(e) => setCustomerAddress(e.target.value)}
            rows={2}
          />

          <label className="bill__label" htmlFor="bill-due-date">
            Due date
          </label>
          <input
            id="bill-due-date"
            className="bill__input"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />

          <label className="bill__label" htmlFor="bill-cust-fssai">
            Customer FSSAI (optional)
          </label>
          <input
            id="bill-cust-fssai"
            className="bill__input"
            value={customerFssai}
            onChange={(e) => setCustomerFssai(e.target.value)}
            placeholder="If applicable"
          />

          <label
            className="bill__label"
            htmlFor="bill-same-ship"
            style={{ textTransform: 'none', letterSpacing: 'normal' }}
          >
            <input
              id="bill-same-ship"
              type="checkbox"
              checked={sameShippingAsBilling}
              onChange={(e) => setSameShippingAsBilling(e.target.checked)}
            />{' '}
            Shipping address same as billing
          </label>

          {!sameShippingAsBilling ? (
            <>
              <h3 className="bill__cardTitle" style={{ marginTop: '0.75rem' }}>
                Ship to
              </h3>
              <label className="bill__label" htmlFor="bill-ship-name">
                Name
              </label>
              <input
                id="bill-ship-name"
                className="bill__input"
                value={shipToName}
                onChange={(e) => setShipToName(e.target.value)}
              />
              <label className="bill__label" htmlFor="bill-ship-phone">
                Phone
              </label>
              <input
                id="bill-ship-phone"
                className="bill__input"
                value={shipToPhone}
                onChange={(e) => setShipToPhone(e.target.value)}
              />
              <label className="bill__label" htmlFor="bill-ship-gstin">
                GSTIN (optional)
              </label>
              <input
                id="bill-ship-gstin"
                className="bill__input"
                value={shipToGstin}
                onChange={(e) => setShipToGstin(e.target.value.toUpperCase())}
                maxLength={15}
              />
              <label className="bill__label" htmlFor="bill-ship-addr">
                Address
              </label>
              <textarea
                id="bill-ship-addr"
                className="bill__textarea"
                value={shipToAddress}
                onChange={(e) => setShipToAddress(e.target.value)}
                rows={2}
              />
            </>
          ) : null}

          {billType === 'gst' ? (
            <>
              <h3 className="bill__cardTitle" style={{ marginTop: '0.85rem' }}>
                GST fields (invoice)
              </h3>
              <p className="bill__cardHint">
                Intra-state supplies show CGST + SGST (half the GST % each). Inter-state supplies show IGST only. Place of
                supply defaults from your GSTIN — change if the goods / services are taxed in another state.
              </p>

              <div className="bill__segRow">
                <button
                  type="button"
                  className={`bill__seg ${gstSupplyType === 'intrastate' ? 'bill__seg--on' : ''}`}
                  onClick={() => setGstSupplyType('intrastate')}
                >
                  Intra-state (CGST + SGST)
                </button>
                <button
                  type="button"
                  className={`bill__seg ${gstSupplyType === 'interstate' ? 'bill__seg--on' : ''}`}
                  onClick={() => setGstSupplyType('interstate')}
                >
                  Inter-state (IGST)
                </button>
              </div>

              <label className="bill__label" htmlFor="bill-pos">
                Place of supply (state / UT)
              </label>
              <select
                id="bill-pos"
                className="bill__input"
                value={placeOfSupplyStateCode}
                onChange={(e) => {
                  const code = e.target.value;
                  setPlaceOfSupplyStateCode(code);
                  setPlaceOfSupplyStateName(stateNameFromCode(code) ?? '');
                }}
              >
                <option value="">Select state code…</option>
                {gstStateCodeOptions().map(({ code, name }) => (
                  <option key={code} value={code}>
                    {code} — {name}
                  </option>
                ))}
              </select>

              <label className="bill__label" htmlFor="bill-cust-gstin">
                Customer GSTIN / UIN (optional)
              </label>
              <input
                id="bill-cust-gstin"
                className="bill__input"
                value={customerGstin}
                onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                placeholder="15-character GSTIN if registered"
                maxLength={15}
                autoComplete="off"
              />

              <label
                className="bill__label"
                htmlFor="bill-rev-charge"
                style={{ textTransform: 'none', letterSpacing: 'normal' }}
              >
                <input
                  id="bill-rev-charge"
                  type="checkbox"
                  checked={reverseCharge}
                  onChange={(e) => setReverseCharge(e.target.checked)}
                />{' '}
                Reverse charge applicable
              </label>
            </>
          ) : null}
        </div>
      </div>

      <div className="bill__card">
        <div className="bill__linesHead">
          <h3 className="bill__linesTitle">Items purchased</h3>
          <button type="button" className="bill__btn bill__btn--ghost bill__btn--sm" onClick={addLine}>
            + Add line
          </button>
        </div>

        {lines.map((line) => (
          <div key={line.id} className="bill__lineCard">
            <div
              className={
                billType === 'gst' ? 'bill__lineGrid bill__lineGrid--gst' : 'bill__lineGrid bill__lineGrid--quote'
              }
            >
              <div style={{ gridColumn: 'span 2' }}>
                <label className="bill__label">Description</label>
                <input
                  className="bill__input"
                  style={{ marginBottom: 0 }}
                  value={line.description}
                  onChange={(e) => patchLine(line.id, { description: e.target.value })}
                  placeholder="Product or service"
                />
              </div>
              {billType === 'gst' ? (
                <div>
                  <label className="bill__label">HSN / SAC</label>
                  <input
                    className="bill__input"
                    style={{ marginBottom: 0 }}
                    value={line.hsnCode}
                    onChange={(e) => patchLine(line.id, { hsnCode: e.target.value })}
                    placeholder="e.g. 1006"
                  />
                </div>
              ) : null}
              <div>
                <label className="bill__label">Qty</label>
                <input
                  className="bill__input"
                  style={{ marginBottom: 0 }}
                  type="number"
                  min={1}
                  step={1}
                  value={line.quantity}
                  onChange={(e) => patchLine(line.id, { quantity: Math.max(1, Math.floor(Number(e.target.value)) || 1) })}
                />
              </div>
              <div>
                <label className="bill__label">UQC (unit)</label>
                <input
                  className="bill__input"
                  style={{ marginBottom: 0 }}
                  value={line.unit}
                  onChange={(e) => patchLine(line.id, { unit: e.target.value.toUpperCase().slice(0, 8) })}
                  placeholder="NOS"
                  maxLength={8}
                />
              </div>
              <div>
                <label className="bill__label">List price (INR)</label>
                <input
                  className="bill__input"
                  style={{ marginBottom: 0 }}
                  type="number"
                  min={0}
                  step={0.01}
                  value={line.unitPrice}
                  onChange={(e) => patchLine(line.id, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
                />
              </div>
              <div>
                <label className="bill__label">Disc. %</label>
                <input
                  className="bill__input"
                  style={{ marginBottom: 0 }}
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={line.discountPercent}
                  onChange={(e) => patchLine(line.id, { discountPercent: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                />
              </div>
              {billType === 'gst' ? (
                <div>
                  <label className="bill__label">GST %</label>
                  <input
                    className="bill__input"
                    style={{ marginBottom: 0 }}
                    type="number"
                    min={0}
                    max={99}
                    step={0.25}
                    value={line.gstPercent}
                    onChange={(e) => patchLine(line.id, { gstPercent: Number(e.target.value) || 0 })}
                  />
                </div>
              ) : null}
            </div>
            <button type="button" className="bill__lineRemove" onClick={() => removeLine(line.id)}>
              Remove line
            </button>
          </div>
        ))}

        <div className="bill__totals">
          {liveTotals.totalDiscountAmount > 0 ? (
            <div className="bill__totalsRow">
              <span>Total discount</span>
              <span>INR {liveTotals.totalDiscountAmount.toFixed(2)}</span>
            </div>
          ) : null}
          {billType === 'gst' && gstSupplyType === 'interstate' ? (
            <>
              <div className="bill__totalsRow">
                <span>Taxable value</span>
                <span>INR {liveTotals.taxableTotal.toFixed(2)}</span>
              </div>
              <div className="bill__totalsRow">
                <span>IGST</span>
                <span>INR {liveTotals.igst.toFixed(2)}</span>
              </div>
            </>
          ) : billType === 'gst' ? (
            <>
              <div className="bill__totalsRow">
                <span>Taxable value</span>
                <span>INR {liveTotals.taxableTotal.toFixed(2)}</span>
              </div>
              <div className="bill__totalsRow">
                <span>CGST</span>
                <span>INR {liveTotals.cgst.toFixed(2)}</span>
              </div>
              <div className="bill__totalsRow">
                <span>SGST / UTGST</span>
                <span>INR {liveTotals.sgst.toFixed(2)}</span>
              </div>
            </>
          ) : (
            <div className="bill__totalsRow">
              <span>Subtotal (after discount)</span>
              <span>INR {liveTotals.grandTotal.toFixed(2)}</span>
            </div>
          )}
          <div className="bill__totalsRow">
            <span>Grand total</span>
            <span>INR {liveTotals.grandTotal.toFixed(2)}</span>
          </div>
        </div>

        {error ? (
          <p className="bill__error" role="alert">
            {error}
          </p>
        ) : null}
        {okMsg ? (
          <p className="bill__ok" role="status">
            {okMsg}
          </p>
        ) : null}

        <div className="bill__actions">
          <button type="button" className="bill__btn bill__btn--primary" onClick={handleGenerate}>
            Generate & download PDF
          </button>
        </div>

        {lastBill ? (
          <div className="bill__actions" style={{ borderTop: 'none', paddingTop: 0 }}>
            <span className="bill__label" style={{ width: '100%', marginBottom: 0 }}>
              Last generated: {lastBill.billNumber}
            </span>
            <button type="button" className="bill__btn bill__btn--ghost bill__btn--sm" onClick={() => downloadBill(lastBill)}>
              Download again
            </button>
            <button type="button" className="bill__btn bill__btn--ghost bill__btn--sm" onClick={() => printBill(lastBill)}>
              Print
            </button>
            <button
              type="button"
              className="bill__btn bill__btn--ghost bill__btn--sm"
              disabled={!lastBill.customerEmail.trim()}
              title={!lastBill.customerEmail.trim() ? 'Add customer email before generating' : undefined}
              onClick={() => openMailto(lastBill)}
            >
              Email customer
            </button>
          </div>
        ) : null}
      </div>

      <div className="sdash__panel">
        <h2>Bill history</h2>
        <p className="bill__intro" style={{ marginBottom: '1rem' }}>
          Recent documents saved on this device (newest first).
        </p>
        {history.length === 0 ? (
          <p className="bill__emptyHist">No bills yet — generate one above.</p>
        ) : (
          <div className="bill__history">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Number</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.map((b) => (
                  <tr key={b.id}>
                    <td>{new Date(b.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                    <td>
                      <span className={b.type === 'gst' ? 'bill__tag bill__tag--gst' : 'bill__tag bill__tag--q'}>
                        {b.type === 'gst' ? 'GST' : 'Quote'}
                      </span>
                    </td>
                    <td>
                      <code style={{ fontSize: '0.78em' }}>{b.billNumber}</code>
                    </td>
                    <td>{b.customerName}</td>
                    <td>INR {b.grandTotal.toFixed(2)}</td>
                    <td>
                      <div className="bill__historyActions">
                        <button type="button" className="bill__btn bill__btn--ghost bill__btn--sm" onClick={() => downloadBill(b)}>
                          PDF
                        </button>
                        <button type="button" className="bill__btn bill__btn--ghost bill__btn--sm" onClick={() => printBill(b)}>
                          Print
                        </button>
                        <button
                          type="button"
                          className="bill__btn bill__btn--ghost bill__btn--sm"
                          disabled={!b.customerEmail.trim()}
                          onClick={() => openMailto(b)}
                        >
                          Email
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
