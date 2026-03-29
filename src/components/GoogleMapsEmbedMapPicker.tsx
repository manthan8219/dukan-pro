/**
 * Re-export: location picker now uses MapLibre GL + OSM (CARTO vector tiles). No Google API key.
 * Prefer importing {@link MapLibreLocationPicker} from `./map/MapLibreLocationPicker`.
 */
export { MapLibreLocationPicker } from './map/MapLibreLocationPicker';
export { MapLibreLocationPicker as GoogleMapsEmbedMapPicker } from './map/MapLibreLocationPicker';
