import { useEffect, useState } from 'react';
import { reverseGeocodeStructured, type ReverseGeocodeParts } from './geocoding';

export type MapAddressPreview = {
  label: string | null;
  loading: boolean;
  lookupFailed: boolean;
};

export type MapAddressGeocode = MapAddressPreview & {
  parts: ReverseGeocodeParts | null;
};

/**
 * Debounced reverse geocode for a moving map pin. Respect Nominatim policy — do not set debounce below ~400ms.
 */
export function useMapAddressGeocode(
  latitude: number,
  longitude: number,
  debounceMs = 550,
): MapAddressGeocode {
  const [label, setLabel] = useState<string | null>(null);
  const [parts, setParts] = useState<ReverseGeocodeParts | null>(null);
  const [loading, setLoading] = useState(true);
  const [lookupFailed, setLookupFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setLoading(false);
      setLabel(null);
      setParts(null);
      setLookupFailed(true);
      return () => {
        cancelled = true;
      };
    }
    setLoading(true);
    setLookupFailed(false);
    const t = window.setTimeout(() => {
      void reverseGeocodeStructured(latitude, longitude).then((addr) => {
        if (cancelled) return;
        setLoading(false);
        if (addr) {
          setLabel(addr.label);
          setParts(addr);
          setLookupFailed(false);
        } else {
          setLabel(null);
          setParts(null);
          setLookupFailed(true);
        }
      });
    }, debounceMs);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [latitude, longitude, debounceMs]);

  return { label, parts, loading, lookupFailed };
}

export function useMapAddressPreview(latitude: number, longitude: number, debounceMs = 550): MapAddressPreview {
  const { label, loading, lookupFailed } = useMapAddressGeocode(latitude, longitude, debounceMs);
  return { label, loading, lookupFailed };
}
