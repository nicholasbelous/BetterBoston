"use client";
// Returns a function that builds a link to another screen while keeping the
// chosen location (?lat&lng&q) from the current URL.
import { useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { parseLocation, withLocation } from "@/services/locationContext";

export function useScreenHref() {
  const params = useSearchParams();
  const ctx = parseLocation((k) => params.get(k));
  const { lat, lng, q, isDefault } = ctx;
  return useCallback(
    (path: string) => withLocation(path, isDefault ? null : { lat, lng, q }),
    [lat, lng, q, isDefault],
  );
}
