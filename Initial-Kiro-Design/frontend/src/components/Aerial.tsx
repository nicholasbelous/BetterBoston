// Placeholder for the aerial photo. Swap the inner markup for a real map/image tile
// (e.g. MassGIS imagery via Leaflet or MapLibre) centered on the block's lat/lon.

interface Props {
  height: number;
  showLegend?: boolean;
  scanTop?: number; // loading animation line, in px
}

export function Aerial({ height, showLegend = false, scanTop }: Props) {
  return (
    <div className="aerial" role="img" aria-label="Aerial photo of your home and block" style={{ height }}>
      <div className="road-h" />
      <div className="road-v" />
      <div className="block" />
      <div className="roof" />
      <div className="pin">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="#0B5563" stroke="#FFFFFF" strokeWidth="1.6" aria-hidden="true">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" fill="#FFFFFF" />
        </svg>
      </div>
      <div className="label" style={{ right: 16, top: 16 }}>Aerial photo</div>
      {showLegend && (
        <div className="legend">
          <span>▢ Your home</span>
          <span>┄ Your block</span>
        </div>
      )}
      {scanTop !== undefined && <div className="scan" style={{ top: scanTop }} />}
    </div>
  );
}
