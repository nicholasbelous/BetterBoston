// ILLUSTRATION (not a photo): one New England house drawn with fixed geometry.
// "Before" and "after" are the SAME drawing with different improvement layers
// switched on, so the camera angle, framing and house never change. That is what
// makes the before/after slider line up exactly.
//
// To use real photos instead, see mocks/houseImages.mock.ts.
import { useId } from "react";
import type { ImprovementId } from "@/mocks/improvements.mock";

interface HouseSceneProps {
  /** Which improvements are drawn. Empty set = the "before" picture. */
  improvements: ReadonlySet<ImprovementId>;
  className?: string;
  /** Accessible description. Pass "" to hide from assistive tech (decorative). */
  label?: string;
}

const WINDOW_XS = [125, 185, 245];

function Tree({ x, base, scale = 1, id }: { x: number; base: number; scale?: number; id: string }) {
  // Trunk plus layered canopy, drawn around (x, base).
  const s = scale;
  return (
    <g>
      <ellipse cx={x + 6 * s} cy={base + 4} rx={52 * s} ry={9 * s} fill="#0b2112" opacity={0.28} />
      <path
        d={`M${x - 5 * s} ${base} L${x - 3 * s} ${base - 90 * s} L${x + 3 * s} ${base - 90 * s} L${x + 5 * s} ${base} Z`}
        fill="#4a3426"
      />
      <g fill={`url(#${id}-leaf)`}>
        <circle cx={x} cy={base - 120 * s} r={46 * s} />
        <circle cx={x - 34 * s} cy={base - 96 * s} r={34 * s} />
        <circle cx={x + 34 * s} cy={base - 98 * s} r={36 * s} />
        <circle cx={x - 10 * s} cy={base - 150 * s} r={30 * s} />
        <circle cx={x + 22 * s} cy={base - 140 * s} r={28 * s} />
      </g>
      <g fill="#8fd18a" opacity={0.22}>
        <circle cx={x - 14 * s} cy={base - 136 * s} r={16 * s} />
        <circle cx={x + 26 * s} cy={base - 120 * s} r={12 * s} />
      </g>
    </g>
  );
}

