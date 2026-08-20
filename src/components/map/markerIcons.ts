import L from 'leaflet';
import { CLUSTER_PX, INDIVIDUAL_MARKER_PX, clusterSizeTier } from '../../lib/mapUtils';

export function createIndividualIcon(options: { selected: boolean }): L.DivIcon {
  const classes = ['marker-pin'];
  if (options.selected) classes.push('marker-pin--selected');

  const size = INDIVIDUAL_MARKER_PX;
  return L.divIcon({
    html: '<span class="marker-pin__dot"></span>',
    className: classes.join(' '),
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export function createClusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const count = cluster.getChildCount();
  const tier = clusterSizeTier(count);
  const size = CLUSTER_PX[tier];

  return L.divIcon({
    html: `<span class="cluster-pin__count">${count}</span>`,
    className: `cluster-pin cluster-pin--${tier}`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}
