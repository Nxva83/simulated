import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/** Empêche une erreur de rendu d'une vue d'emporter toute l'application. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ui]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="placeholder error">
          <h1>Quelque chose s’est mal passé</h1>
          <p>{this.state.error.message}</p>
          <button className="btn" onClick={() => this.setState({ error: null })}>
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
