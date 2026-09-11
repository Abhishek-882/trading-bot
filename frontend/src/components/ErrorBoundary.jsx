import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[Terminal ErrorBoundary]:', error, errorInfo);
  }

  handleReset = () => {
    try {
      localStorage.removeItem('gmgn-bot-store');
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0b0e] text-white flex items-center justify-center p-6 font-mono">
          <div className="max-w-md w-full bg-[#12141c] border border-rose-500/40 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-base font-bold text-white tracking-wide mb-2">Terminal Runtime Recovery</h2>
            <p className="text-xs text-gray-400 mb-3">A client component encountered an error:</p>
            <pre className="bg-[#0b0c10] border border-gray-800 rounded-lg p-3 text-[11px] text-rose-300 font-mono overflow-x-auto mb-5 max-h-36">
              {this.state.error?.message || String(this.state.error)}
            </pre>
            <div className="flex items-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 py-2 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-[#090d14] font-bold text-xs transition-colors"
              >
                Reload
              </button>
              <button
                onClick={this.handleReset}
                className="py-2 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs transition-colors"
              >
                Reset Cache
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
