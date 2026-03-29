const BOOK_KEY = 'dukaanpro_customer_address_book_v1';
const LEGACY_KEY = 'dukaanpro_customer_delivery_v1';

export type DeliveryAddress = {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  pin: string;
};

export type AddressTag = 'home' | 'office' | 'other';

export type SavedAddress = DeliveryAddress & {
  id: string;
  tag: AddressTag;
  /** Shown in the app: "Home", "Office", or a custom name when tag is other */
  label: string;
};

export type AddressBook = {
  addresses: SavedAddress[];
  selectedId: string | null;
};

const demoFields: DeliveryAddress = {
  fullName: 'Rahul Nair',
  phone: '9876543210',
  line1: '204, 12th Main, Indiranagar',
  line2: 'Stage 2',
  landmark: 'Near metro',
  city: 'Bengaluru',
  pin: '560038',
};

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `addr-${Date.now()}`;
}

function normalizeDelivery(p: Partial<DeliveryAddress>): DeliveryAddress {
  return {
    fullName: typeof p.fullName === 'string' ? p.fullName : '',
    phone: typeof p.phone === 'string' ? p.phone : '',
    line1: typeof p.line1 === 'string' ? p.line1 : '',
    line2: typeof p.line2 === 'string' ? p.line2 : '',
    landmark: typeof p.landmark === 'string' ? p.landmark : '',
    city: typeof p.city === 'string' ? p.city : '',
    pin: typeof p.pin === 'string' ? p.pin : '',
  };
}

function normalizeSaved(raw: unknown): SavedAddress | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id : newId();
  const tag = o.tag === 'home' || o.tag === 'office' || o.tag === 'other' ? o.tag : 'other';
  const label = typeof o.label === 'string' && o.label.trim() ? o.label.trim() : defaultLabelForTag(tag);
  const body = normalizeDelivery(o as Partial<DeliveryAddress>);
  return { id, tag, label, ...body };
}

function defaultLabelForTag(tag: AddressTag): string {
  if (tag === 'home') return 'Home';
  if (tag === 'office') return 'Office';
  return 'Other';
}

function normalizeBook(raw: Partial<AddressBook>): AddressBook {
  const addresses = Array.isArray(raw.addresses)
    ? (raw.addresses.map(normalizeSaved).filter(Boolean) as SavedAddress[])
    : [];
  let selectedId = typeof raw.selectedId === 'string' ? raw.selectedId : null;
  if (selectedId && !addresses.some((a) => a.id === selectedId)) {
    selectedId = addresses[0]?.id ?? null;
  }
  if (!selectedId && addresses[0]) {
    selectedId = addresses[0].id;
  }
  return { addresses, selectedId };
}

function migrateLegacyBook(): AddressBook | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<DeliveryAddress>;
    const body = normalizeDelivery(p);
    const id = newId();
    const saved: SavedAddress = {
      id,
      tag: 'home',
      label: 'Home',
      ...body,
    };
    return { addresses: [saved], selectedId: id };
  } catch {
    return null;
  }
}

function defaultDemoBook(): AddressBook {
  const id = newId();
  return {
    addresses: [{ id, tag: 'home', label: 'Home', ...demoFields }],
    selectedId: id,
  };
}

export function loadAddressBook(): AddressBook {
  try {
    const raw = localStorage.getItem(BOOK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AddressBook>;
      const book = normalizeBook(parsed);
      if (book.addresses.length > 0) {
        return book;
      }
    }
    const migrated = migrateLegacyBook();
    if (migrated) {
      saveAddressBook(migrated);
      return migrated;
    }
  } catch {
    /* fall through */
  }
  const fresh = defaultDemoBook();
  localStorage.setItem(BOOK_KEY, JSON.stringify(fresh));
  return fresh;
}

export function saveAddressBook(book: AddressBook): void {
  const normalized = normalizeBook(book);
  localStorage.setItem(BOOK_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent('dukaanpro-delivery-updated'));
}

