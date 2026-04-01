export type GeocodeHit = { label: string; lat: number; lng: number };

const NOMINATIM_UA = 'DukaanPro/1.0 (https://github.com/dukaanpro; contact: app support)';

async function searchNominatim(query: string): Promise<GeocodeHit[]> {
  const q = query.trim();
  if (!q) return [];
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '8');
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'Accept-Language': 'en', 'User-Agent': NOMINATIM_UA },
  });
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const data = (await res.json()) as { display_name?: string; lat?: string; lon?: string }[];
  return data
    .map((row) => {
      const lat = Number(row.lat);
      const lng = Number(row.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { label: row.display_name ?? `${lat}, ${lng}`, lat, lng };
    })
    .filter(Boolean) as GeocodeHit[];
}

async function searchLocationIq(query: string, apiKey: string): Promise<GeocodeHit[]> {
  const q = query.trim();
  if (!q) return [];
  const url = new URL('https://us1.locationiq.com/v1/search');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '8');
  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`LocationIQ failed (${res.status})`);
  const data = (await res.json()) as { display_name?: string; lat?: string | number; lon?: string | number }[];
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => {
      const lat = typeof row.lat === 'number' ? row.lat : Number(row.lat);
      const lng = typeof row.lon === 'number' ? row.lon : Number(row.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { label: row.display_name ?? `${lat}, ${lng}`, lat, lng };
    })
    .filter(Boolean) as GeocodeHit[];
}

/**
 * Forward geocode using OpenStreetMap Nominatim (no key), or LocationIQ when `VITE_LOCATIONIQ_API_KEY` is set.
 * Respect Nominatim usage policy: debounce in UI, no bulk / automated scraping.
 */
export async function searchPlaces(query: string): Promise<GeocodeHit[]> {
  const key = String(import.meta.env.VITE_LOCATIONIQ_API_KEY ?? '').trim();
  if (key) return searchLocationIq(query, key);
  return searchNominatim(query);
}

export type ReverseGeocodeParts = {
  label: string;
  line1: string;
  line2: string;
  city: string;
  pin: string;
};

function pickAddr(addr: Record<string, string | undefined>, keys: string[]): string {
  for (const k of keys) {
    const v = addr[k];
    if (v && String(v).trim()) return String(v).trim();
  }
  return '';
}

/** Build street / area lines from Nominatim / LocationIQ-style address object. */
export function structuredPartsFromAddressJson(
  displayName: string,
  rawAddr: Record<string, string | undefined> | null | undefined,
): ReverseGeocodeParts {
  const addr = rawAddr ?? {};
  const house = pickAddr(addr, ['house_number', 'housename']);
  const road = pickAddr(addr, ['road', 'pedestrian', 'path', 'footway', 'residential', 'street']);
  let line1 = [house, road].filter(Boolean).join(' ').trim();
  if (!line1) {
    line1 = pickAddr(addr, ['neighbourhood', 'suburb', 'quarter', 'hamlet', 'village']);
  }
  const line2 = pickAddr(addr, ['suburb', 'neighbourhood', 'city_district', 'district']);
  const city = pickAddr(addr, [
    'city',
    'town',
    'municipality',
    'county',
    'state_district',
    'region',
    'state',
  ]);
  const rawPost = (addr.postcode ?? '').trim();
  const digits = rawPost.replace(/\D/g, '');
  const pin = digits.length >= 4 ? digits.slice(0, 6) : rawPost.slice(0, 10);
  return { label: displayName.trim(), line1, line2, city, pin };
}

async function reverseNominatimStructured(lat: number, lng: number): Promise<ReverseGeocodeParts | null> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'Accept-Language': 'en', 'User-Agent': NOMINATIM_UA },
  });
  if (!res.ok) return null;
  const j = (await res.json()) as {
    display_name?: string;
    error?: string;
    address?: Record<string, string | undefined>;
  };
  if (j.error) return null;
  const name = j.display_name?.trim();
  if (!name) return null;
  return structuredPartsFromAddressJson(name, j.address);
}

async function reverseLocationIqStructured(lat: number, lng: number, apiKey: string): Promise<ReverseGeocodeParts | null> {
  const url = new URL('https://us1.locationiq.com/v1/reverse.php');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('format', 'json');
  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!res.ok) return null;
  const j = (await res.json()) as { display_name?: string; address?: Record<string, string | undefined> };
  const name = j.display_name?.trim();
  if (!name) return null;
  return structuredPartsFromAddressJson(name, j.address);
}

/** Reverse geocode with structured fields for forms (debounce calls in UI). */
export async function reverseGeocodeStructured(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodeParts | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const key = String(import.meta.env.VITE_LOCATIONIQ_API_KEY ?? '').trim();
  if (key) return reverseLocationIqStructured(latitude, longitude, key);
  return reverseNominatimStructured(latitude, longitude);
}

/** Human-readable place name for map centre (debounce calls in UI). */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  const s = await reverseGeocodeStructured(latitude, longitude);
  return s?.label ?? null;
}
