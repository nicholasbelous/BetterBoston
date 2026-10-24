// Four-step color scale with a marker at the score. The number and word label are always shown
// next to it, so color is never the only cue.

export function ScaleBar({ score, colors, label }: { score: number; colors: string[]; label: string }) {
  return (
    <div className="scale" role="img" aria-label={`${label}: ${score} out of 100`}>
      <div className="segments">
        {colors.map((c) => (
          <div key={c} style={{ background: c }} />
        ))}
      </div>
      <div className="marker" style={{ left: `${Math.max(0, Math.min(100, score))}%` }} />
    </div>
  );
}
