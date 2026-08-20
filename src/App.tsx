import { MapExplorerProvider } from './context/MapExplorerProvider';
import { ExplorerLayout } from './components/layout/ExplorerLayout';

export default function App() {
  return (
    <MapExplorerProvider>
      <ExplorerLayout />
    </MapExplorerProvider>
  );
}
