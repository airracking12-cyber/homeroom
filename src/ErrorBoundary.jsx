import { Component } from "react";

/**
 * Catches render errors below it. Styled by the design system (styles/components.css), not by its own CSS.
 * - Default: a calm full-screen fallback with a reload button.
 * - `inline`: a card in place of the broken section, with "Try again".
 *   Pass `resetKey` (for example the active destination) and the card clears itself when that changes.
 */
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error("Homeroom hit a render error:", error, info && info.componentStack);
  }

  componentDidUpdate(prev) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  retry = () => this.setState({ failed: false });

  render() {
    if (!this.state.failed) return this.props.children;
    if (this.props.inline) {
      return (
        <div className="page page-narrow">
          <div className="card card-large fallback" role="alert">
            <h2>This part hit a snag.</h2>
            <p>The rest of Homeroom is fine and nothing you saved is lost. Try again, or open another section.</p>
            <button type="button" className="btn btn-primary" onClick={this.retry}>Try again</button>
          </div>
        </div>
      );
    }
    return (
      <main className="fallback fallback-full" role="alert">
        <h1>Something got tangled.</h1>
        <p>Nothing you saved is lost. Reloading usually sorts it out.</p>
        <button type="button" className="btn btn-primary btn-lg" onClick={() => window.location.reload()}>Reload Homeroom</button>
      </main>
    );
  }
}
