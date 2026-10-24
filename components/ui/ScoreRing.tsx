// Circular 0-100 score. The number is also text, so it does not rely on color alone.
import { TONE_RING, type Tone } from "@/components/report/levels";

interface ScoreRingProps {
  value: number | null;
  tone: Tone;
  size?: number;
  /** Accessible name, e.g. "Heat score". */
  label: string;
}

export default function ScoreRing({ value, tone, size = 76, label }: ScoreRingProps) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={value === null ? `${label}: no data` : `${label}: ${Math.round(pct)} out of 100`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(255 255 255 / 0.1)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={TONE_RING[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-display text-xl font-bold">
        {value === null ? "--" : Math.round(pct)}
      </span>
    </div>
  );
}
