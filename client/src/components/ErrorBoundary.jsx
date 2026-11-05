import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled UI error", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="grid min-h-screen place-items-center bg-slate-900 p-6 text-center">
        <div className="card max-w-md p-8">
          <h1 className="mb-2 text-2xl font-bold text-sky-300">Something went wrong</h1>
          <p className="mb-6 text-slate-300">An unexpected error occurred. Reloading usually fixes it.</p>
          <button type="button" className="btn-primary" onClick={() => window.location.assign("/")}>
            Back to home
          </button>
        </div>
      </main>
    );
  }
}
