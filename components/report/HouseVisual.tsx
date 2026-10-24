"use client";
// The big house picture on the Home Analysis screen, with tappable hotspots that
// explain what usually drives heat on a block like this. The picture is an
// illustration, so the explanations are general, not claims about a real roof.
import { useState } from "react";
import HouseScene from "@/components/art/HouseScene";
import Icon from "@/components/ui/Icon";
import type { ImprovementId } from "@/mocks/improvements.mock";

interface Hotspot {
  id: string;
  label: string;
  /** Position as a percentage of the picture. */
  x: number;
  y: number;
  text: string;
}

const HOTSPOTS: Hotspot[] = [
  {
    id: "roof",
    label: "Roof",
    x: 50,
    y: 24,
    text: "Dark roofs soak up sunlight and release it as heat, which warms the rooms below.",
  },
  {
    id: "windows",
    label: "Sunny windows",
    x: 30,
    y: 55,
    text: "Sun through unshaded windows heats a room fast. Shade outside works better than curtains inside.",
  },
  {
    id: "yard",
    label: "Bare ground",
    x: 38,
    y: 90,
    text: "Dry, bare ground gets hotter than planted ground. Plants cool the air as they release water.",
  },
  {
    id: "street",
    label: "Pavement",
    x: 78,
    y: 94,
    text: "Asphalt and concrete store heat all day and give it off in the evening.",
  },
  {
    id: "trees",
    label: "Few trees",
    x: 14,
    y: 78,
    text: "Mature trees give shade and cool the air. Blocks with fewer trees tend to read hotter.",
  },
];

const NONE: ReadonlySet<ImprovementId> = new Set();

export default function HouseVisual() {
  const [active, setActive] = useState<string | null>(null);
  const current = HOTSPOTS.find((h) => h.id === active) ?? null;

  return (
    <figure className="relative overflow-hidden rounded-3xl border border-line shadow-[0_30px_80px_-35px_rgb(0_0_0/0.9)]">
      <div className="relative aspect-[4/3] w-full">
        <HouseScene
          improvements={NONE}
          label="Illustration of a house on a block with a dark roof, few trees and bare ground"
          className="absolute inset-0 size-full"
        />
        <ul className="absolute inset-0">
          {HOTSPOTS.map((h) => {
            const on = h.id === active;
            return (
              <li key={h.id} className="absolute" style={{ left: `${h.x}%`, top: `${h.y}%` }}>
                <button
                  type="button"
                  onClick={() => setActive(on ? null : h.id)}
                  aria-pressed={on}
                  aria-label={`${h.label}: what this means`}
                  className="group relative -ml-5 -mt-5 grid size-11 place-items-center"
                >
                  <span
                    className={`absolute inline-flex size-6 rounded-full bg-heat/50 ${on ? "" : "animate-ping"}`}
                    aria-hidden="true"
                  />
                  <span
                    className={`relative grid size-6 place-items-center rounded-full border-2 border-white text-white shadow-lg transition ${
                      on ? "scale-110 bg-mint-600" : "bg-heat"
                    }`}
                  >
                    <Icon name={on ? "check" : "info"} size={13} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <figcaption className="absolute left-3 top-3 rounded-full bg-navy-950/75 px-2.5 py-1 text-[11px] font-medium text-ink-dim backdrop-blur">
          Illustration, not your actual home
        </figcaption>
      </div>

      <div className="min-h-[4.25rem] border-t border-line bg-navy-900/90 px-4 py-3" aria-live="polite">
        {current ? (
          <p className="text-sm leading-relaxed">
            <strong className="font-semibold text-mint">{current.label}.</strong> {current.text}
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-ink-dim">
            Tap a dot to see what usually makes a block like this run hot.
          </p>
        )}
      </div>
    </figure>
  );
}
