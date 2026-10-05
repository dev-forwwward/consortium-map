import { useCallback, useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import { useMap, useMapEvents } from 'react-leaflet';
import { useMapExplorer } from '../../hooks/useMapExplorer';
import { locationAriaLabel } from '../../lib/mapUtils';
import { MAX_CLUSTER_RADIUS } from '../../lib/constants';
import { SELECT_EVENT } from '../../lib/cmsSource';
import { createClusterIcon, createIndividualIcon } from './markerIcons';

// Cluster bubbles are re-created by the plugin on every zoom/spiderfy, so
// they're tagged for accessibility via a DOM sweep rather than per-instance
// setup — role/tabindex/aria-label applied once per element, keyed off a
// data attribute so repeated sweeps are cheap no-ops for already-tagged ones.
function tagClusterElements(container: HTMLElement) {
  container.querySelectorAll<HTMLElement>('.cluster-pin:not([data-a11y-tagged])').forEach((el) => {
    const count = el.querySelector('.cluster-pin__count')?.textContent ?? 'Multiple';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', `${count} projects in this area, activate to zoom in`);
    el.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }
    });
    el.setAttribute('data-a11y-tagged', 'true');
  });
}

/**
 * `selectOnly` (the Webflow embed): a marker click selects the location and
 * tells the page via SELECT_EVENT, which highlights and reveals the card.
 * No detail modal. Off (the standalone explorer): a click opens the modal.
 */
export function ClusterLayer({ selectOnly = false }: { selectOnly?: boolean }) {
  const map = useMap();
  const { locations, selectedLocationId, hoveredLocationId, selectLocation, setHovered } =
    useMapExplorer();

  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  const markerByIdRef = useRef<Map<string, L.Marker>>(new Map());
  const hoverElRef = useRef<HTMLElement | null>(null);

  const tagClusters = useCallback(() => {
    tagClusterElements(map.getContainer());
  }, [map]);

  // Mount the cluster group once per map instance.
  useEffect(() => {
    const clusterGroup = L.markerClusterGroup({
      iconCreateFunction: createClusterIcon,
      maxClusterRadius: MAX_CLUSTER_RADIUS,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
    });
    clusterGroupRef.current = clusterGroup;
    map.addLayer(clusterGroup);
    clusterGroup.on('animationend', tagClusters);

    return () => {
      clusterGroup.off('animationend', tagClusters);
      map.removeLayer(clusterGroup);
      clusterGroupRef.current = null;
      markerByIdRef.current.clear();
    };
  }, [map, tagClusters]);

  // Memoized so useMapEvents (which resubscribes on identity change) doesn't
  // churn map.off/map.on on every render — see MapBoundsSync for why that
  // churn can drop an event fired mid-cascade.
  const tagHandlers = useMemo(
    () => ({ moveend: tagClusters, zoomend: tagClusters }),
    [tagClusters],
  );
  useMapEvents(tagHandlers);

  // Rebuild markers whenever the dataset or selection changes. The dataset
  // is small enough that a full rebuild on selection change is cheap and far
  // simpler than patching individual icons in place.
  useEffect(() => {
    const clusterGroup = clusterGroupRef.current;
    if (!clusterGroup) return;

    clusterGroup.clearLayers();
    markerByIdRef.current.clear();

    const markers = locations.map((location) => {
      const marker = L.marker([location.latitude, location.longitude], {
        icon: createIndividualIcon({ selected: location.id === selectedLocationId }),
        keyboard: true,
      });

      const activate = () => {
        if (selectOnly) {
          selectLocation(location.id);
          document.dispatchEvent(new CustomEvent(SELECT_EVENT, { detail: { id: location.id } }));
        } else {
          selectLocation(location.id, { openDetail: true });
        }
      };

      marker.on('click', activate);
      marker.on('mouseover', () => setHovered(location.id));
      marker.on('mouseout', () => setHovered(null));
      marker.on('add', () => {
        const el = marker.getElement();
        if (!el) return;
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
        el.setAttribute(
          'aria-label',
          `${locationAriaLabel(location)} — ${selectOnly ? 'show in project list' : 'open details'}`,
        );
        el.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            activate();
          }
        });
      });

      markerByIdRef.current.set(location.id, marker);
      return marker;
    });

    clusterGroup.addLayers(markers);
    requestAnimationFrame(tagClusters);
  }, [locations, selectedLocationId, selectLocation, setHovered, tagClusters, selectOnly]);

  // When selection changes, reveal the marker even if it's currently folded
  // into a cluster bubble, so the map never shows a mismatch with the list.
  useEffect(() => {
    const clusterGroup = clusterGroupRef.current;
    if (!clusterGroup || !selectedLocationId) return;
    const marker = markerByIdRef.current.get(selectedLocationId);
    if (!marker) return;
    // zoomToShowLayer's own pan/zoom can fire moveend/zoomend against a
    // not-yet-final view mid-operation — MapBoundsSync's list-filtering
    // sync ends up stale if it trusts those. Force one more moveend once
    // this callback fires, which Leaflet only calls after the reveal is
    // truly finished, so the list resyncs against the actual final bounds.
    clusterGroup.zoomToShowLayer(marker, () => {
      map.fire('moveend');
    });
  }, [selectedLocationId, map]);

  // Hover highlighting is applied imperatively to whichever element is
  // currently on screen for the hovered location — the marker itself, or
  // its parent cluster bubble — without panning/zooming the map.
  useEffect(() => {
    const clusterGroup = clusterGroupRef.current;
    if (!clusterGroup) return;

    if (hoverElRef.current) {
      hoverElRef.current.classList.remove('map-hover-highlight');
      hoverElRef.current = null;
    }

    if (!hoveredLocationId) return;
    const marker = markerByIdRef.current.get(hoveredLocationId);
    if (!marker) return;

    const visibleLayer = clusterGroup.getVisibleParent(marker) ?? marker;
    const el = visibleLayer.getElement?.();
    if (el) {
      el.classList.add('map-hover-highlight');
      hoverElRef.current = el;
    }
  }, [hoveredLocationId]);

  return null;
}
