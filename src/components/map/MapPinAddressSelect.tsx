import { useEffect, useRef } from 'react';
import './MapPinAddressSelect.css';
import type { ReverseGeocodeParts } from './geocoding';
import { useMapAddressGeocode } from './useMapAddressPreview';

export type MapGeocodeSettledPayload = {
  latitude: number;
  longitude: number;
  parts: ReverseGeocodeParts | null;
  lookupFailed: boolean;
};

export type MapPinAddressSelectProps = {
  latitude: number;
  longitude: number;
  /** Visual theme for text contrast */
  variant?: 'wiz' | 'sshop' | 'dm';
  className?: string;
  /** True while the user is panning/zooming — hint text only. */
  mapInteracting?: boolean;
  /**
   * Fires when a debounced lookup finishes (loading is false).
   * Parent can autofill address fields; gate on mapInteracting via ref if needed.
   */
  onGeocodeSettled?: (payload: MapGeocodeSettledPayload) => void;
};

export function MapPinAddressSelect({
  latitude,
  longitude,
  variant = 'wiz',
  className,
  mapInteracting = false,
  onGeocodeSettled,
}: MapPinAddressSelectProps) {
  const { label, parts, loading, lookupFailed } = useMapAddressGeocode(latitude, longitude);
  const onSettledRef = useRef(onGeocodeSettled);
  onSettledRef.current = onGeocodeSettled;

  useEffect(() => {
    if (loading || !onSettledRef.current) return;
    onSettledRef.current({
      latitude,
      longitude,
      parts: lookupFailed ? null : parts,
      lookupFailed,
    });
  }, [loading, lookupFailed, parts, latitude, longitude]);

  const liveText = loading
    ? 'Looking up this area…'
    : lookupFailed
      ? 'Could not resolve a place name — nudge the map slightly or zoom in.'
      : label;

  const bodyClass =
    !loading && label && !lookupFailed
      ? 'mapPick__address mapPick__address--ok'
      : 'mapPick__address mapPick__address--muted';

  return (
    <div className={`mapPick mapPick--${variant} ${className ?? ''}`}>
      <div className="mapPick__row">
        <p className={bodyClass}>{liveText}</p>
      </div>
      {mapInteracting ? (
        <p className="mapPick__hint mapPick__hint--moving">Release the map — address fields update from the pin.</p>
      ) : !loading && !lookupFailed && label ? (
        <p className="mapPick__hint">Street, city and PIN below fill from this spot — edit if needed.</p>
      ) : null}
    </div>
  );
}
