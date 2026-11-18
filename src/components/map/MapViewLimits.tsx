import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { DESKTOP_MAP_QUERY } from '../../lib/constants';
import { attachViewLimits } from './viewLimits';

/** Zoom-out and pan limits fitted to the contiguous US. See ./viewLimits. */
export function MapViewLimits() {
  const map = useMap();

  useEffect(() => attachViewLimits(map, window.matchMedia(DESKTOP_MAP_QUERY)), [map]);

  return null;
}
