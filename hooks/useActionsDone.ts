"use client";
// Which recommended actions the person has checked off. Saved on this device only.
import { useCallback, useMemo } from "react";
import { useStoredString } from "@/hooks/useStoredString";

const KEY = "climatecheck:actions-done";

function parse(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function useActionsDone() {
  const [raw, setRaw] = useStoredString(KEY);
  const done = useMemo(() => new Set(parse(raw)), [raw]);

  const toggle = useCallback(
    (id: string) => {
      const next = new Set(parse(raw));
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setRaw(JSON.stringify([...next]));
    },
    [raw, setRaw],
  );

  return { done, toggle };
}
