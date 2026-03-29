import maplibregl, { type MapLayerMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ensureMapLibreWorker } from './ensureMapLibreWorker';
import './MapLibreExplorerMap.css';
import { searchPlaces } from './geocoding';
import { MAP_STYLE_DARK_VECTOR } from './mapStyle';
import { fetchOsrmRoute } from './osrmRoute';

/** Default view: Pune, India */
export const DEFAULT_MAP_CENTER = { lat: 18.5204, lng: 73.8567 };

export type MapLibreExplorerMapProps = {
  className?: string;
  /** Initial zoom (default 12). */
  initialZoom?: number;
};

let markerId = 0;

function newFeature(lng: number, lat: number) {
  markerId += 1;
  return {
    type: 'Feature' as const,
    id: markerId,
    properties: { id: markerId },
    geometry: { type: 'Point' as const, coordinates: [lng, lat] as [number, number] },
  };
}

/**
 * Standalone interactive map: dark vector basemap, click-to-add clustered markers, geolocation,
 * Nominatim / LocationIQ search, and optional OSRM route between the first two markers.
 */
export function MapLibreExplorerMap({ className, initialZoom = 12 }: MapLibreExplorerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<{ label: string; lat: number; lng: number }[]>([]);
  const [routeBusy, setRouteBusy] = useState(false);
  const featuresRef = useRef<ReturnType<typeof newFeature>[]>([]);

  const closePopup = useCallback(() => {
    popupRef.current?.remove();
    popupRef.current = null;
  }, []);

  const refreshMarkers = useCallback(() => {
    const map = mapRef.current;
    const src = map?.getSource('markers') as maplibregl.GeoJSONSource | undefined;
    if (src) {
      src.setData({ type: 'FeatureCollection', features: [...featuresRef.current] });
    }
  }, []);

  const clearRoute = useCallback(() => {
    const map = mapRef.current;
    const src = map?.getSource('route') as maplibregl.GeoJSONSource | undefined;
    if (src) {
      src.setData({ type: 'FeatureCollection', features: [] });
    }
  }, []);

  useEffect(() => {
    ensureMapLibreWorker();
    const el = containerRef.current;
    if (!el) return;

    const map = new maplibregl.Map({
      container: el,
      style: MAP_STYLE_DARK_VECTOR,
      center: [DEFAULT_MAP_CENTER.lng, DEFAULT_MAP_CENTER.lat],
      zoom: initialZoom,
      maxZoom: 20,
      minZoom: 2,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    map.on('error', (e) => {
      setError(e.error?.message ?? String(e.error ?? 'Map error'));
    });

    map.on('load', () => {
      map.addSource('route', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#fbbf24', 'line-width': 4, 'line-opacity': 0.88 },
      });

      map.addSource('markers', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 52,
      });

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'markers',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#0f766e',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#042f2e',
          'circle-radius': ['step', ['get', 'point_count'], 16, 8, 20, 32, 26],
        },
      });

      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'markers',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 12,
        },
        paint: { 'text-color': '#ecfdf5' },
      });

      map.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'markers',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#2dd4bf',
          'circle-radius': 9,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#0f172a',
        },
      });

      map.addSource('user-loc', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'user-loc-dot',
        type: 'circle',
        source: 'user-loc',
        paint: {
          'circle-radius': 11,
          'circle-color': '#38bdf8',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#0f172a',
        },
      });

      map.on('click', 'clusters', (e: MapLayerMouseEvent) => {
        const f = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0];
        const id = f?.properties?.cluster_id;
        const src = map.getSource('markers') as maplibregl.GeoJSONSource;
        if (id == null) return;
        void Promise.resolve(src.getClusterExpansionZoom(id))
          .then((zoom) => {
            if (zoom == null) return;
            const g = f.geometry as { type: string; coordinates: [number, number] };
            if (g.type !== 'Point') return;
            map.easeTo({ center: g.coordinates, zoom });
          })
          .catch(() => {
            /* ignore cluster zoom errors */
          });
      });

      map.on('click', 'unclustered-point', (e: MapLayerMouseEvent) => {
        const f = e.features?.[0];
        if (!f || f.geometry.type !== 'Point') return;
        const [lng, lat] = f.geometry.coordinates as [number, number];
        closePopup();
        const popup = new maplibregl.Popup({ closeButton: true, maxWidth: '240px' }).setLngLat([lng, lat]).setHTML(
          `<div class="mlex__popup"><strong>Marker</strong>Lat ${lat.toFixed(6)}<br/>Lng ${lng.toFixed(6)}</div>`,
        );
        popup.addTo(map);
        popupRef.current = popup;
      });

      map.on('click', (e: MapLayerMouseEvent) => {
        const layers = ['clusters', 'unclustered-point', 'user-loc-dot', 'route-line'];
        const hit = map.queryRenderedFeatures(e.point, { layers });
        if (hit.length) return;
        const { lng, lat } = e.lngLat;
        featuresRef.current.push(newFeature(lng, lat));
        refreshMarkers();
        clearRoute();
      });
    });

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(el);

    return () => {
      ro.disconnect();
      closePopup();
      map.remove();
      mapRef.current = null;
    };
  }, [clearRoute, closePopup, initialZoom, refreshMarkers]);

  const runSearch = useCallback(
    async (q: string) => {
      const query = q.trim();
      if (!query) {
        setSuggestions([]);
        return;
      }
      try {
        const hits = await searchPlaces(query);
        setSuggestions(hits);
        setError(null);
      } catch (err) {
        setSuggestions([]);
        setError(err instanceof Error ? err.message : 'Search failed');
      }
    },
    [],
  );

  const onSearchChange = (v: string) => {
    setSearch(v);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      void runSearch(v);
    }, 400);
  };

  const flyToHit = (lat: number, lng: number) => {
    const map = mapRef.current;
    if (!map) return;
    setSuggestions([]);
    setSearch('');
    map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 14), essential: true });
  };

  const onLocate = () => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const map = mapRef.current;
        const src = map?.getSource('user-loc') as maplibregl.GeoJSONSource | undefined;
        if (src) {
          src.setData({
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: {},
                geometry: { type: 'Point', coordinates: [lng, lat] },
              },
            ],
          });
        }
        map?.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 15), essential: true });
        setError(null);
      },
      () => setError('Could not read your location (permission or hardware).'),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  };

  const onClearMarkers = () => {
    featuresRef.current = [];
    refreshMarkers();
    clearRoute();
    closePopup();
  };

  const onDrawRoute = async () => {
    const pts = featuresRef.current;
    if (pts.length < 2) {
      setError('Add at least two markers (map clicks) to draw a route.');
      return;
    }
    const a = pts[0]!.geometry.coordinates;
    const b = pts[1]!.geometry.coordinates;
    setRouteBusy(true);
    setError(null);
    try {
      const coords = await fetchOsrmRoute({ lng: a[0], lat: a[1] }, { lng: b[0], lat: b[1] });
      const map = mapRef.current;
      const src = map?.getSource('route') as maplibregl.GeoJSONSource | undefined;
      if (src) {
        src.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: coords },
            },
          ],
        });
      }
      const bounds = new maplibregl.LngLatBounds(coords[0] as [number, number], coords[0] as [number, number]);
      for (let i = 1; i < coords.length; i++) bounds.extend(coords[i] as [number, number]);
      map?.fitBounds(bounds, { padding: 48, maxZoom: 16, duration: 600 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Route failed');
    } finally {
      setRouteBusy(false);
    }
  };

  return (
    <div className={`mlex ${className ?? ''}`}>
      <div className="mlex__toolbar">
        <div className="mlex__searchWrap">
          <div className="mlex__search">
            <input
              className="mlex__input"
              placeholder="Search place (Nominatim / LocationIQ)…"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Search map"
            />
          </div>
          {suggestions.length > 0 ? (
            <div className="mlex__suggest" role="listbox">
              {suggestions.map((s) => (
                <button
                  key={`${s.lat},${s.lng},${s.label.slice(0, 40)}`}
                  type="button"
                  role="option"
                  onClick={() => flyToHit(s.lat, s.lng)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button type="button" className="mlex__btn" onClick={onLocate}>
          My location
        </button>
        <button type="button" className="mlex__btn mlex__btn--ghost" onClick={onClearMarkers}>
          Clear markers
        </button>
        <button type="button" className="mlex__btn mlex__btn--ghost" onClick={() => void onDrawRoute()} disabled={routeBusy}>
          {routeBusy ? 'Routing…' : 'Route (1st→2nd)'}
        </button>
        <p className="mlex__hint">
          Click empty map to drop markers (clustered when zoomed out). OSRM route uses the first two markers. Attribution: © OpenStreetMap / CARTO.
        </p>
      </div>
      {error ? <p className="mlex__err">{error}</p> : null}
      <div className="mlex__mapWrap">
        <div ref={containerRef} className="mlex__map" role="application" aria-label="Interactive map explorer" />
      </div>
    </div>
  );
}
