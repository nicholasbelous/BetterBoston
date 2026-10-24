import type { ScoreLabel } from '../types';

export const SCALE_RANGES: { label: ScoreLabel; range: string }[] = [
  { label: 'Low', range: '0–25' },
  { label: 'Moderate', range: '26–50' },
  { label: 'High', range: '51–75' },
  { label: 'Very high', range: '76–100' },
];

export const HEAT_COLORS = ['var(--heat-1)', 'var(--heat-2)', 'var(--heat-3)', 'var(--heat-4)'];
export const TREE_COLORS = ['var(--tree-1)', 'var(--tree-2)', 'var(--tree-3)', 'var(--tree-4)'];

const slug = (label: ScoreLabel) => label.toLowerCase().replace(' ', '-');

export const heatBadgeClass = (label: ScoreLabel) => `badge badge-heat-${slug(label)}`;
export const treeBadgeClass = (label: ScoreLabel) => `badge badge-tree-${slug(label)}`;

export function heatLine(deltaF: number): string {
  if (deltaF >= 1) return `Your block's ground got about ${Math.round(deltaF)}°F hotter than the Boston average on a summer afternoon`;
  if (deltaF <= -1) return `Your block's ground stayed about ${Math.round(Math.abs(deltaF))}°F cooler than the Boston average on a summer afternoon`;
  return "Your block's ground was about as hot as the Boston average on a summer afternoon";
}
