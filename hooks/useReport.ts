"use client";
// Loads the score report for a place. Never throws: the client falls back to mock data.
import { useEffect, useState } from "react";
import { loadReport, type ReportData } from "@/services/climateClient";

export function useReport(lat: number, lng: number): { data: ReportData | null; loading: boolean } {
  const key = `${lat},${lng}`;
  const [state, setState] = useState<{ key: string; data: ReportData } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadReport(lat, lng).then((data) => {
      if (!cancelled) setState({ key, data });
    });
    return () => {
      cancelled = true;
    };
  }, [lat, lng, key]);

  // Ignore a stale result from a previous location while the new one loads.
  const data = state && state.key === key ? state.data : null;
  return { data, loading: data === null };
}
