"use client";
// Before/after comparison. Both panes are stacked at the exact same size, and the
// "after" pane is clipped from the divider to the right edge. Because both panes
// share one frame, the house and camera angle always line up.
//
// Works with a mouse, touch, or the keyboard (the handle is a slider).
import { useRef, useState, type ReactNode } from "react";
import { clampPct, nextPctForKey, pctFromPointer } from "@/components/compare/sliderMath";

interface BeforeAfterSliderProps {
  before: ReactNode;
  after: ReactNode;
  /** Starting divider position in percent. */
  initial?: number;
  className?: string;
}

export default function BeforeAfterSlider({ before, after, initial = 50, className = "" }: BeforeAfterSliderProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [pos, setPos] = useState(clampPct(initial));

  function moveTo(clientX: number) {
    const rect = boxRef.current?.getBoundingClientRect();
    if (rect) setPos(pctFromPointer(clientX, rect.left, rect.width));
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    moveTo(e.clientX);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragging.current) moveTo(e.clientX);
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    dragging.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const next = nextPctForKey(e.key, pos, e.shiftKey);
    if (next === null) return;
    e.preventDefault();
    setPos(next);
  }

  const labelBtn =
    "absolute top-3 z-20 min-h-9 rounded-full bg-navy-950/70 px-3.5 text-xs font-semibold text-white backdrop-blur transition hover:bg-navy-950/90";

  return (
    <div
      ref={boxRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      // pan-y: vertical swipes still scroll the page, horizontal drags move the divider
      style={{ touchAction: "pan-y" }}
      className={`relative select-none overflow-hidden rounded-3xl border border-line shadow-[0_30px_80px_-35px_rgb(0_0_0/0.9)] ${className}`}
    >
      <div className="absolute inset-0">{before}</div>
      <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
        {after}
      </div>

      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => setPos(100)}
        className={`${labelBtn} left-3`}
        aria-label="Show the before picture"
      >
        Before
      </button>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => setPos(0)}
        className={`${labelBtn} right-3`}
        aria-label="Show the after picture"
      >
        After
      </button>

      {/* divider line */}
      <div
        className="pointer-events-none absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_12px_rgb(0_0_0/0.5)]"
        style={{ left: `${pos}%` }}
        aria-hidden="true"
      />
      {/* handle */}
      <div
        role="slider"
        tabIndex={0}
        aria-label="Before and after comparison"
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        aria-valuetext={`Divider ${Math.round(pos)}% from the left. Left of it shows before, right shows after.`}
        onKeyDown={onKeyDown}
        className="absolute top-1/2 z-20 grid size-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded-full border-2 border-white bg-navy-950/85 text-white shadow-xl backdrop-blur focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint"
        style={{ left: `${pos}%` }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />
        </svg>
      </div>
    </div>
  );
}
