/**
 * Explore mode utilities.
 * When a user enters via /explore, we set a flag so dashboard components
 * fetch all data for the role instead of just the logged-in user's data.
 */

export function isExploreMode(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('aquavera_explore') === 'true';
}

export function clearExploreMode(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('aquavera_explore');
  }
}

/** Append ?explore=true to an endpoint if in explore mode */
export function withExplore(endpoint: string): string {
  if (!isExploreMode()) return endpoint;
  const sep = endpoint.includes('?') ? '&' : '?';
  return `${endpoint}${sep}explore=true`;
}
