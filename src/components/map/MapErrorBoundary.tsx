import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onError: (message: string) => void;
}

interface State {
  hasError: boolean;
}

// React error boundaries have no hook equivalent — this is the one place in
// the app that needs a class component, to catch render-time exceptions
// thrown while Leaflet mounts. Renders nothing once caught so the parent's
// MapErrorState overlay (driven by onError) is what the user sees.
export class MapErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error.message || 'The map failed to render.');
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
