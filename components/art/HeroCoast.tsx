// ILLUSTRATION (not a photo): decorative coastal neighborhood at dusk for the landing hero.
import { useId } from "react";

const HOUSES: { x: number; y: number; w: number; h: number; lit: boolean[] }[] = [
  { x: 14, y: 232, w: 46, h: 38, lit: [true, false, true] },
  { x: 74, y: 246, w: 56, h: 42, lit: [true, true, false] },
  { x: 144, y: 262, w: 40, h: 34, lit: [false, true, true] },
  { x: 40, y: 292, w: 62, h: 46, lit: [true, true, true] },
  { x: 120, y: 300, w: 50, h: 40, lit: [true, false, true] },
];

export default function HeroCoast({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 400 360"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#14203d" />
          <stop offset="0.38" stopColor="#4b3b6f" />
          <stop offset="0.62" stopColor="#c8606a" />
          <stop offset="0.8" stopColor="#f09a6a" />
          <stop offset="1" stopColor="#f7c284" />
        </linearGradient>
        <linearGradient id={`${uid}-water`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e88f72" />
          <stop offset="0.35" stopColor="#7a5a78" />
          <stop offset="1" stopColor="#0e2740" />
        </linearGradient>
        <radialGradient id={`${uid}-sun`}>
          <stop offset="0" stopColor="#fff1c9" />
          <stop offset="0.35" stopColor="#ffd08a" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffb06a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.55" stopColor="#0a1720" stopOpacity="0" />
          <stop offset="1" stopColor="#0a1720" stopOpacity="1" />
        </linearGradient>
      </defs>

      <rect width="400" height="360" fill={`url(#${uid}-sky)`} />
      <circle cx="285" cy="226" r="84" fill={`url(#${uid}-sun)`} />
      <circle cx="285" cy="226" r="19" fill="#fff0c7" />
      <g fill="#f6b8a0" opacity={0.5}>
        <ellipse cx="90" cy="150" rx="70" ry="6" />
        <ellipse cx="230" cy="176" rx="90" ry="5" />
        <ellipse cx="330" cy="130" rx="55" ry="5" />
      </g>

      {/* water */}
      <rect y="226" width="400" height="134" fill={`url(#${uid}-water)`} />
      <g stroke="#ffd9a8" strokeWidth="1.4" strokeLinecap="round" opacity={0.5}>
        <path d="M250 236h70M262 244h46M270 252h30M240 260h30" />
      </g>
      {/* far shore */}
      <path d="M0 232c60-8 90 4 150-2s120-6 250 2v8H0Z" fill="#241f3a" />

      {/* near land with houses */}
      <path d="M0 220c60-4 130 18 190 60 34 24 70 52 110 80H0Z" fill="#0b1b1f" />
      {HOUSES.map((h, i) => (
        <g key={i}>
          <rect x={h.x} y={h.y} width={h.w} height={h.h} fill="#17242c" />
          <polygon
            points={`${h.x - 4},${h.y} ${h.x + h.w / 2},${h.y - 18} ${h.x + h.w + 4},${h.y}`}
            fill="#0d171d"
          />
          {h.lit.map((on, k) => (
            <rect
              key={k}
              x={h.x + 7 + k * (h.w / 3.1)}
              y={h.y + 10}
              width="7"
              height="9"
              fill={on ? "#ffc56b" : "#27343c"}
            />
          ))}
        </g>
      ))}
      <g fill="#0a1a17">
        <circle cx="10" cy="262" r="20" />
        <circle cx="66" cy="238" r="14" />
        <circle cx="190" cy="290" r="17" />
        <circle cx="24" cy="316" r="22" />
        <circle cx="108" cy="340" r="20" />
        <circle cx="168" cy="330" r="15" />
      </g>
      <rect width="400" height="360" fill={`url(#${uid}-fade)`} />
    </svg>
  );
}
