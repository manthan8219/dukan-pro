import { Circle, GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import './GoogleMapsEmbedMapPicker.css';

type GoogleMapsEmbedMapPickerProps = {
  latitude: number;
  longitude: number;
  /**
   * Fires while the user pans/zooms (throttled) and when movement ends — same contract as the old Leaflet picker.
   */
  onCenterChange: (lat: number, lng: number) => void;
  /** GPS horizontal accuracy (m). Shown as a faint circle at the map centre. */
  accuracyMeters?: number | null;
  className?: string;
  initialZoom?: number;
  hintText?: string;
  mapAriaLabel?: string;
};

function clampZoom(z: number): number {
  if (!Number.isFinite(z)) return 16;
  return Math.min(20, Math.max(2, Math.round(z)));
}

function mapsApiKey(): string {
  return String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '').trim();
}

type InnerProps = GoogleMapsEmbedMapPickerProps & { apiKey: string };

function GoogleMapsDragPickerInner({
  apiKey,
  latitude,
  longitude,
  onCenterChange,
  accuracyMeters,
  className,
  initialZoom = 16,
  hintText = 'Drag the map — pin stays in the centre · pinch or buttons to zoom',
  mapAriaLabel = 'Map: drag so the pin is on your location',
}: InnerProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const suppressEmitRef = useRef(true);
  const onCenterChangeRef = useRef(onCenterChange);
  onCenterChangeRef.current = onCenterChange;
  const rafRef = useRef<number | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'dukaanpro-google-maps',
    googleMapsApiKey: apiKey,
    version: 'weekly',
  });

  const mapOptions = useMemo(
    (): google.maps.MapOptions => ({
      gestureHandling: 'greedy',
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: true,
      clickableIcons: false,
    }),
    [],
  );

  const emitCenter = useCallback(() => {
    if (suppressEmitRef.current) return;
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    if (!c) return;
    onCenterChangeRef.current(c.lat(), c.lng());
  }, []);

  const scheduleEmit = useCallback(() => {
    if (suppressEmitRef.current) return;
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      emitCenter();
    });
  }, [emitCenter]);

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      suppressEmitRef.current = true;
      map.setCenter({ lat: latitude, lng: longitude });
      map.setZoom(clampZoom(initialZoom));
      google.maps.event.addListenerOnce(map, 'idle', () => {
        suppressEmitRef.current = false;
      });
    },
    [latitude, longitude, initialZoom],
  );

  const onUnmount = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    mapRef.current = null;
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const c = map.getCenter();
    if (!c) return;
    const dLat = Math.abs(c.lat() - latitude);
    const dLng = Math.abs(c.lng() - longitude);
    if (dLat < 1e-7 && dLng < 1e-7) return;

    suppressEmitRef.current = true;
    map.panTo({ lat: latitude, lng: longitude });
    google.maps.event.addListenerOnce(map, 'idle', () => {
      suppressEmitRef.current = false;
    });
  }, [latitude, longitude]);

  const openHref = useMemo(
    () =>
      `https://www.google.com/maps?q=${encodeURIComponent(`${latitude},${longitude}`)}&z=${clampZoom(initialZoom)}`,
    [latitude, longitude, initialZoom],
  );

  const streetViewHref = useMemo(
    () =>
      `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${encodeURIComponent(`${latitude},${longitude}`)}`,
    [latitude, longitude],
  );

  if (loadError) {
    return (
      <div className={`gmem gmem--error ${className ?? ''}`} role="alert">
        <p className="gmem__errTitle">Could not load Google Maps</p>
        <p className="gmem__errText">{String(loadError.message ?? loadError)}</p>
        <p className="gmem__errHint">Check VITE_GOOGLE_MAPS_API_KEY and that Maps JavaScript API is enabled.</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={`gmem gmem--loading ${className ?? ''}`} aria-busy="true">
        <p className="gmem__loadingText">Loading map…</p>
      </div>
    );
  }

  return (
    <div className={`gmem ${className ?? ''}`}>
      <div className="gmem__frameWrap">
        <GoogleMap
          mapContainerClassName="gmem__map"
          options={mapOptions}
          onLoad={onLoad}
          onUnmount={onUnmount}
          onCenterChanged={scheduleEmit}
          onZoomChanged={emitCenter}
          aria-label={mapAriaLabel}
        >
          {accuracyMeters != null && accuracyMeters > 0 && Number.isFinite(accuracyMeters) ? (
            <Circle
              center={{ lat: latitude, lng: longitude }}
              radius={accuracyMeters}
              options={{
                strokeColor: '#0d9488',
                strokeWeight: 2,
                fillColor: '#2dd4bf',
                fillOpacity: 0.14,
              }}
            />
          ) : null}
        </GoogleMap>
        <div className="gmem__hud" aria-hidden="true">
          <div
            className={`gmem__ring ${accuracyMeters != null && accuracyMeters > 0 ? 'gmem__ring--on' : ''}`}
          />
          <div className="gmem__pin">
            <svg className="gmem__pinSvg" viewBox="0 0 48 56" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M24 4C14.6 4 7 11.4 7 20.5c0 12.2 17 29.1 17 29.1s17-16.9 17-29.1C41 11.4 33.4 4 24 4z"
                fill="#0f766e"
                stroke="#042f2e"
                strokeWidth="2"
              />
              <circle cx="24" cy="21" r="6" fill="#ecfdf5" />
            </svg>
          </div>
        </div>
      </div>

      <p className="gmem__openRow">
        <a className="gmem__openLink" href={openHref} target="_blank" rel="noopener noreferrer">
          Open in Google Maps
        </a>
        {' · '}
        <a className="gmem__openLink" href={streetViewHref} target="_blank" rel="noopener noreferrer">
          Street View
        </a>
      </p>

      <p className="gmem__hint">{hintText}</p>
    </div>
  );
}

/**
 * Google Maps with **drag / touch pan** (Maps JavaScript API). Requires `VITE_GOOGLE_MAPS_API_KEY` and the
 * Maps JavaScript API enabled for your key (Google Cloud Console). Free tier / credits apply per Google’s pricing.
 */
export function GoogleMapsEmbedMapPicker(props: GoogleMapsEmbedMapPickerProps) {
  const key = mapsApiKey();
  if (!key) {
    return (
      <div className={`gmem gmem--noKey ${props.className ?? ''}`} role="status">
        <p className="gmem__noKeyTitle">Google Maps API key missing</p>
        <p className="gmem__noKeyText">
          Add <code className="gmem__code">VITE_GOOGLE_MAPS_API_KEY</code> to <code className="gmem__code">.env.local</code>{' '}
          and enable <strong>Maps JavaScript API</strong> for that key. Drag and touch pan need the JS API (embed
          iframes cannot report position to this page).
        </p>
      </div>
    );
  }
  return <GoogleMapsDragPickerInner apiKey={key} {...props} />;
}
