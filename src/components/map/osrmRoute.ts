type OsrmRouteResponse = {
  code: string;
  routes?: { geometry: { type: 'LineString'; coordinates: [number, number][] } }[];
};

/** Public OSRM demo server — fine for low-traffic prototypes; self-host for production scale. */
export async function fetchOsrmRoute(
  from: { lng: number; lat: number },
  to: { lng: number; lat: number },
): Promise<[number, number][]> {
  const path = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Routing failed (${res.status})`);
  const data = (await res.json()) as OsrmRouteResponse;
  if (data.code !== 'Ok' || !data.routes?.[0]?.geometry?.coordinates) {
    throw new Error('No route found');
  }
  return data.routes[0].geometry.coordinates;
}
