import { Component } from "react";

const CSS = `
.hrErr{min-height:100vh;min-height:100dvh;display:grid;place-items:center;padding:24px;background:#FAF9F5;color:#141413;font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}
.hrErr div{max-width:380px;text-align:center}
.hrErr h1{font-family:"Fraunces","Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;font-weight:400;font-size:30px;letter-spacing:-.02em;margin:0 0 10px}
.hrErr p{margin:0 0 22px;color:#666560;line-height:1.55}
.hrErr button{border:0;border-radius:14px;padding:12px 20px;font:inherit;font-weight:600;background:#141413;color:#FAF9F5;cursor:pointer}
.hrErr button:focus-visible{outline:2px solid #B9553A;outline-offset:3px}
@media (prefers-color-scheme:dark){.hrErr{background:#1A1714;color:#F3EDE2}.hrErr p{color:#ABA396}.hrErr button{background:#F3EDE2;color:#1A1714}}
.hrErrIn{max-width:420px;margin:12vh auto 0;padding:28px 24px;text-align:center;border:1px solid var(--line,#E8E6DC);border-radius:20px;background:var(--paper,#fff)}
.hrErrIn h2{font-family:var(--serif,"Fraunces",Georgia,serif);font-weight:400;font-size:22px;letter-spacing:-.015em;margin:0 0 8px;color:var(--ink,#141413)}
.hrErrIn p{margin:0 0 18px;color:var(--muted,#666560);line-height:1.55;font-size:15px}
`;

/**
 * Catches render errors below it.
 * - Default: a calm full-screen fallback with a reload button.
 * - `inline`: a small card in place of the broken section, with "Try again".
 *   Pass `resetKey` (for example the active tab) and the card clears itself when that changes.
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
        <div className="hrErrIn" role="alert">
          <style>{CSS}</style>
          <h2>This part hit a snag.</h2>
          <p>The rest of Homeroom is fine and nothing you saved is lost. Try again, or switch tabs.</p>
          <button type="button" className="btn" onClick={this.retry}>Try again</button>
        </div>
      );
    }
    return (
      <main className="hrErr" role="alert">
        <style>{CSS}</style>
        <div>
          <h1>Something got tangled.</h1>
          <p>Nothing you saved is lost. Reloading usually sorts it out.</p>
          <button type="button" onClick={() => window.location.reload()}>Reload Homeroom</button>
        </div>
      </main>
    );
  }
}
