// Turns 0-100 relative scores into plain labels and colors.
// Scores compare blocks with each other; they are not official ratings.

export type Level = "Low" | "Moderate" | "High";
export type Tone = "bad" | "warn" | "good";

export function levelFromScore(score: number | null | undefined): Level | null {
  if (score === null || score === undefined) return null;
  if (score < 34) return "Low";
  if (score < 67) return "Moderate";
  return "High";
}

/** For heat and flood style risks, higher is worse. */
export function riskTone(level: Level | null): Tone {
  if (level === "High") return "bad";
  if (level === "Moderate") return "warn";
  return "good";
}

/** For tree cover, lower is worse. */
export function coverTone(level: Level | null): Tone {
  if (level === "Low") return "bad";
  if (level === "Moderate") return "warn";
  return "good";
}

export const TONE_TEXT: Record<Tone, string> = {
  bad: "text-heat",
  warn: "text-amber",
  good: "text-leaf",
};

export const TONE_TILE: Record<Tone, string> = {
  bad: "bg-heat/15 text-heat",
  warn: "bg-amber/15 text-amber",
  good: "bg-leaf/15 text-leaf",
};

export const TONE_RING: Record<Tone, string> = {
  bad: "#f2763d",
  warn: "#f3b941",
  good: "#45d48b",
};
