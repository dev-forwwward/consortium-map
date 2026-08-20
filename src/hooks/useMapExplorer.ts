import { useContext } from 'react';
import { MapExplorerContext, type MapExplorerContextValue } from '../context/MapExplorerProvider';

export function useMapExplorer(): MapExplorerContextValue {
  const context = useContext(MapExplorerContext);
  if (!context) {
    throw new Error('useMapExplorer must be used within a MapExplorerProvider');
  }
  return context;
}
