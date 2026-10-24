import type { LookupResponse, Plan, Report, Role } from './types';

// Small in-memory cache so going back and forth between pages doesn't refetch.
const reports = new Map<string, Promise<Report>>();
const plans = new Map<string, Promise<Plan>>();

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function lookupAddress(address: string): Promise<LookupResponse> {
  return request<LookupResponse>(`/api/lookup?address=${encodeURIComponent(address)}`);
}

export function lookupCoords(lat: string, lon: string): Promise<LookupResponse> {
  return request<LookupResponse>(`/api/lookup?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
}

export function getReport(blockId: string): Promise<Report> {
  if (!reports.has(blockId)) {
    const p = request<Report>(`/api/report/${encodeURIComponent(blockId)}`);
    p.catch(() => reports.delete(blockId));
    reports.set(blockId, p);
  }
  return reports.get(blockId)!;
}

export function getPlan(blockId: string, role: Role): Promise<Plan> {
  const key = `${blockId}:${role}`;
  if (!plans.has(key)) {
    const p = request<Plan>('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ block_id: blockId, role }),
    });
    p.catch(() => plans.delete(key));
    plans.set(key, p);
  }
  return plans.get(key)!;
}

export const SAMPLE_ADDRESSES = [
  { label: 'Hudson St, Chinatown', query: 'Hudson St, Chinatown, Boston, MA' },
  { label: 'Centre St, West Roxbury', query: 'Centre St, West Roxbury, Boston, MA' },
];

export const OUTSIDE_SAMPLE = 'North St, Pittsfield, MA';
