import { Component, type ReactNode, type ErrorInfo } from 'react';

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="error-boundary">
        <h2>Scene crashed</h2>
        <pre>{this.state.error.message}</pre>
        <p>
          Try switching scenes or{' '}
          <button onClick={() => this.setState({ error: null })}>retry</button>.
        </p>
        <details>
          <summary>Stack</summary>
          <pre>{this.state.error.stack}</pre>
        </details>
      </div>
    );
  }
}
