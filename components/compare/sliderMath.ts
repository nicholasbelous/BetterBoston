// Pure helpers for the before/after slider (position is the divider, 0-100 % from the left).

export function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.min(100, Math.max(0, n));
}

/** Convert a pointer x position into a 0-100 divider position inside a box. */
export function pctFromPointer(clientX: number, left: number, width: number): number {
  if (width <= 0) return 50;
  return clampPct(((clientX - left) / width) * 100);
}

/** Keyboard behavior: arrows move 2% (10% with Shift), Home/End jump to the ends. Returns null for other keys. */
export function nextPctForKey(key: string, current: number, shift = false): number | null {
  const step = shift ? 10 : 2;
  switch (key) {
    case "ArrowLeft":
    case "ArrowDown":
      return clampPct(current - step);
    case "ArrowRight":
    case "ArrowUp":
      return clampPct(current + step);
    case "Home":
      return 0;
    case "End":
      return 100;
    default:
      return null;
  }
}
