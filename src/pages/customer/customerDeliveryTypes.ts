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
  /** WGS84; null until set from map or API */
  latitude: number | null;
  longitude: number | null;
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

function normalizeCoord(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return v;
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
    latitude: normalizeCoord(p.latitude),
    longitude: normalizeCoord(p.longitude),
  };
}

function defaultLabelForTag(tag: AddressTag): string {
  if (tag === 'home') return 'Home';
  if (tag === 'office') return 'Office';
  return 'Other';
}

function normalizeSaved(raw: unknown): SavedAddress | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id : '';
  if (!id) return null;
  const tag = o.tag === 'home' || o.tag === 'office' || o.tag === 'other' ? o.tag : 'other';
  const label = typeof o.label === 'string' && o.label.trim() ? o.label.trim() : defaultLabelForTag(tag);
  const body = normalizeDelivery(o as Partial<DeliveryAddress>);
  return { id, tag, label, ...body };
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
    const id = `mig-${Date.now()}`;
    const saved: SavedAddress = {
      id,
      tag: 'home',
      label: 'Home',
      ...body,
      latitude: body.latitude,
      longitude: body.longitude,
    };
    return { addresses: [saved], selectedId: id };
  } catch {
    return null;
  }
}

/**
 * Reads the old localStorage address book (if any) for one-time migration to the API.
 * Does not create demo data.
 */
export function readLegacyLocalAddressBook(): AddressBook | null {
  try {
    const raw = localStorage.getItem(BOOK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AddressBook>;
      const book = normalizeBook(parsed);
      if (book.addresses.length > 0) {
        return book;
      }
    }
    return migrateLegacyBook();
  } catch {
    return migrateLegacyBook();
  }
}

export function clearLegacyLocalAddressBook(): void {
  try {
    localStorage.removeItem(BOOK_KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
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

export function bookFromApiRows(
  rows: Array<{
    id: string;
    fullName: string;
    phone: string;
    line1: string;
    line2: string;
    landmark: string;
    city: string;
    pin: string;
    tag: AddressTag;
    label: string;
    isDefault: boolean;
    latitude?: number | null;
    longitude?: number | null;
  }>,
): AddressBook {
  const addresses: SavedAddress[] = rows.map((r) => ({
    id: r.id,
    tag: r.tag,
    label: r.label,
    fullName: r.fullName,
    phone: r.phone,
    line1: r.line1,
    line2: r.line2,
    landmark: r.landmark,
    city: r.city,
    pin: r.pin,
    latitude:
      r.latitude != null && Number.isFinite(r.latitude) ? r.latitude : null,
    longitude:
      r.longitude != null && Number.isFinite(r.longitude) ? r.longitude : null,
  }));
  const selectedId =
    rows.find((r) => r.isDefault)?.id ?? addresses[0]?.id ?? null;
  return { addresses, selectedId };
}
