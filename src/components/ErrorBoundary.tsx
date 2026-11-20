import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let displayMsg = error.message || 'Terjadi kesalahan pada aplikasi.';
    try {
      const parsed = JSON.parse(displayMsg) as { error?: string; operationType?: string; path?: string };
      if (parsed && parsed.error) {
        displayMsg = `Kesalahan akses data (${parsed.operationType || 'operasi'} di ${parsed.path || 'sistem'}): ${parsed.error}`;
      }
    } catch {
      // Keep plain error message
    }
    return { hasError: true, message: displayMsg };
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-8">
            <h1 className="font-serif text-2xl font-semibold text-[#0F2342] mb-2">
              Terjadi Gangguan Sistem
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 text-sm font-medium text-white bg-[#0F2342] rounded-lg hover:bg-[#17325C] transition-colors cursor-pointer"
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
