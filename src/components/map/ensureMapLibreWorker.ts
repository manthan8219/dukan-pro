import maplibregl from 'maplibre-gl';
import maplibreglWorkerUrl from 'maplibre-gl/dist/maplibre-gl-csp-worker.js?url';

let done = false;

/** Required once per app when bundling MapLibre with Vite. */
export function ensureMapLibreWorker(): void {
  if (done) return;
  maplibregl.setWorkerUrl(maplibreglWorkerUrl);
  done = true;
}
