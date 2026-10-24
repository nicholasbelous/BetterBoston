// Shared lat/lng query parsing for API routes.
export function parseLatLng(params: URLSearchParams): { lat: number; lng: number } | null {
  const parse = (value: string | null, limit: number) => {
    if (value === null || value.trim() === "" || value.length > 20) return null;
    const n = Number(value);
    return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
  };
  const lat = parse(params.get("lat"), 90);
  const lng = parse(params.get("lng"), 180);
  return lat === null || lng === null ? null : { lat, lng };
}