export default function HouseScene({ improvements, className, label }: HouseSceneProps) {
  const uid = useId().replace(/:/g, "");
  const has = (i: ImprovementId) => improvements.has(i);
  const trees = has("shade-trees");
  const shade = has("exterior-shade");
  const roof = has("cool-roof");
  const garden = has("landscaping");
  // 0 = nothing improved (hot, hazy), 1 = everything improved (cool, clear)
  const progress = improvements.size / 4;
  const alt = label ?? (improvements.size === 0 ? "Illustration of the house today" : "Illustration of the house with improvements");

  return (
    <svg
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
    >
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6fa8d6" />
          <stop offset="1" stopColor="#d6e8f2" />
        </linearGradient>
        <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#27506f" />
          <stop offset="1" stopColor="#0e2234" />
        </linearGradient>
        <linearGradient id={`${uid}-leaf`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a9a4f" />
          <stop offset="1" stopColor="#235a33" />
        </linearGradient>
        <linearGradient id={`${uid}-warm`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff8a3d" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ff8a3d" stopOpacity="0" />
        </linearGradient>
        <pattern id={`${uid}-siding`} width="8" height="7" patternUnits="userSpaceOnUse">
          <rect width="8" height="7" fill="#8ea3b6" />
          <rect y="6" width="8" height="1" fill="#6f8599" />
        </pattern>
        <pattern id={`${uid}-stripe`} width="10" height="10" patternUnits="userSpaceOnUse">
          <rect width="10" height="10" fill="#f1f6f8" />
          <rect width="5" height="10" fill="#1fa88a" />
        </pattern>
        <pattern id={`${uid}-shingle`} width="10" height="6" patternUnits="userSpaceOnUse">
          <rect width="10" height="6" fill={roof ? "#dbe3e8" : "#2d3641"} />
          <rect y="5" width="10" height="1" fill={roof ? "#b9c5cd" : "#1a2028"} />
        </pattern>
      </defs>

      {/* sky + distant trees (same in every version) */}
      <rect width="400" height="300" fill={`url(#${uid}-sky)`} />
      <ellipse cx="320" cy="40" rx="60" ry="20" fill="#fff" opacity={0.35} />
      <ellipse cx="70" cy="60" rx="50" ry="14" fill="#fff" opacity={0.3} />
      <g fill="#315f45" opacity={0.7}>
        <circle cx="18" cy="168" r="44" />
        <circle cx="388" cy="172" r="48" />
        <circle cx="70" cy="188" r="30" />
        <circle cx="340" cy="190" r="30" />
      </g>

      {/* ground */}
      <rect y="236" width="400" height="64" fill={garden ? "#3f8a45" : "#a3a465"} />
      {!garden ? (
        <g fill="#8a7f55" opacity={0.55}>
          <ellipse cx="62" cy="262" rx="26" ry="5" />
          <ellipse cx="340" cy="258" rx="22" ry="4" />
          <ellipse cx="300" cy="270" rx="14" ry="3" />
        </g>
      ) : (
        <g fill="#2f7436" opacity={0.6}>
          <ellipse cx="90" cy="268" rx="40" ry="6" />
          <ellipse cx="320" cy="266" rx="36" ry="6" />
        </g>
      )}
      <rect y="268" width="400" height="14" fill="#b9bec2" />
      <rect y="282" width="400" height="18" fill="#394048" />
      <rect y="281" width="400" height="2" fill="#d9d29a" opacity={0.7} />
      <polygon points="188,250 212,250 232,272 168,272" fill="#cfc8bb" />

      {/* house */}
      <rect x="105" y="118" width="190" height="132" fill={`url(#${uid}-siding)`} />
      <rect x="105" y="118" width="190" height="4" fill="#e8eef2" />
      {/* roof */}
      <polygon points="92,124 200,50 308,124" fill={`url(#${uid}-shingle)`} />
      <polygon points="92,124 200,50 308,124 308,129 200,57 92,129" fill="#e8eef2" opacity={0.9} />
      {roof ? <polygon points="200,56 300,122 262,122 200,76" fill="#fff" opacity={0.22} /> : null}
      <rect x="252" y="48" width="18" height="40" fill="#7a4b3d" />
      <rect x="250" y="45" width="22" height="5" fill="#9b6a58" />
      {/* dormer */}
      <rect x="178" y="80" width="44" height="34" fill="#8ea3b6" />
      <polygon points="172,82 200,60 228,82" fill={roof ? "#dbe3e8" : "#2d3641"} />
      <rect x="186" y="88" width="28" height="22" fill="#f1f6f8" />
      <rect x="189" y="91" width="22" height="16" fill={`url(#${uid}-glass)`} />
      {/* second-floor windows */}
      {WINDOW_XS.map((x) => (
        <g key={x}>
          <rect x={x - 3} y="137" width="36" height="50" fill="#f1f6f8" />
          <rect x={x} y="140" width="30" height="44" fill={`url(#${uid}-glass)`} />
          <rect x={x + 14} y="140" width="2" height="44" fill="#f1f6f8" />
          <rect x={x} y="160" width="30" height="2" fill="#f1f6f8" />
          <polygon points={`${x},140 ${x + 12},140 ${x},158`} fill="#fff" opacity={0.12} />
        </g>
      ))}
      {/* porch */}
      <rect x="95" y="196" width="210" height="9" fill="#e8eef2" />
      <rect x="100" y="205" width="200" height="45" fill="#7d93a6" opacity={0.5} />
      <rect x="130" y="212" width="30" height="34" fill="#f1f6f8" />
      <rect x="133" y="215" width="24" height="28" fill={`url(#${uid}-glass)`} />
      <rect x="240" y="212" width="30" height="34" fill="#f1f6f8" />
      <rect x="243" y="215" width="24" height="28" fill={`url(#${uid}-glass)`} />
      <rect x="186" y="208" width="28" height="42" fill="#5a3a2e" />
      <rect x="191" y="213" width="18" height="14" fill={`url(#${uid}-glass)`} />
      <circle cx="209" cy="232" r="1.8" fill="#e6c36a" />
      {[108, 150, 243, 285].map((x) => (
        <rect key={x} x={x} y="205" width="7" height="42" fill="#f1f6f8" />
      ))}
      <rect x="100" y="232" width="200" height="3" fill="#f1f6f8" />
      <rect x="96" y="246" width="208" height="7" fill="#d8d2c6" />

      {/* exterior shade: awnings over the upper windows and the porch */}
      {shade ? (
        <g>
          {WINDOW_XS.map((x) => (
            <g key={x}>
              <rect x={x - 4} y="152" width="38" height="34" fill="#04121c" opacity={0.28} />
              <polygon
                points={`${x - 5},136 ${x + 35},136 ${x + 41},153 ${x - 11},153`}
                fill={`url(#${uid}-stripe)`}
              />
              <polygon
                points={`${x - 11},153 ${x + 41},153 ${x + 41},157 ${x - 11},157`}
                fill="#128069"
              />
            </g>
          ))}
          <rect x="100" y="205" width="200" height="22" fill="#04121c" opacity={0.2} />
          <polygon points="94,197 306,197 312,214 88,214" fill={`url(#${uid}-stripe)`} opacity={0.96} />
          <rect x="88" y="214" width="224" height="4" fill="#128069" />
        </g>
      ) : null}

      {/* foundation planting */}
      {garden ? (
        <g>
          {[116, 140, 262, 286].map((x, i) => (
            <g key={x}>
              <circle cx={x} cy="254" r="13" fill="#2f7a3b" />
              <circle cx={x - 4} cy="250" r="8" fill="#3f9a4b" />
              <circle cx={x + 5} cy="248" r="2.2" fill={i % 2 ? "#f4a6c1" : "#fff4c2"} />
              <circle cx={x - 6} cy="254" r="2.2" fill={i % 2 ? "#fff4c2" : "#f4a6c1"} />
            </g>
          ))}
          <ellipse cx="80" cy="262" rx="24" ry="7" fill="#2f7a3b" />
          <ellipse cx="322" cy="262" rx="24" ry="7" fill="#2f7a3b" />
          <circle cx="76" cy="258" r="2.4" fill="#f4a6c1" />
          <circle cx="326" cy="258" r="2.4" fill="#fff4c2" />
        </g>
      ) : (
        <g fill="#7a5f45" opacity={0.75}>
          <ellipse cx="128" cy="256" rx="26" ry="5" />
          <ellipse cx="274" cy="256" rx="26" ry="5" />
        </g>
      )}

      {/* trees: a young sapling today, full shade trees after */}
      {trees ? (
        <>
          <Tree x={50} base={282} scale={1.05} id={uid} />
          <Tree x={352} base={280} scale={0.95} id={uid} />
          <g fill="#04121c" opacity={0.22}>
            <polygon points="105,118 148,118 128,250 105,250" />
            <polygon points="258,118 295,118 295,250 274,250" />
          </g>
        </>
      ) : (
        <g>
          <rect x="55" y="246" width="3" height="34" fill="#6b4c36" />
          <circle cx="56" cy="244" r="11" fill="#5f9a4a" />
          <circle cx="50" cy="248" r="7" fill="#74b05a" />
        </g>
      )}

      {/* heat: warm tint and haze fade out as improvements are added */}
      <rect width="400" height="300" fill={`url(#${uid}-warm)`} opacity={1 - progress} />
      <rect width="400" height="300" fill="#fff4dd" opacity={0.16 * (1 - progress)} />
      {!roof ? (
        <g fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity={0.35}>
          <path d="M120 100c6-6 12 6 18 0s12 6 18 0" />
          <path d="M196 70c6-6 12 6 18 0s12 6 18 0" />
          <path d="M236 98c6-6 12 6 18 0s12 6 18 0" />
        </g>
      ) : null}
    </svg>
  );
}
