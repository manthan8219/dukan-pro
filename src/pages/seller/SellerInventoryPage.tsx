import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { SafeQRCode } from '../../scannerRelay/SafeQRCode';
import { useLaptopScannerRelay } from '../../scannerRelay/useLaptopScannerRelay';
import {
  createCatalogProduct,
  normalizeProductName,
  resolveCatalogProductByBarcode,
  searchCatalogProducts,
  type CatalogProductRecord,
} from '../../api/products';
import {
  createShopProduct,
  deleteShopProduct,
  importShopProductsCsv,
  listShopProducts,
  updateShopProduct,
  type ShopProductListing,
} from '../../api/shopProducts';
import type { SellerOutletContext } from './SellerLayout';
import './seller-inventory.css';

type CatalogProduct = {
  id: string;
  name: string;
  quantity: number;
  /** Local object URL for preview — revoke when removing; server rows use https URL */
  imageUrl: string | null;
  source: 'manual' | 'csv' | 'server';
  catalogProductId?: string;
  unit?: string;
  /** Server listings: price in minor units (paise) */
  priceMinor?: number;
};

/**
 * UTF-8 CSV: row 1 = headers, then one product per line. Quantity = whole units in stock.
 * With a linked shop, add selling price in ₹ (or use price_minor for paise); backend can also use CSV_IMPORT_DEFAULT_PRICE_RUPEES.
 */
const EXPECTED_CSV_SAMPLE = `name,quantity,price
Basmati rice 5kg,24,129.00
"Toor dal, 1kg pack",18,95
Fresh tomatoes (per kg),42,40
`;

