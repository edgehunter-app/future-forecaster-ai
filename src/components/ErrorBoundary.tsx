import { Component, type ErrorInfo, type ReactNode } from "react";

interface State { error: Error | null }

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-6">
        <div className="max-w-lg w-full rounded-lg border border-border bg-card p-6 shadow-card">
          <h1 className="text-xl font-bold text-foreground">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">An unexpected error was caught while rendering.</p>
          <pre className="mt-4 max-h-48 overflow-auto rounded-md border border-border bg-background p-3 text-xs font-mono text-destructive whitespace-pre-wrap">
            {this.state.error.message}
          </pre>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center rounded-md bg-info px-3 py-2 text-sm font-semibold text-white hover:bg-info/90"
            >
              Reload Page
            </button>
            <a
              href="mailto:support@edgehunter.app?subject=EdgeHunter%20Error"
              className="text-sm font-medium text-info hover:underline"
            >
              Report Issue
            </a>
          </div>
        </div>
      </div>
    );
  }
}