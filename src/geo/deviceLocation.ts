/**
 * Shared device geolocation for map centres, discover, and delivery pins.
 * Caches successful reads so other screens reuse coordinates without extra prompts.
 */

export const FALLBACK_MAP_CENTER = { latitude: 19.076, longitude: 72.8777 };

const CACHE_KEY = 'dukaanpro_device_geo_v1';
const CACHE_MAX_AGE_MS = 30 * 60 * 1000;

type Stored = { latitude: number; longitude: number; savedAt: number };

export function getCachedDeviceCoordinates(): { latitude: number; longitude: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as Stored;
    if (typeof j.latitude !== 'number' || typeof j.longitude !== 'number') return null;
    if (!Number.isFinite(j.latitude) || !Number.isFinite(j.longitude)) return null;
    if (Date.now() - (j.savedAt ?? 0) > CACHE_MAX_AGE_MS) return null;
    return { latitude: j.latitude, longitude: j.longitude };
  } catch {
    return null;
  }
}

export function rememberDeviceCoordinates(latitude: number, longitude: number): void {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ latitude, longitude, savedAt: Date.now() }),
    );
  } catch {
    /* storage full / private mode */
  }
}

export type RequestDeviceGeoOptions = PositionOptions & { preferHighAccuracy?: boolean };

/**
 * One-shot browser geolocation. On success, updates the shared cache. Returns null if
 * unsupported, denied, or timed out.
 */
export function requestDeviceCoordinates(
  options?: RequestDeviceGeoOptions,
): Promise<{ latitude: number; longitude: number } | null> {
  const { preferHighAccuracy, ...rest } = options ?? {};
  const posOptions: PositionOptions = {
    enableHighAccuracy: preferHighAccuracy ?? false,
    maximumAge: preferHighAccuracy ? 0 : 120_000,
    timeout: preferHighAccuracy ? 18_000 : 15_000,
    ...rest,
  };
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        rememberDeviceCoordinates(p.latitude, p.longitude);
        resolve(p);
      },
      () => resolve(null),
      posOptions,
    );
  });
}

/**
 * Prefer live GPS, then recent cache, then {@link FALLBACK_MAP_CENTER}.
 */
export async function resolveDefaultMapCoordinates(options?: {
  preferHighAccuracy?: boolean;
}): Promise<{ latitude: number; longitude: number }> {
  const live = await requestDeviceCoordinates({
    preferHighAccuracy: options?.preferHighAccuracy,
  });
  if (live) return live;
  const cached = getCachedDeviceCoordinates();
  if (cached) return cached;
  return { ...FALLBACK_MAP_CENTER };
}
