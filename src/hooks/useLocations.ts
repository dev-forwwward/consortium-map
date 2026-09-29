import { useEffect, useState } from 'react';
import { locations as staticLocations } from '../data/locations';
import type { Location } from '../types/location';
import type { DataStatus } from '../context/MapExplorerProvider';
import { findCmsList, readCmsLocations } from '../lib/cmsSource';

export type LocationSource = 'static' | 'cms';

const SIMULATED_LOAD_MS = 400;
// Finsweet re-renders a filtered list as a burst of mutations; coalesce them
// into one re-read instead of rebuilding every marker per mutation.
const CMS_REREAD_DEBOUNCE_MS = 50;

const EMPTY: Location[] = [];

export function useLocations(source: LocationSource = 'static'): {
  locations: Location[];
  status: DataStatus;
} {
  const fromStatic = useStaticLocations(source === 'static');
  const fromCms = useCmsLocations(source === 'cms');
  return source === 'cms' ? fromCms : fromStatic;
}

/**
 * Wraps the static dataset in a brief simulated load so the loading state is
 * real and exercisable in local dev.
 */
function useStaticLocations(enabled: boolean) {
  const [status, setStatus] = useState<DataStatus>('loading');

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => setStatus('ready'), SIMULATED_LOAD_MS);
    return () => window.clearTimeout(timer);
  }, [enabled]);

  return { locations: staticLocations, status };
}

/**
 * Reads the Webflow Collection List on the host page and re-reads it whenever
 * the list changes — a filter hiding/showing items, load-more appending them.
 * Observing the DOM rather than calling Finsweet's API keeps this working
 * with any filter tool, or none.
 */
function useCmsLocations(enabled: boolean) {
  const [locations, setLocations] = useState<Location[]>(EMPTY);
  const [status, setStatus] = useState<DataStatus>('loading');

  useEffect(() => {
    if (!enabled) return;
    const list = findCmsList();
    if (!list) {
      console.error(
        '[consortium-map-embed] no [data-cm-list] element found on the page — the map has no projects to show',
      );
      setStatus('error');
      return;
    }

    // Skipping identical reads matters: the bridge's own class toggles on
    // items are attribute mutations too, and a fresh array identity would
    // rebuild every marker for nothing.
    let lastKey = '';
    const read = () => {
      const next = readCmsLocations(list);
      const key = JSON.stringify(next);
      if (key === lastKey) return;
      lastKey = key;
      setLocations(next);
    };

    read();
    setStatus('ready');

    let timer: number | undefined;
    const observer = new MutationObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(read, CMS_REREAD_DEBOUNCE_MS);
    });
    observer.observe(list, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'hidden'],
    });

    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [enabled]);

  return { locations, status };
}
