import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Maximize2,
  Moon,
  Sun,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  downloadPdfWithProgress,
  getGoogleDrivePreviewUrl,
  getGoogleViewUrl,
  getProxiedPdfUrl,
  isGoogleDriveUrl,
  isLocalApiUrl,
} from '../lib/pdfUtils.ts';
import type { Book } from '../types.ts';

interface PdfReaderModalProps {
  book: Book;
  allowDownload: boolean;
  onClose: () => void;
  onDownloadComplete: (bookId: string) => void;
  onRequireLogin: () => void;
}

type ReaderMode = 'google' | 'fast';

const DARK_MODE_STORAGE_KEY = 'baca_komik_reader_dark';

interface LazyPageProps {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  containerWidth: number;
  zoomMultiplier: number;
  fitWidth: boolean;
  darkMode: boolean;
  onVisible: (pageNum: number) => void;
}

const PdfLazyPage: React.FC<LazyPageProps> = ({
  pdfDoc,
  pageNumber,
  containerWidth,
  zoomMultiplier,
  fitWidth,
  darkMode,
  onVisible,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shouldRender, setShouldRender] = useState(pageNumber <= 2);
  const [renderedSize, setRenderedSize] = useState<{ w: number; h: number }>({
    w: Math.min(780, Math.max(280, containerWidth - 32)),
    h: Math.round(Math.min(780, Math.max(280, containerWidth - 32)) * 1.414),
  });

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShouldRender(true);
      return;
    }

    const renderObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShouldRender(true);
        }
      },
      { rootMargin: '600px 0px' }
    );
    renderObserver.observe(el);

    const activeObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.35) {
            onVisible(pageNumber);
          }
        }
      },
      { threshold: [0.35, 0.65] }
    );
    activeObserver.observe(el);

    return () => {
      renderObserver.disconnect();
      activeObserver.disconnect();
    };
  }, [pageNumber, onVisible]);

  useEffect(() => {
    if (!shouldRender) return;
    let cancelled = false;
    let renderTask: pdfjsLib.RenderTask | null = null;

    async function renderPage() {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled) return;
        const baseViewport = page.getViewport({ scale: 1 });
        const maxAvailWidth = Math.max(260, containerWidth - 32);
        const targetCssWidth = fitWidth
          ? Math.min(980, maxAvailWidth)
          : Math.min(1400, baseViewport.width * zoomMultiplier);
        const cssScale = targetCssWidth / Math.max(1, baseViewport.width);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        const cssViewport = page.getViewport({ scale: cssScale });
        const renderViewport = page.getViewport({ scale: cssScale * dpr });

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        canvas.width = Math.round(renderViewport.width);
        canvas.height = Math.round(renderViewport.height);
        canvas.style.width = `${Math.round(cssViewport.width)}px`;
        canvas.style.height = `${Math.round(cssViewport.height)}px`;

        setRenderedSize({
          w: Math.round(cssViewport.width),
          h: Math.round(cssViewport.height),
        });

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        renderTask = page.render({
          canvasContext: ctx,
          viewport: renderViewport,
          canvas,
        });
        await renderTask.promise;
      } catch {
        // Ignore cancelled render task
      }
    }

    renderPage();

    return () => {
      cancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          // Ignore cancel errors
        }
      }
    };
  }, [shouldRender, pdfDoc, pageNumber, containerWidth, zoomMultiplier, fitWidth]);

  return (
    <div
      ref={wrapperRef}
      id={`pdf-page-${pageNumber}`}
      className="mx-auto flex flex-col items-center mb-4"
      style={{ minHeight: renderedSize.h }}
    >
      <div
        className={`rounded-lg overflow-hidden shadow-sm border ${
          darkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'
        }`}
      >
        <canvas
          ref={canvasRef}
          className={`block transition-all duration-200 ${darkMode ? 'reader-dark-page' : ''}`}
          style={{ width: renderedSize.w, height: renderedSize.h }}
        />
      </div>
      <span
        className={`mt-1.5 text-[11px] font-mono tabular-nums ${
          darkMode ? 'text-slate-400' : 'text-slate-500'
        }`}
      >
        Halaman {pageNumber}
      </span>
    </div>
  );
};

