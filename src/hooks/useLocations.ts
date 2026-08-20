import { useEffect, useState } from 'react';
import { locations as allLocations } from '../data/locations';
import type { Location } from '../types/location';
import type { DataStatus } from '../context/MapExplorerProvider';

const SIMULATED_LOAD_MS = 400;

/**
 * Wraps the static dataset in a brief simulated load so the loading state is
 * real and exercisable. The shape (locations + status) is what a real fetch
 * hook would return, so swapping in a network call later doesn't change
 * anything downstream.
 */
export function useLocations(): { locations: Location[]; status: DataStatus } {
  const [status, setStatus] = useState<DataStatus>('loading');

  useEffect(() => {
    const timer = window.setTimeout(() => setStatus('ready'), SIMULATED_LOAD_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return { locations: allLocations, status };
}
