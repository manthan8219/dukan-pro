import { useEffect, useState } from 'react';
import { reverseGeocode } from './geocoding';

export type MapAddressPreview = {
  label: string | null;
  loading: boolean;
  lookupFailed: boolean;
};

/**
 * Debounced reverse geocode for a moving map pin. Respect Nominatim policy — do not set debounce below ~400ms.
 */
export function useMapAddressPreview(latitude: number, longitude: number, debounceMs = 550): MapAddressPreview {
  const [label, setLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lookupFailed, setLookupFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLookupFailed(false);
    const t = window.setTimeout(() => {
      void reverseGeocode(latitude, longitude).then((addr) => {
        if (cancelled) return;
        setLoading(false);
        if (addr) {
          setLabel(addr);
          setLookupFailed(false);
        } else {
          setLabel(null);
          setLookupFailed(true);
        }
      });
    }, debounceMs);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [latitude, longitude, debounceMs]);

  return { label, loading, lookupFailed };
}