export const PdfReaderModal: React.FC<PdfReaderModalProps> = ({
  book,
  allowDownload,
  onClose,
  onDownloadComplete,
  onRequireLogin,
}) => {
  const isLocal = useMemo(() => isLocalApiUrl(book.pdfUrl), [book.pdfUrl]);
  const isDrive = useMemo(() => isGoogleDriveUrl(book.pdfUrl), [book.pdfUrl]);

  // External PDFs prefer Google View / Drive Preview; local server PDFs default straight to Mode Cepat
  const [mode, setMode] = useState<ReaderMode>(() => (isLocal ? 'fast' : 'google'));
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DARK_MODE_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Google View state + 4-second slow prompt
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [showSlowBanner, setShowSlowBanner] = useState(false);

  // Fast Mode (PDF.js) state
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(820);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [fitWidth, setFitWidth] = useState(true);
  const [zoomMultiplier, setZoomMultiplier] = useState(1);
  const [loadPercent, setLoadPercent] = useState(0);
  const [fastLoading, setFastLoading] = useState(false);
  const [fastError, setFastError] = useState('');
  const [recoveryNotice, setRecoveryNotice] = useState('');
  const [downloading, setDownloading] = useState(false);

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(DARK_MODE_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Measure reader container width for automatic Fit-to-Width ("Pas")
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const updateWidth = () => {
      setContainerWidth(el.clientWidth || 800);
    };
    updateWidth();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(updateWidth);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [mode]);

  // Check if external PDF requires proxy recovery (e.g. HTTP 403/404 -> HTTPS/Wayback) & monitor 4s Google View timer
  useEffect(() => {
    if (mode !== 'google' || isLocal) {
      setShowSlowBanner(false);
      return;
    }

    setIframeLoaded(false);
    setShowSlowBanner(false);

    const slowTimer = setTimeout(() => {
      setShowSlowBanner(true);
    }, 4000);

    // Background check for blocked/recovered external PDFs (non-Drive)
    if (!isDrive) {
      const proxied = getProxiedPdfUrl(book.pdfUrl);
      fetch(proxied, { method: 'HEAD' })
        .then((res) => {
          const rec = res.headers.get('X-Recovery-Source');
          if (rec && rec !== 'original') {
            setRecoveryNotice(
              rec === 'wayback'
                ? 'Sumber asli diblokir — dokumen dipulihkan via arsip Wayback Machine di Mode Cepat.'
                : 'Tautan dipulihkan via HTTPS di Mode Cepat.'
            );
            setMode('fast');
          } else if (!res.ok) {
            setShowSlowBanner(true);
          }
        })
        .catch(() => {
          // Keep Google View or allow user switch
        });
    }

    return () => clearTimeout(slowTimer);
  }, [mode, isLocal, isDrive, book.pdfUrl]);

  // Load PDF document in Mode Cepat (Proxy)
  useEffect(() => {
    if (mode !== 'fast') return;
    let cancelled = false;
    let activeTask: pdfjsLib.PDFDocumentLoadingTask | null = null;
    let loadedDoc: PDFDocumentProxy | null = null;

    async function loadFastPdf() {
      setFastLoading(true);
      setFastError('');
      setLoadPercent(5);
      setPdfDoc(null);
      setNumPages(0);
      setCurrentPage(1);
      setPageInput('1');

      try {
        const proxiedUrl = getProxiedPdfUrl(book.pdfUrl);
        activeTask = pdfjsLib.getDocument({
          url: proxiedUrl,
          rangeChunkSize: 65536,
          disableAutoFetch: false,
          disableStream: false,
        });

        activeTask.onProgress = (progress: { loaded: number; total?: number }) => {
          if (cancelled) return;
          if (progress.total && progress.total > 0) {
            setLoadPercent(Math.min(99, Math.round((progress.loaded / progress.total) * 100)));
          } else {
            setLoadPercent((p) => Math.min(90, Math.max(p, 25)));
          }
        };

        const doc = await activeTask.promise;
        if (cancelled) {
          await doc.cleanup();
          return;
        }
        loadedDoc = doc;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setLoadPercent(100);
      } catch (err) {
        if (!cancelled) {
          setFastError(
            err instanceof Error
              ? err.message
              : 'Dokumen PDF gagal dimuat di Mode Cepat.'
          );
        }
      } finally {
        if (!cancelled) {
          setFastLoading(false);
        }
      }
    }

    loadFastPdf();

    return () => {
      cancelled = true;
      if (activeTask) {
        try {
          activeTask.destroy();
        } catch {
          // Ignore destroy
        }
      }
      if (loadedDoc) {
        try {
          loadedDoc.cleanup();
        } catch {
          // Ignore cleanup
        }
      }
    };
  }, [mode, book.pdfUrl]);

  const handleVisiblePage = useCallback((pageNum: number) => {
    setCurrentPage(pageNum);
    setPageInput(String(pageNum));
  }, []);

  const jumpToPage = (target: number) => {
    if (!numPages) return;
    const clamped = Math.max(1, Math.min(numPages, target));
    setCurrentPage(clamped);
    setPageInput(String(clamped));
    const el = document.getElementById(`pdf-page-${clamped}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleDownload = async () => {
    if (!allowDownload) {
      onRequireLogin();
      return;
    }
    setDownloading(true);
    try {
      await downloadPdfWithProgress(book.pdfUrl, book.title);
      onDownloadComplete(book.id);
    } finally {
      setDownloading(false);
    }
  };

  const googleEmbedUrl = useMemo(() => {
    if (isDrive) {
      return getGoogleDrivePreviewUrl(book.pdfUrl) || getGoogleViewUrl(book.pdfUrl);
    }
    return getGoogleViewUrl(book.pdfUrl);
  }, [book.pdfUrl, isDrive]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col ${
        darkMode ? 'bg-[#0B1120] text-slate-100' : 'bg-slate-100 text-slate-900'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={`Pembaca: ${book.title}`}
    >
      {/* Reader Top Toolbar */}
      <div
        className={`shrink-0 h-14 px-3 sm:px-5 border-b flex items-center justify-between gap-3 ${
          darkMode
            ? 'bg-[#0F172A] border-slate-800 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              darkMode
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-100'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Tutup</span>
          </button>

          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate">{book.title}</h2>
            <p className={`text-[11px] truncate ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {book.author}
            </p>
          </div>
        </div>

        {/* Mode Switcher (Google View vs Mode Cepat) */}
        <div className="flex items-center gap-2 shrink-0">
          {!isLocal && (
            <div
              className={`hidden sm:flex items-center p-0.5 rounded-lg border ${
                darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-200'
              }`}
            >
              <button
                type="button"
                onClick={() => setMode('google')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'google'
                    ? darkMode
                      ? 'bg-slate-700 text-white'
                      : 'bg-white text-[#0F2342] shadow-xs'
                    : darkMode
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isDrive ? 'Drive Preview' : 'Google View'}
              </button>
              <button
                type="button"
                onClick={() => setMode('fast')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'fast'
                    ? darkMode
                      ? 'bg-sky-600 text-white'
                      : 'bg-[#0F2342] text-white'
                    : darkMode
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Zap className="w-3 h-3" />
                <span>Mode Cepat</span>
              </button>
            </div>
          )}

          {/* Fast Mode Zoom & Page Controls */}
          {mode === 'fast' && numPages > 0 && (
            <div className="hidden md:flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setFitWidth(false);
                  setZoomMultiplier((z) => Math.max(0.5, Number((z - 0.15).toFixed(2))));
                }}
                aria-label="Perkecil"
                className={`p-1.5 rounded-md cursor-pointer ${
                  darkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                }`}
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setFitWidth(true)}
                className={`px-2 py-1 text-xs font-medium rounded-md cursor-pointer ${
                  fitWidth
                    ? 'bg-sky-600 text-white'
                    : darkMode
                    ? 'bg-slate-800 text-slate-300'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                Pas
              </button>
              <button
                type="button"
                onClick={() => {
                  setFitWidth(false);
                  setZoomMultiplier((z) => Math.min(2.2, Number((z + 0.15).toFixed(2))));
                }}
                aria-label="Perbesar"
                className={`p-1.5 rounded-md cursor-pointer ${
                  darkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                }`}
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Dark Mode Toggle Button */}
          <button
            type="button"
            onClick={toggleDarkMode}
            title={darkMode ? 'Nonaktifkan Mode Gelap' : 'Aktifkan Mode Gelap'}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap cursor-pointer ${
              darkMode
                ? 'bg-slate-800 border-slate-700 text-amber-300 hover:bg-slate-700'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span className="hidden lg:inline">{darkMode ? 'Mode Terang' : 'Dark Mode'}</span>
          </button>

          {/* Download Button */}
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#0284C7] hover:bg-sky-700 text-white transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{downloading ? 'Mengunduh...' : 'Download'}</span>
          </button>
        </div>
      </div>

      {/* Mobile Mode Switcher Row */}
      {!isLocal && (
        <div
          className={`sm:hidden shrink-0 px-3 py-2 border-b flex items-center justify-between gap-2 ${
            darkMode ? 'bg-[#0F172A] border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <span className="text-xs text-slate-500">Mode Pembaca:</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMode('google')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md ${
                mode === 'google'
                  ? 'bg-[#0F2342] text-white'
                  : darkMode
                  ? 'bg-slate-800 text-slate-300'
                  : 'bg-white text-slate-700 border border-slate-200'
              }`}
            >
              {isDrive ? 'Drive' : 'Google View'}
            </button>
            <button
              type="button"
              onClick={() => setMode('fast')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md ${
                mode === 'fast'
                  ? 'bg-[#0284C7] text-white'
                  : darkMode
                  ? 'bg-slate-800 text-slate-300'
                  : 'bg-white text-slate-700 border border-slate-200'
              }`}
            >
              Mode Cepat
            </button>
          </div>
        </div>
      )}

      {/* 4-Second Slow Google View Banner */}
      {mode === 'google' && showSlowBanner && !iframeLoaded && (
        <div className="shrink-0 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-900 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span>
            Google View membutuhkan waktu lebih lama dari biasanya untuk memuat dokumen ini.
          </span>
          <button
            type="button"
            onClick={() => setMode('fast')}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#0F2342] text-white font-medium hover:bg-[#17325C] cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Beralih ke Mode Cepat (Proxy)</span>
          </button>
        </div>
      )}

      {/* Recovery Notice Banner */}
      {recoveryNotice && (
        <div className="shrink-0 px-4 py-2 bg-sky-50 border-b border-sky-200 text-sky-900 flex items-center justify-between text-xs">
          <span>{recoveryNotice}</span>
          <button
            type="button"
            onClick={() => setRecoveryNotice('')}
            className="underline font-medium cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Main Reader Viewport */}
      {mode === 'google' ? (
        <div className="relative flex-1 w-full h-full">
          {!iframeLoaded && (
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none ${
                darkMode ? 'bg-[#0B1120] text-slate-300' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <div className="w-8 h-8 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium">Memuat pratinjau dokumen...</p>
            </div>
          )}
          <iframe
            src={googleEmbedUrl}
            title={book.title}
            onLoad={() => setIframeLoaded(true)}
            className={`w-full h-full border-0 transition-all duration-200 ${
              darkMode ? 'reader-dark-page' : ''
            }`}
            allow="autoplay"
          />
          <a
            href={book.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-4 right-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/90 text-slate-800 border border-slate-200 shadow-sm hover:bg-white"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Buka Sumber Asli</span>
          </a>
        </div>
      ) : (
        <div className="relative flex-1 flex flex-col min-h-0">
          {/* Fast Mode Loading Progress Bar */}
          {fastLoading && (
            <div
              className={`shrink-0 px-4 py-2.5 border-b ${
                darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="max-w-xl mx-auto">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span>Mengunduh & menyiapkan halaman PDF...</span>
                  <span className="font-mono tabular-nums">{loadPercent}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#0284C7] transition-all duration-150"
                    style={{ width: `${loadPercent}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Scrollable Pages Area */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto px-3 sm:px-6 py-5 custom-scrollbar"
          >
            {fastError ? (
              <div className="max-w-md mx-auto my-12 bg-white text-slate-900 border border-slate-200 rounded-xl p-6 text-center">
                <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-3" />
                <h3 className="font-serif text-lg font-semibold mb-1">Gagal Memuat PDF</h3>
                <p className="text-xs text-slate-600 mb-4">{fastError}</p>
                {!isLocal && (
                  <button
                    type="button"
                    onClick={() => setMode('google')}
                    className="px-4 py-2 text-xs font-medium text-white bg-[#0F2342] rounded-lg cursor-pointer"
                  >
                    Coba Google View
                  </button>
                )}
              </div>
            ) : pdfDoc ? (
              <div className="max-w-5xl mx-auto">
                {Array.from({ length: numPages }, (_, idx) => idx + 1).map((pageNum) => (
                  <PdfLazyPage
                    key={pageNum}
                    pdfDoc={pdfDoc}
                    pageNumber={pageNum}
                    containerWidth={containerWidth}
                    zoomMultiplier={zoomMultiplier}
                    fitWidth={fitWidth}
                    darkMode={darkMode}
                    onVisible={handleVisiblePage}
                  />
                ))}
              </div>
            ) : null}
          </div>

          {/* Responsive Page Navigation Footer */}
          {numPages > 0 && (
            <div
              className={`shrink-0 h-12 px-4 border-t flex items-center justify-between gap-4 text-xs ${
                darkMode
                  ? 'bg-[#0F172A] border-slate-800 text-slate-200'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => jumpToPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  aria-label="Halaman sebelumnya"
                  className={`p-1.5 rounded-md disabled:opacity-40 cursor-pointer ${
                    darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const parsed = parseInt(pageInput, 10);
                    if (!Number.isNaN(parsed)) jumpToPage(parsed);
                  }}
                  className="flex items-center gap-1.5"
                >
                  <span>Hal.</span>
                  <input
                    type="number"
                    min={1}
                    max={numPages}
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    className={`w-12 px-1.5 py-0.5 text-center font-mono tabular-nums rounded border text-xs ${
                      darkMode
                        ? 'bg-slate-900 border-slate-700 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                  <span className="font-mono tabular-nums">/ {numPages}</span>
                </form>
                <button
                  type="button"
                  onClick={() => jumpToPage(currentPage + 1)}
                  disabled={currentPage >= numPages}
                  aria-label="Halaman berikutnya"
                  className={`p-1.5 rounded-md disabled:opacity-40 cursor-pointer ${
                    darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                  }`}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2 md:hidden">
                <button
                  type="button"
                  onClick={() => setFitWidth(true)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-sky-600 text-white text-[11px] font-medium"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>Pas</span>
                </button>
              </div>

              <span className="hidden sm:inline text-[11px] text-slate-400">
                Gulir vertikal · Rendering hemat memori
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
