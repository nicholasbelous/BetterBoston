import type { ScoreLabel } from '../types';

// Half-circle gauge, 0 on the left, 100 on the right, four colored bands.
const CX = 150;
const CY = 150;
const R = 120;

function point(score: number) {
  const angle = Math.PI - (score / 100) * Math.PI;
  return { x: CX + R * Math.cos(angle), y: CY - R * Math.sin(angle) };
}

function arc(from: number, to: number) {
  const a = point(from);
  const b = point(to);
  return `M${a.x.toFixed(2)} ${a.y.toFixed(2)} A${R} ${R} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

export function Gauge({ score, label, colors }: { score: number; label: ScoreLabel; colors: string[] }) {
  const m = point(score);
  return (
    <div className="gauge">
      <svg width="300" height="168" viewBox="0 0 300 168" fill="none" role="img" aria-label={`Score ${score} out of 100, ${label}`} style={{ maxWidth: '100%' }}>
        <path d={arc(0, 25)} stroke={colors[0]} strokeWidth="22" />
        <path d={arc(25, 50)} stroke={colors[1]} strokeWidth="22" />
        <path d={arc(50, 75)} stroke={colors[2]} strokeWidth="22" />
        <path d={arc(75, 100)} stroke={colors[3]} strokeWidth="22" />
        <circle cx={m.x} cy={m.y} r="14" fill="#FFFFFF" stroke="#14212B" strokeWidth="4" />
      </svg>
      <div className="center" aria-hidden="true">
        <span style={{ fontSize: 56, lineHeight: '60px', fontWeight: 800, letterSpacing: '-0.03em' }}>{score}</span>
        <span className="muted" style={{ fontSize: 14, fontWeight: 600 }}>out of 100</span>
      </div>
    </div>
  );
}