function downloadExpectedCsvSample(): void {
  const blob = new Blob([EXPECTED_CSV_SAMPLE], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dukaanpro-catalog-sample.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function newId(): string {
  return crypto.randomUUID();
}

function listingToLocal(l: ShopProductListing): CatalogProduct {
  return {
    id: l.id,
    name: l.productName,
    quantity: l.quantity,
    imageUrl: l.displayImageUrl,
    source: 'server',
    catalogProductId: l.productId,
    unit: l.unit,
    priceMinor: l.priceMinor,
  };
}

/** Rupees string → paise; min ₹0.01, max backend cap */
function rupeesInputToMinor(input: string): number | null {
  const t = input.trim().replace(/,/g, '');
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  const minor = Math.round(n * 100 + Number.EPSILON);
  if (minor < 1) return null;
  if (minor > 2_000_000_000) return null;
  return minor;
}

function formatInrFromMinor(minor: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

function getErrorStatus(e: unknown): number | undefined {
  return typeof e === 'object' && e !== null && 'status' in e
    ? (e as { status?: number }).status
    : undefined;
}

/** Minimal CSV parser: commas, quoted fields, CRLF */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let i = 0;
  let inQuotes = false;
  while (i < text.length) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ',') {
      row.push(field.trim());
      field = '';
      i += 1;
      continue;
    }
    if (c === '\r') {
      i += 1;
      continue;
    }
    if (c === '\n') {
      row.push(field.trim());
      field = '';
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  row.push(field.trim());
  if (row.some((cell) => cell.length > 0)) {
    rows.push(row);
  }
  return rows;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, '_');
}

function pickColumnIndex(headers: string[], candidates: string[]): number {
  const norm = headers.map(normalizeHeader);
  for (const want of candidates) {
    const w = want.toLowerCase();
    const idx = norm.findIndex((h) => h === w || h.replace(/_/g, '') === w.replace(/_/g, ''));
    if (idx >= 0) return idx;
  }
  for (const want of candidates) {
    const w = want.toLowerCase();
    const idx = norm.findIndex((h) => h.includes(w) || w.includes(h));
    if (idx >= 0) return idx;
  }
  return -1;
}

type CsvPreviewRow = { name: string; quantity: number; ok: boolean; reason?: string };

export function SellerInventoryPage() {
  const { shopId } = useOutletContext<SellerOutletContext>();
  const nameId = useId();
  const qtyId = useId();
  const priceId = useId();
  const listboxId = useId();
  const comboRef = useRef<HTMLDivElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const productsRef = useRef(products);
  productsRef.current = products;

  const [draftName, setDraftName] = useState('');
  const [draftQty, setDraftQty] = useState('1');
  /** Rupees (major units) while typing; converted to paise for API */
  const [draftPriceRupees, setDraftPriceRupees] = useState('');
  const [draftPreviewUrl, setDraftPreviewUrl] = useState<string | null>(null);
  const [photoInputKey, setPhotoInputKey] = useState(0);
  const [pickedCatalog, setPickedCatalog] = useState<CatalogProductRecord | null>(null);

  const [searchResults, setSearchResults] = useState<CatalogProductRecord[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  /** True after the latest debounced request for the current text finished (even with 0 hits). */
  const [searchSettled, setSearchSettled] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [formApiError, setFormApiError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  const [csvText, setCsvText] = useState<string | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvPreview, setCsvPreview] = useState<CsvPreviewRow[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvMessage, setCsvMessage] = useState<string | null>(null);
  const [csvImportLoading, setCsvImportLoading] = useState(false);

  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  const [barcodeLookupBusy, setBarcodeLookupBusy] = useState(false);
  const [barcodeLookupError, setBarcodeLookupError] = useState<string | null>(null);
  const [pendingBarcodeForCreate, setPendingBarcodeForCreate] = useState<string | null>(
    null,
  );
  const [recentBarcodeScans, setRecentBarcodeScans] = useState<
    Array<{ barcode: string; source: string; label: string; at: number }>
  >([]);

  const applyBarcodeFromScanner = useCallback(async (barcode: string) => {
    setBarcodeLookupBusy(true);
    setBarcodeLookupError(null);
    setFormApiError(null);
    try {
      const result = await resolveCatalogProductByBarcode(barcode);
      const label =
        result.product?.name ??
        (result.source === 'unknown' ? 'Not found — add manually' : '—');
      setRecentBarcodeScans((prev) =>
        [
          {
            barcode: result.barcode,
            source: result.source,
            label,
            at: Date.now(),
          },
          ...prev,
        ].slice(0, 8),
      );

      if (result.product) {
        setDraftName(result.product.name);
        setPickedCatalog(result.product);
        setSearchOpen(false);
        setPendingBarcodeForCreate(null);
        const src =
          result.source === 'local'
            ? 'In your catalog'
            : 'From Open Food Facts (saved to catalog)';
        setScanFeedback(`${src}: ${result.product.name}`);
      } else {
        setDraftName('');
        setPickedCatalog(null);
        setSearchOpen(true);
        setPendingBarcodeForCreate(result.barcode);
        setScanFeedback(
          `Barcode ${result.barcode} — not in your catalog or Open Food Facts. Enter a product name; the barcode will be saved on the new catalog product when you add.`,
        );
      }
    } catch (e) {
      setBarcodeLookupError(e instanceof Error ? e.message : 'Barcode lookup failed');
    } finally {
      setBarcodeLookupBusy(false);
    }
    queueMicrotask(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, []);

  const scannerRelay = useLaptopScannerRelay(applyBarcodeFromScanner);

  useEffect(() => {
    if (!scanFeedback) return;
    const t = window.setTimeout(() => setScanFeedback(null), 7000);
    return () => window.clearTimeout(t);
  }, [scanFeedback]);

  const revokeUrl = useCallback((url: string | null) => {
    if (url) URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    return () => {
      productsRef.current.forEach((p) => {
        if (p.imageUrl?.startsWith('blob:')) URL.revokeObjectURL(p.imageUrl);
      });
    };
  }, []);

  useEffect(() => {
    return () => {
      if (draftPreviewUrl) URL.revokeObjectURL(draftPreviewUrl);
    };
  }, [draftPreviewUrl]);

  useEffect(() => {
    if (!shopId) {
      setLoadError(null);
      return;
    }
    const ac = new AbortController();
    void (async () => {
      setLoadError(null);
      try {
        const rows = await listShopProducts(shopId, ac.signal);
        if (ac.signal.aborted) return;
        setProducts(rows.map(listingToLocal));
      } catch (e) {
        if (ac.signal.aborted) return;
        setLoadError(e instanceof Error ? e.message : 'Could not load shop catalog');
      }
    })();
    return () => ac.abort();
  }, [shopId]);

  useEffect(() => {
    const q = draftName.trim();
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (q.length < 1) {
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
      setSearchSettled(false);
      return;
    }

    searchDebounceRef.current = setTimeout(() => {
      searchAbortRef.current?.abort();
      const ac = new AbortController();
      searchAbortRef.current = ac;
      setSearchLoading(true);
      setSearchSettled(false);
      setSearchError(null);
      void (async () => {
        try {
          const rows = await searchCatalogProducts(q, 20, ac.signal);
          if (ac.signal.aborted) return;
          setSearchResults(rows);
        } catch (e) {
          if (ac.signal.aborted) return;
          setSearchError(e instanceof Error ? e.message : 'Catalog search failed');
          setSearchResults([]);
        } finally {
          if (!ac.signal.aborted) {
            setSearchLoading(false);
            setSearchSettled(true);
          }
        }
      })();
    }, 320);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [draftName]);

  useEffect(() => {
    function onDocMouseDown(ev: MouseEvent) {
      const el = comboRef.current;
      if (!el || !searchOpen) return;
      if (ev.target instanceof Node && !el.contains(ev.target)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [searchOpen]);

  function onDraftFileChange(file: File | null) {
    setDraftPreviewUrl((prev) => {
      revokeUrl(prev);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  function pickSearchResult(p: CatalogProductRecord) {
    setDraftName(p.name);
    setPickedCatalog(p);
    setSearchOpen(false);
    setPendingBarcodeForCreate(null);
  }

  async function addProduct() {
    const name = draftName.trim();
    const q = Number(draftQty);
    if (name.length < 1) return;
    if (!Number.isFinite(q) || q < 0 || !Number.isInteger(q)) return;

    setFormApiError(null);

    if (shopId) {
      const priceMinor = rupeesInputToMinor(draftPriceRupees);
      if (priceMinor === null) return;

      setAddLoading(true);
      try {
        let productId = pickedCatalog?.id;
        if (!productId) {
          try {
            const created = await createCatalogProduct({
              name,
              barcode: pendingBarcodeForCreate ?? undefined,
            });
            productId = created.id;
          } catch (e) {
            if (getErrorStatus(e) === 409) {
              const hits = await searchCatalogProducts(name, 20);
              const want = normalizeProductName(name);
              const hit =
                hits.find((h) => h.nameNormalized === want) ?? hits[0];
              if (!hit) throw e;
              productId = hit.id;
            } else {
              throw e;
            }
          }
        }

        try {
          const listing = await createShopProduct(shopId, {
            productId,
            quantity: q,
            priceMinor,
          });
          setProducts((prev) => {
            const rest = prev.filter(
              (p) => !(p.source === 'server' && p.catalogProductId === productId),
            );
            return [listingToLocal(listing), ...rest];
          });
        } catch (e) {
          if (getErrorStatus(e) === 409) {
            const listing = await updateShopProduct(shopId, productId, {
              quantity: q,
              priceMinor,
            });
            setProducts((prev) => {
              const mapped = listingToLocal(listing);
              const idx = prev.findIndex(
                (p) => p.source === 'server' && p.catalogProductId === productId,
              );
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = mapped;
                return next;
              }
              return [mapped, ...prev];
            });
          } else {
            throw e;
          }
        }
      } catch (e) {
        setFormApiError(e instanceof Error ? e.message : 'Could not save to server');
        setAddLoading(false);
        return;
      }
      setAddLoading(false);
    } else {
      const imageUrl = draftPreviewUrl;
      setDraftPreviewUrl(null);
      setProducts((prev) => [
        ...prev,
        {
          id: newId(),
          name,
          quantity: q,
          imageUrl,
          source: 'manual',
        },
      ]);
    }

    setDraftPreviewUrl((prev) => {
      revokeUrl(prev);
      return null;
    });
    setDraftName('');
    setDraftQty('1');
    setDraftPriceRupees('');
    setPickedCatalog(null);
    setPendingBarcodeForCreate(null);
    setPhotoInputKey((k) => k + 1);
    setSearchResults([]);
  }

  async function removeProduct(id: string) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    if (shopId && p.source === 'server' && p.catalogProductId) {
      try {
        await deleteShopProduct(shopId, p.catalogProductId);
      } catch (e) {
        setFormApiError(e instanceof Error ? e.message : 'Could not remove listing');
        return;
      }
    }
    if (p.imageUrl?.startsWith('blob:')) URL.revokeObjectURL(p.imageUrl);
    setProducts((prev) => prev.filter((x) => x.id !== id));
  }

  async function setQuantity(id: string, next: number) {
    const q = Math.max(0, Math.floor(next));
    const p = products.find((x) => x.id === id);
    if (shopId && p?.source === 'server' && p.catalogProductId) {
      try {
        const listing = await updateShopProduct(shopId, p.catalogProductId, {
          quantity: q,
        });
        setProducts((prev) =>
          prev.map((x) => (x.id === id ? listingToLocal(listing) : x)),
        );
      } catch (e) {
        setFormApiError(e instanceof Error ? e.message : 'Could not update quantity');
      }
      return;
    }
    setProducts((prev) => prev.map((x) => (x.id === id ? { ...x, quantity: q } : x)));
  }

  function processCsvFile(file: File) {
    setCsvError(null);
    setCsvMessage(null);
    setCsvPreview([]);
    setCsvText(null);
    setCsvFile(file);
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setCsvText(text);
      const rows = parseCsvRows(text);
      if (rows.length === 0) {
        setCsvError('No rows found in this file.');
        return;
      }
      const headers = rows[0]!.map((c) => c.trim());
      const nameIdx = pickColumnIndex(headers, ['name', 'product', 'product_name', 'title', 'item']);
      const qtyIdx = pickColumnIndex(headers, ['quantity', 'qty', 'stock', 'count', 'units']);
      if (nameIdx < 0 || qtyIdx < 0) {
        setCsvError(
          'Need a header row with name and quantity columns (e.g. name,quantity or product_name,qty).',
        );
        return;
      }
      const dataRows = rows.slice(1);
      const preview: CsvPreviewRow[] = dataRows.map((cells) => {
        const name = (cells[nameIdx] ?? '').trim();
        const rawQ = (cells[qtyIdx] ?? '').trim();
        const qty = Number(rawQ.replace(/,/g, ''));
        if (!name) {
          return { name: '—', quantity: 0, ok: false, reason: 'Empty name' };
        }
        if (!Number.isFinite(qty) || qty < 0 || !Number.isInteger(qty)) {
          return { name, quantity: 0, ok: false, reason: 'Bad quantity' };
        }
        return { name, quantity: qty, ok: true };
      });
      setCsvPreview(preview);
      const good = preview.filter((r) => r.ok).length;
      const bad = preview.length - good;
      setCsvMessage(
        `${preview.length} row(s) parsed — ${good} ready to import${bad ? `, ${bad} skipped` : ''}.`,
      );
    };
    reader.onerror = () => setCsvError('Could not read the file.');
    reader.readAsText(file, 'UTF-8');
  }

  const importableCsvRows = useMemo(() => csvPreview.filter((r) => r.ok), [csvPreview]);

  async function importCsvIntoCatalog() {
    if (importableCsvRows.length === 0) return;
    if (shopId && csvFile) {
      setCsvImportLoading(true);
      setFormApiError(null);
      try {
        const res = await importShopProductsCsv(shopId, csvFile);
        const rows = await listShopProducts(shopId);
        setProducts(rows.map(listingToLocal));
        const parts = [
          `${res.created} listing(s) created`,
          `${res.updated} updated`,
        ];
        if (res.skippedParse > 0) {
          parts.push(`${res.skippedParse} row(s) skipped while parsing`);
        }
        setCsvMessage(`${parts.join(', ')}.`);
        if (res.parseWarnings?.length) {
          const sample = res.parseWarnings
            .slice(0, 5)
            .map((w) => `Row ${w.rowNumber}: ${w.message}`)
            .join(' ');
          setCsvMessage((prev) =>
            prev ? `${prev} Parse notes: ${sample}${res.parseWarnings!.length > 5 ? ' …' : ''}` : sample,
          );
        }
        if (res.errors?.length) {
          setFormApiError(res.errors.slice(0, 3).join(' ') + (res.errors.length > 3 ? ' …' : ''));
        }
        setCsvPreview([]);
        setCsvText(null);
        setCsvFileName(null);
        setCsvFile(null);
      } catch (e) {
        setFormApiError(e instanceof Error ? e.message : 'CSV import failed');
      } finally {
        setCsvImportLoading(false);
      }
      return;
    }

    setProducts((prev) => [
      ...prev,
      ...importableCsvRows.map((r) => ({
        id: newId(),
        name: r.name,
        quantity: r.quantity,
        imageUrl: null as string | null,
        source: 'csv' as const,
      })),
    ]);
    setCsvMessage(
      `Added ${importableCsvRows.length} product(s) from CSV (browser only until you connect a shop).`,
    );
    setCsvPreview([]);
    setCsvText(null);
    setCsvFileName(null);
    setCsvFile(null);
  }

  const qtyParsed = Number(draftQty);
  const priceMinorForForm = shopId ? rupeesInputToMinor(draftPriceRupees) : 1;
  const canAdd =
    draftName.trim().length >= 1 &&
    draftQty.trim() !== '' &&
    Number.isInteger(qtyParsed) &&
    qtyParsed >= 0 &&
    !addLoading &&
    (!shopId || priceMinorForForm !== null);

  const showSuggestions =
    searchOpen &&
    draftName.trim().length >= 1 &&
    (searchLoading || !!searchError || searchSettled);

  return (
    <div className="inv">
      <div className="sdash__panel">
        <h2>Stock & catalog</h2>
        <p className="inv__intro">
          While you type a product name, we search the shared <strong>global catalog</strong>. With a shop linked, enter{' '}
          <strong>your selling price in ₹</strong>; the catalog does not set a price for you.
        </p>
      </div>

      {shopId ? (
        <div className={`inv__banner ${loadError ? 'inv__banner--note' : 'inv__banner--ok'}`}>
          {loadError
            ? `Could not load shop stock: ${loadError}`
            : 'Shop linked — your list loads from the server. Typing in the name field searches the global catalog.'}
        </div>
      ) : (
        <div className="inv__banner inv__banner--note">
          No shop id in session — name search still works; rows you add stay in this browser only until onboarding
          supplies a shop.
        </div>
      )}

      <section className="inv__scannerPanel" aria-label="Phone barcode scanner">
        <div className="inv__scannerPanelHead">
          <h3 className="inv__scannerPanelTitle">Add with phone camera</h3>
          <p className="inv__scannerPanelHint">
            Pair your phone here. Each scan checks <strong>your catalog</strong>, then <strong>Open Food Facts</strong>; if
            still unknown, you enter a name and add — the barcode is stored on the new product.
          </p>
        </div>
        {barcodeLookupBusy ? (
          <p className="inv__scannerLookup" role="status">
            Looking up barcode…
          </p>
        ) : null}
        {barcodeLookupError ? <p className="inv__scannerErr">{barcodeLookupError}</p> : null}
        {scannerRelay.httpError ? (
          <p className="inv__scannerErr">{scannerRelay.httpError}</p>
        ) : null}
        {scannerRelay.socketError ? (
          <p className="inv__scannerErr">{scannerRelay.socketError}</p>
        ) : null}
        <div className="inv__scannerActions">
          {!scannerRelay.active ? (
            <button
              type="button"
              className="inv__scannerBtn"
              disabled={scannerRelay.starting}
              onClick={() => void scannerRelay.start()}
            >
              {scannerRelay.starting ? 'Starting…' : 'Show QR for phone'}
            </button>
          ) : (
            <>
              <button type="button" className="inv__scannerBtn inv__scannerBtn--ghost" onClick={scannerRelay.stop}>
                Stop pairing
              </button>
              <span
                className={`inv__scannerPill inv__scannerPill--${
                  scannerRelay.phoneConnected ? 'on' : 'off'
                }`}
              >
                {scannerRelay.phoneConnected ? 'Phone connected' : 'Waiting for phone…'}
              </span>
            </>
          )}
        </div>
        {scannerRelay.active && scannerRelay.scanUrl ? (
          <div className="inv__scannerQrRow">
            <div className="inv__scannerQrBox">
              <SafeQRCode value={scannerRelay.scanUrl} size={168} level="M" />
            </div>
            <p className="inv__scannerQrMeta">
              Scan with your phone — opens the camera page. Each scan is resolved (catalog → Open Food Facts → manual).
            </p>
          </div>
        ) : null}
        {recentBarcodeScans.length > 0 ? (
          <div className="inv__scanHistory" aria-label="Recent scans this session">
            <span className="inv__scanHistoryTitle">Recent scans</span>
            <ul className="inv__scanHistoryList">
              {recentBarcodeScans.map((row) => (
                <li key={`${row.at}-${row.barcode}`} className="inv__scanHistoryItem">
                  <span className="inv__scanHistoryCode">{row.barcode}</span>
                  <span className="inv__scanHistorySrc">{row.source}</span>
                  <span className="inv__scanHistoryLabel">{row.label}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <div className="inv__grid2">
        <div className="inv__card">
          <h3 className="inv__cardTitle">Add a product</h3>
          <p className="inv__cardHint">
            Product name, stock, and (with a linked shop) your price in rupees. Optional photo. Pick a suggestion to reuse
            a catalog id.
          </p>
          {scanFeedback ? <p className="inv__scanFeedback">{scanFeedback}</p> : null}
          {pendingBarcodeForCreate ? (
            <p className="inv__pendingBarcode">
              Barcode to save on new product:{' '}
              <code className="inv__code">{pendingBarcodeForCreate}</code>
            </p>
          ) : null}

          <label className="inv__label" htmlFor={nameId}>
            Product name
          </label>
          <div className="inv__combo" ref={comboRef}>
            <input
              ref={nameInputRef}
              id={nameId}
              className="inv__input inv__input--combo"
              role="combobox"
              aria-expanded={showSuggestions}
              aria-controls={listboxId}
              aria-autocomplete="list"
              value={draftName}
              onChange={(e) => {
                const v = e.target.value;
                setDraftName(v);
                setSearchOpen(true);
                if (pickedCatalog && normalizeProductName(v) !== normalizeProductName(pickedCatalog.name)) {
                  setPickedCatalog(null);
                }
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="e.g. Basmati rice 5kg"
              maxLength={200}
              autoComplete="off"
            />
            {pickedCatalog ? (
              <p className="inv__pickedHint">
                Linked to catalog id <code className="inv__code">{pickedCatalog.id.slice(0, 8)}…</code> — change the
                text to search again.
              </p>
            ) : null}
            {showSuggestions ? (
              <ul className="inv__suggest" id={listboxId} role="listbox">
                {searchLoading ? (
                  <li className="inv__suggestItem inv__suggestItem--meta" role="presentation">
                    Searching catalog…
                  </li>
                ) : null}
                {searchError ? (
                  <li className="inv__suggestItem inv__suggestItem--err" role="presentation">
                    {searchError}
                  </li>
                ) : null}
                {!searchLoading && !searchError && searchResults.length === 0 ? (
                  <li className="inv__suggestItem inv__suggestItem--meta" role="presentation">
                    No matches — you can still add a new name{shopId ? ' (creates a catalog product if needed)' : ''}.
                  </li>
                ) : null}
                {searchResults.map((p) => (
                  <li key={p.id} role="option">
                    <button
                      type="button"
                      className="inv__suggestBtn"
                      onMouseDown={(ev) => ev.preventDefault()}
                      onClick={() => pickSearchResult(p)}
                    >
                      <span className="inv__suggestName">{p.name}</span>
                      {p.category ? (
                        <span className="inv__suggestCat">{p.category}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="inv__row2">
            <div>
              <label className="inv__label" htmlFor={qtyId}>
                Quantity in stock
              </label>
              <input
                id={qtyId}
                className="inv__input"
                type="number"
                min={0}
                step={1}
                value={draftQty}
                onChange={(e) => setDraftQty(e.target.value)}
              />
            </div>
            <div>
              <span className="inv__label">Photo (optional)</span>
              <div className="inv__photoZone">
                <input
                  key={photoInputKey}
                  className="inv__photoInput"
                  type="file"
                  accept="image/*"
                  onChange={(e) => onDraftFileChange(e.target.files?.[0] ?? null)}
                />
                {draftPreviewUrl ? (
                  <img className="inv__photoPreview" src={draftPreviewUrl} alt="" />
                ) : null}
              </div>
            </div>
          </div>

          {shopId ? (
            <div className="inv__priceBlock">
              <label className="inv__label" htmlFor={priceId}>
                Your selling price (₹)
              </label>
              <input
                id={priceId}
                className="inv__input"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 45 or 45.50"
                value={draftPriceRupees}
                onChange={(e) => setDraftPriceRupees(e.target.value)}
                autoComplete="off"
              />
              <p className="inv__priceHint">
                Required for this shop. Minimum ₹0.01. Sent to the API as minor units (paise); there is no catalog default
                price.
              </p>
            </div>
          ) : null}

          {formApiError ? <p className="inv__formErr">{formApiError}</p> : null}

          <button
            type="button"
            className="inv__btn inv__btn--primary"
            disabled={!canAdd}
            onClick={() => void addProduct()}
          >
            {addLoading ? 'Saving…' : shopId ? 'Add to shop catalog' : 'Add to catalog'}
          </button>
        </div>

        <div className="inv__card">
          <h3 className="inv__cardTitle">Import CSV</h3>
          <p className="inv__cardHint">
            Use a header row with <strong>name</strong> and <strong>quantity</strong> (aliases: product, product_name,
            title, qty, stock). With a linked shop, upload the file here — include a <strong>price</strong> column (₹) or a{' '}
            <strong>price_minor</strong> column (paise). If your store uses a default import price, the price column may
            be optional. Optional columns: category, unit, notes. UTF-8 .csv only.
          </p>

          <div className="inv__sample">
            <p className="inv__sampleTitle">Sample file we expect</p>
            <p className="inv__sampleMeta">
              <strong>Size:</strong> usually tens to hundreds of rows (no hard limit in this preview). Row 1 is always
              headers; each following row is one SKU. Quantity must be a whole number (no decimals). Commas inside a name
              are fine if the name is wrapped in double quotes, as in the example.
            </p>
            <pre className="inv__samplePre" tabIndex={0}>
              {EXPECTED_CSV_SAMPLE.trimEnd()}
            </pre>
            <button type="button" className="inv__btn inv__btn--ghost inv__sampleDl" onClick={downloadExpectedCsvSample}>
              Download this sample as .csv
            </button>
          </div>

          <label className="inv__label" htmlFor="inv-csv-file">
            Choose file
          </label>
          <input
            id="inv-csv-file"
            className="inv__input"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) processCsvFile(f);
              e.target.value = '';
            }}
          />

          {csvFileName ? (
            <p className="inv__csvMeta">
              <strong>{csvFileName}</strong>
              {csvText ? ` — ${csvText.split(/\r?\n/).filter((l) => l.trim()).length} non-empty lines` : null}
            </p>
          ) : null}

          {csvError ? <p className="inv__csvErr">{csvError}</p> : null}
          {csvMessage && !csvError ? <p className="inv__csvOk">{csvMessage}</p> : null}

          {csvPreview.length > 0 ? (
            <>
              <div className="inv__csvPreview">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Qty</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.slice(0, 25).map((r, i) => (
                      <tr key={i}>
                        <td>{r.name}</td>
                        <td>{r.ok ? r.quantity : '—'}</td>
                        <td>{r.ok ? 'OK' : r.reason ?? 'Skip'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {csvPreview.length > 25 ? (
                <p className="inv__csvMeta">Showing first 25 rows of {csvPreview.length}.</p>
              ) : null}
              <button
                type="button"
                className="inv__btn inv__btn--primary"
                style={{ marginTop: '0.85rem', width: '100%' }}
                disabled={importableCsvRows.length === 0 || csvImportLoading}
                onClick={() => void importCsvIntoCatalog()}
              >
                {csvImportLoading
                  ? 'Importing…'
                  : shopId
                    ? `Sync ${importableCsvRows.length} product(s) to server`
                    : `Import ${importableCsvRows.length} product(s)`}
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="sdash__panel">
        <h3 className="inv__sectionTitle">Your catalog ({products.length})</h3>
        {products.length === 0 ? (
          <p className="inv__empty">No products yet — add one or import a CSV.</p>
        ) : (
          <div className="inv__productGrid">
            {products.map((p) => (
              <article key={p.id} className="inv__product">
                <div className="inv__productImgWrap">
                  {p.imageUrl ? (
                    <img className="inv__productImg" src={p.imageUrl} alt="" />
                  ) : (
                    <span className="inv__productPlaceholder" aria-hidden="true">
                      📦
                    </span>
                  )}
                </div>
                <div className="inv__productBody">
                  {p.source === 'csv' ? <span className="inv__badge">CSV</span> : null}
                  {p.source === 'server' ? <span className="inv__badge inv__badge--server">Server</span> : null}
                  <h4 className="inv__productName">{p.name}</h4>
                  {typeof p.priceMinor === 'number' ? (
                    <p className="inv__priceLine">{formatInrFromMinor(p.priceMinor)}</p>
                  ) : null}
                  {p.unit ? <p className="inv__unitMeta">Unit: {p.unit}</p> : null}
                  <div className="inv__qtyRow">
                    <button
                      type="button"
                      className="inv__qtyBtn"
                      aria-label="Decrease quantity"
                      onClick={() => void setQuantity(p.id, p.quantity - 1)}
                    >
                      −
                    </button>
                    <span className="inv__qtyVal">{p.quantity}</span>
                    <button
                      type="button"
                      className="inv__qtyBtn"
                      aria-label="Increase quantity"
                      onClick={() => void setQuantity(p.id, p.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                  <div className="inv__productFoot">
                    <button type="button" className="inv__btn inv__btn--danger" onClick={() => void removeProduct(p.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