export function getSelectedSavedAddress(book?: AddressBook): SavedAddress | null {
  const b = book ?? loadAddressBook();
  if (b.addresses.length === 0) return null;
  const hit = b.selectedId ? b.addresses.find((a) => a.id === b.selectedId) : undefined;
  return hit ?? b.addresses[0] ?? null;
}

export function setSelectedAddressId(id: string): void {
  const book = loadAddressBook();
  if (!book.addresses.some((a) => a.id === id)) return;
  saveAddressBook({ ...book, selectedId: id });
}

/** Fields only — for forms that don’t need id/tag/label */
export function loadDeliveryAddress(): DeliveryAddress {
  const s = getSelectedSavedAddress();
  if (!s) {
    return { fullName: '', phone: '', line1: '', line2: '', landmark: '', city: '', pin: '' };
  }
  const { id: _i, tag: _t, label: _l, ...rest } = s;
  return rest;
}

/**
 * Persists the current delivery fields onto the **selected** saved address,
 * or creates a new "Home" entry if none exist.
 */
export function saveDeliveryAddress(a: DeliveryAddress): void {
  const book = loadAddressBook();
  const sel = getSelectedSavedAddress(book);
  const body = normalizeDelivery(a);
  if (sel) {
    const idx = book.addresses.findIndex((x) => x.id === sel.id);
    if (idx >= 0) {
      book.addresses[idx] = { ...book.addresses[idx], ...body };
      saveAddressBook(book);
      return;
    }
  }
  const id = newId();
  book.addresses.push({ id, tag: 'home', label: 'Home', ...body });
  book.selectedId = id;
  saveAddressBook(book);
}

export function deliverySummaryLine(a: DeliveryAddress): string {
  const parts = [a.line1, a.landmark, a.city, a.pin].filter(Boolean);
  if (parts.length === 0) return 'Add delivery address';
  return parts.join(' · ');
}

export function deliverySummaryLineFromSaved(s: SavedAddress): string {
  const parts = [s.line1, s.city, s.pin].filter(Boolean);
  const tail = parts.length ? parts.join(' · ') : 'Tap to add details';
  return `${s.label} · ${tail}`;
}

export function addSavedAddress(entry: Omit<SavedAddress, 'id'> & { id?: string }): SavedAddress {
  const book = loadAddressBook();
  const id = entry.id ?? newId();
  const tag = entry.tag;
  const label =
    tag === 'home'
      ? 'Home'
      : tag === 'office'
        ? 'Office'
        : (typeof entry.label === 'string' ? entry.label.trim() : '') || 'Other';
  const saved: SavedAddress = {
    id,
    tag,
    label,
    ...normalizeDelivery(entry),
  };
  const next = { ...book, addresses: [...book.addresses, saved], selectedId: id };
  saveAddressBook(next);
  return saved;
}

export function updateSavedAddress(id: string, patch: Partial<Omit<SavedAddress, 'id'>>): void {
  const book = loadAddressBook();
  const idx = book.addresses.findIndex((a) => a.id === id);
  if (idx < 0) return;
  const cur = book.addresses[idx];
  const tag = patch.tag ?? cur.tag;
  const body = normalizeDelivery({ ...cur, ...patch });
  let label = cur.label;
  if (tag === 'home') label = 'Home';
  else if (tag === 'office') label = 'Office';
  else if (patch.label !== undefined) label = patch.label.trim() || 'Other';
  const merged: SavedAddress = { id: cur.id, tag, label, ...body };
  const addresses = [...book.addresses];
  addresses[idx] = merged;
  saveAddressBook({ ...book, addresses });
}

export function removeSavedAddress(id: string): void {
  const book = loadAddressBook();
  const addresses = book.addresses.filter((a) => a.id !== id);
  let selectedId = book.selectedId;
  if (selectedId === id) {
    selectedId = addresses[0]?.id ?? null;
  }
  saveAddressBook({ addresses, selectedId });
}
