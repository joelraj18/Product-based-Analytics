import React from 'react';
import { AlertCircle } from 'lucide-react';

// Keeps one failing module from blanking the whole app.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="max-w-xl mx-auto mt-10 bg-white border border-rose-200 rounded-xl p-6 text-slate-700">
        <div className="flex items-center gap-2 font-bold text-rose-700 mb-2"><AlertCircle size={18} /> This module hit an error</div>
        <p className="text-sm mb-3">{String(this.state.error.message || this.state.error)}</p>
        <p className="text-xs text-slate-500">Your data is safe<br />Check recently imported files or reset this screen’s inputs, then try again<br />Settings → Download backup keeps a copy of everything</p>
        <button type="button" onClick={() => this.setState({ error: null })} className="mt-4 px-3 py-1.5 text-sm rounded-lg bg-slate-800 text-white">Retry</button>
      </div>
    );
  }
}
