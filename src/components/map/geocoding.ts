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

async function reverseNominatim(lat: number, lng: number): Promise<string | null> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('format', 'json');
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'Accept-Language': 'en', 'User-Agent': NOMINATIM_UA },
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { display_name?: string; error?: string };
  if (j.error) return null;
  const name = j.display_name?.trim();
  return name || null;
}

async function reverseLocationIq(lat: number, lng: number, apiKey: string): Promise<string | null> {
  const url = new URL('https://us1.locationiq.com/v1/reverse.php');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('format', 'json');
  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!res.ok) return null;
  const j = (await res.json()) as { display_name?: string };
  return j.display_name?.trim() || null;
}

/** Human-readable place name for map centre (debounce calls in UI). */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const key = String(import.meta.env.VITE_LOCATIONIQ_API_KEY ?? '').trim();
  if (key) return reverseLocationIq(latitude, longitude, key);
  return reverseNominatim(latitude, longitude);
}
