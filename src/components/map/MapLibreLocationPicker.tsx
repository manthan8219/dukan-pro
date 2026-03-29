import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { accuracyCircleFeature } from './circleGeoJson';
import { ensureMapLibreWorker } from './ensureMapLibreWorker';
import './MapLibreLocationPicker.css';
import { MAP_STYLE_DARK_VECTOR } from './mapStyle';

export type MapLibreLocationPickerProps = {
  latitude: number;
  longitude: number;
  onCenterChange: (lat: number, lng: number) => void;
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

function emptyAccuracyFc() {
  return { type: 'FeatureCollection' as const, features: [] as ReturnType<typeof accuracyCircleFeature>[] };
}

/**
 * Draggable MapLibre map with a fixed centre pin — same contract as the legacy Google picker.
 * Vector dark basemap (CARTO / OSM). No API keys required.
 */
export function MapLibreLocationPicker({
  latitude,
  longitude,
  onCenterChange,
  accuracyMeters,
  className,
  initialZoom = 16,
  hintText = 'Drag the map — pin stays in the centre · pinch or buttons to zoom',
  mapAriaLabel = 'Map: drag so the pin is on your location',
}: MapLibreLocationPickerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const suppressEmitRef = useRef(true);
  const onCenterChangeRef = useRef(onCenterChange);
  onCenterChangeRef.current = onCenterChange;
  const rafRef = useRef<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const emitCenter = useCallback(() => {
    if (suppressEmitRef.current) return;
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    onCenterChangeRef.current(c.lat, c.lng);
  }, []);

  const scheduleEmit = useCallback(() => {
    if (suppressEmitRef.current) return;
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      emitCenter();
    });
  }, [emitCenter]);

  const updateAccuracyLayer = useCallback(
    (map: maplibregl.Map, lat: number, lng: number, acc: number | null | undefined) => {
      const src = map.getSource('accuracy') as maplibregl.GeoJSONSource | undefined;
      if (!src) return;
      if (acc != null && acc > 0 && Number.isFinite(acc)) {
        src.setData({
          type: 'FeatureCollection',
          features: [accuracyCircleFeature(lng, lat, acc)],
        });
      } else {
        src.setData(emptyAccuracyFc());
      }
    },
    [],
  );

  useEffect(() => {
    ensureMapLibreWorker();
    const el = wrapRef.current;
    if (!el) return;

    let cancelled = false;
    setLoadError(null);
    suppressEmitRef.current = true;

    const map = new maplibregl.Map({
      container: el,
      style: MAP_STYLE_DARK_VECTOR,
      center: [longitude, latitude],
      zoom: clampZoom(initialZoom),
      attributionControl: { compact: true },
      maxZoom: 20,
      minZoom: 2,
    });
    mapRef.current = map;

    map.on('error', (e) => {
      const msg = e.error?.message ?? String(e.error ?? 'Map error');
      if (!cancelled) setLoadError(msg);
    });

    map.on('load', () => {
      if (cancelled) return;
      try {
        map.addSource('accuracy', {
          type: 'geojson',
          data: emptyAccuracyFc(),
        });
        map.addLayer({
          id: 'accuracy-fill',
          type: 'fill',
          source: 'accuracy',
          paint: { 'fill-color': '#2dd4bf', 'fill-opacity': 0.14 },
        });
        map.addLayer({
          id: 'accuracy-stroke',
          type: 'line',
          source: 'accuracy',
          paint: { 'line-color': '#0d9488', 'line-width': 2 },
        });
        updateAccuracyLayer(map, latitude, longitude, accuracyMeters);
      } catch {
        /* duplicate layer if hot reload */
      }
      map.once('idle', () => {
        if (!cancelled) {
          suppressEmitRef.current = false;
          setMapReady(true);
        }
      });
    });

    map.on('move', scheduleEmit);
    map.on('zoomend', emitCenter);

    const ro = new ResizeObserver(() => {
      map.resize();
    });
    ro.observe(el);

    return () => {
      cancelled = true;
      ro.disconnect();
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once; props synced below
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const c = map.getCenter();
    const dLat = Math.abs(c.lat - latitude);
    const dLng = Math.abs(c.lng - longitude);
    if (dLat < 1e-7 && dLng < 1e-7) return;
    suppressEmitRef.current = true;
    map.jumpTo({ center: [longitude, latitude] });
    map.once('idle', () => {
      suppressEmitRef.current = false;
    });
  }, [latitude, longitude, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    updateAccuracyLayer(map, latitude, longitude, accuracyMeters);
  }, [accuracyMeters, latitude, longitude, mapReady, updateAccuracyLayer]);

  const openOsmHref = useMemo(
    () =>
      `https://www.openstreetmap.org/?mlat=${encodeURIComponent(String(latitude))}&mlon=${encodeURIComponent(String(longitude))}&zoom=${clampZoom(initialZoom)}`,
    [latitude, longitude, initialZoom],
  );

  if (loadError) {
    return (
      <div className={`gmem gmem--error ${className ?? ''}`} role="alert">
        <p className="gmem__errTitle">Could not load map</p>
        <p className="gmem__errText">{loadError}</p>
        <p className="gmem__errHint">Check your network and ad blockers. Basemap is loaded from CARTO CDN (OpenStreetMap data).</p>
      </div>
    );
  }

  return (
    <div className={`gmem ${className ?? ''}`}>
      <div className="gmem__frameWrap">
        <div ref={wrapRef} className="gmem__map" role="application" aria-label={mapAriaLabel} />
        {!mapReady ? (
          <div className="gmem__hud" style={{ background: 'rgba(15,23,42,0.65)' }} aria-busy="true">
            <p className="gmem__loadingText" style={{ margin: 0 }}>
              Loading map…
            </p>
          </div>
        ) : null}
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
        <a className="gmem__openLink" href={openOsmHref} target="_blank" rel="noopener noreferrer">
          Open in OpenStreetMap
        </a>
      </p>

      <p className="gmem__hint">{hintText}</p>
    </div>
  );
}
