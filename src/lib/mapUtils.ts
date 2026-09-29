export type ClusterSizeTier = 'sm' | 'md' | 'lg';

export function clusterSizeTier(count: number): ClusterSizeTier {
  if (count >= 10) return 'lg';
  if (count >= 5) return 'md';
  return 'sm';
}

export const CLUSTER_PX: Record<ClusterSizeTier, number> = {
  sm: 34,
  md: 44,
  lg: 56,
};

export const INDIVIDUAL_MARKER_PX = 22;

export function locationAriaLabel(location: {
  name: string;
  category: string;
  city: string;
  state: string;
}): string {
  return [location.name, location.category, location.city, location.state].filter(Boolean).join(', ');
}

/** "City, ST" — omits whichever part is empty (CMS items may lack a state). */
export function formatPlace(location: { city: string; state: string }): string {
  return [location.city, location.state].filter(Boolean).join(', ');
}
