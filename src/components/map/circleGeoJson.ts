type PolygonGj = { type: 'Polygon'; coordinates: [number, number][][] };
type FeaturePolygonGj = { type: 'Feature'; properties: Record<string, unknown>; geometry: PolygonGj };

/** Approximate circle as a GeoJSON polygon (WGS84, small-area accuracy). */
export function metersToCirclePolygon(lng: number, lat: number, radiusMeters: number, steps = 64): PolygonGj {
  const coordinates: [number, number][] = [];
  const earthRadius = 6378137;
  const latRad = (lat * Math.PI) / 180;
  const cosLat = Math.max(Math.cos(latRad), 1e-6);
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * 2 * Math.PI;
    const dx = radiusMeters * Math.sin(theta);
    const dy = radiusMeters * Math.cos(theta);
    const dLng = (dx / (earthRadius * cosLat)) * (180 / Math.PI);
    const dLat = (dy / earthRadius) * (180 / Math.PI);
    coordinates.push([lng + dLng, lat + dLat]);
  }
  return { type: 'Polygon', coordinates: [coordinates] };
}

export function accuracyCircleFeature(lng: number, lat: number, radiusMeters: number): FeaturePolygonGj {
  return {
    type: 'Feature',
    properties: {},
    geometry: metersToCirclePolygon(lng, lat, radiusMeters),
  };
}
