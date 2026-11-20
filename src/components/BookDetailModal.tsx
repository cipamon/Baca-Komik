import { BookOpen, Download, Heart, Lock, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { downloadPdfWithProgress, prewarmPdf } from '../lib/pdfUtils.ts';
import type { Book } from '../types.ts';
import { BookCover } from './BookCover.tsx';

interface BookDetailModalProps {
  book: Book;
  isFavorite: boolean;
  allowDownload: boolean;
  readCount: number;
  downloadCount: number;
  onClose: () => void;
  onToggleFavorite: (bookId: string) => void;
  onReadBook: (book: Book) => void;
  onDownloadComplete: (bookId: string) => void;
  onRequireLogin: () => void;
}

export const BookDetailModal: React.FC<BookDetailModalProps> = ({
  book,
  isFavorite,
  allowDownload,
  readCount,
  downloadCount,
  onClose,
  onToggleFavorite,
  onReadBook,
  onDownloadComplete,
  onRequireLogin,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    prewarmPdf(book.pdfUrl);
  }, [book.pdfUrl]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleDownload = async () => {
    if (!allowDownload) {
      onRequireLogin();
      return;
    }
    setDownloading(true);
    setDownloadPercent(0);
    setDownloadError('');
    try {
      await downloadPdfWithProgress(book.pdfUrl, book.title, (pct) => {
        setDownloadPercent(pct);
      });
      onDownloadComplete(book.id);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Gagal mengunduh PDF.');
    } finally {
      setTimeout(() => {
        setDownloading(false);
      }, 600);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0F2342]/55 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-book-title"
    >
      <div
        className="pixar-modal rounded-3xl max-w-3xl w-full overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/70 bg-white/60">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
            <span className="font-semibold text-[#0F2342]">{book.code}</span>
            <span aria-hidden="true">·</span>
            <span className="font-sans text-slate-600">{book.category}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup detail buku"
            className="w-8 h-8 rounded-xl pixar-btn-soft flex items-center justify-center text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 sm:p-7 grid grid-cols-1 sm:grid-cols-12 gap-6 items-start">
          <div className="sm:col-span-4 max-w-[220px] mx-auto sm:max-w-none w-full">
            <div className="p-2 rounded-2xl pixar-surface-inset">
              <BookCover book={book} priority className="rounded-xl" />
            </div>
          </div>

          <div className="sm:col-span-8 flex flex-col">
            <h2
              id="detail-book-title"
              className="font-serif text-2xl sm:text-3xl font-semibold text-[#0F2342] leading-tight text-balance"
            >
              {book.title}
            </h2>
            <p className="text-sm font-medium text-[#0284C7] mt-1.5">{book.author}</p>

            <p className="text-sm text-slate-600 leading-relaxed mt-3.5">
              {book.description ||
                'Koleksi komik digital dari perpustakaan Baca Komik siap dibaca langsung secara daring maupun diunduh untuk dibaca luring.'}
            </p>

            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 mt-5 p-4 rounded-2xl pixar-surface-inset text-xs">
              <div>
                <dt className="text-slate-500">Tahun Terbit</dt>
                <dd className="text-[#0F2342] font-semibold tabular-nums mt-0.5">{book.year}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Penerbit</dt>
                <dd className="text-[#0F2342] font-semibold truncate mt-0.5">
                  {book.publisher || 'Baca Komik'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Bahasa</dt>
                <dd className="text-[#0F2342] font-semibold mt-0.5">
                  {book.language || 'Indonesia'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Halaman</dt>
                <dd className="text-[#0F2342] font-semibold tabular-nums mt-0.5">
                  {book.pages ? `${book.pages} hal.` : 'Multi-halaman'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">ISBN</dt>
                <dd className="text-[#0F2342] font-mono font-semibold tabular-nums truncate mt-0.5">
                  {book.isbn || '-'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Aktivitas</dt>
                <dd className="text-[#0F2342] font-semibold tabular-nums mt-0.5">
                  {readCount} dibaca · {downloadCount} unduh
                </dd>
              </div>
            </dl>

            {downloading && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
                  <span>Mengunduh berkas PDF...</span>
                  <span className="font-mono font-semibold tabular-nums">{downloadPercent}%</span>
                </div>
                <div className="w-full h-2.5 pixar-surface-inset rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-[#0284C7] to-[#38BDF8] rounded-full transition-all duration-150"
                    style={{ width: `${downloadPercent}%` }}
                  />
                </div>
              </div>
            )}

            {downloadError && (
              <p className="mt-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5">
                {downloadError}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onReadBook(book)}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl pixar-btn-navy whitespace-nowrap cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-amber-200" />
                <span>Baca Sekarang</span>
              </button>

              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl pixar-btn-soft disabled:opacity-60 whitespace-nowrap cursor-pointer"
              >
                {allowDownload ? (
                  <Download className="w-4 h-4 text-[#0284C7]" />
                ) : (
                  <Lock className="w-4 h-4 text-slate-500" />
                )}
                <span>{allowDownload ? 'Download PDF' : 'Masuk untuk Unduh'}</span>
              </button>

              <button
                type="button"
                onClick={() => onToggleFavorite(book.id)}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                  isFavorite
                    ? 'bg-gradient-to-b from-rose-400 to-rose-600 text-white shadow-[inset_0_1.5px_0_rgba(255,255,255,0.4),0_3px_0_#be123c]'
                    : 'pixar-btn-soft text-slate-700'
                }`}
              >
                <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : 'text-rose-500'}`} />
                <span>{isFavorite ? 'Tersimpan' : 'Favorit'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
