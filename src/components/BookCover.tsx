import React, { useEffect, useRef, useState } from 'react';
import { getCachedCoverSync, renderAndCachePdfCover } from '../lib/pdfCoverCache.ts';
import type { Book } from '../types.ts';

const COVER_GRADIENTS = [
  'from-[#17325C] via-[#1E40AF] to-[#0EA5E9]',
  'from-[#0F2342] via-[#1D4ED8] to-[#38BDF8]',
  'from-[#78350F] via-[#B45309] to-[#F59E0B]',
  'from-[#064E3B] via-[#0F766E] to-[#0EA5E9]',
  'from-[#1E1B4B] via-[#3730A3] to-[#0284C7]',
  'from-[#0C4A6E] via-[#0369A1] to-[#38BDF8]',
];

function getGradientForBook(id: string, title: string): string {
  const key = id + title;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return COVER_GRADIENTS[hash % COVER_GRADIENTS.length];
}

interface BookCoverProps {
  book: Book;
  className?: string;
  priority?: boolean;
}

export const BookCover: React.FC<BookCoverProps> = ({
  book,
  className = '',
  priority = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgError, setImgError] = useState(false);
  const [pdfThumb, setPdfThumb] = useState<string | null>(() => {
    if (book.coverUrl) return null;
    return getCachedCoverSync(book.id, book.pdfUrl);
  });
  const [isInView, setIsInView] = useState(priority);

  useEffect(() => {
    setImgError(false);
    if (!book.coverUrl) {
      setPdfThumb(getCachedCoverSync(book.id, book.pdfUrl));
    } else {
      setPdfThumb(null);
    }
  }, [book.id, book.coverUrl, book.pdfUrl]);

  useEffect(() => {
    if (priority || book.coverUrl) {
      setIsInView(true);
      return;
    }
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setIsInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '240px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [priority, book.coverUrl]);

  useEffect(() => {
    if (!isInView || book.coverUrl || !book.pdfUrl || pdfThumb) return;
    let cancelled = false;
    renderAndCachePdfCover(book.id, book.pdfUrl).then((dataUrl) => {
      if (!cancelled && dataUrl) {
        setPdfThumb(dataUrl);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isInView, book.id, book.coverUrl, book.pdfUrl, pdfThumb]);

  const activeImageSrc = book.coverUrl && !imgError ? book.coverUrl : pdfThumb;
  const gradient = getGradientForBook(book.id, book.title);

  return (
    <div
      ref={containerRef}
      className={`relative aspect-[3/4] w-full overflow-hidden bg-slate-100 select-none pixar-book-spine ${className}`}
    >
      {activeImageSrc ? (
        <>
          <img
            src={activeImageSrc}
            alt={`Sampul ${book.title}`}
            referrerPolicy="no-referrer"
            loading={priority ? 'eager' : 'lazy'}
            onError={() => {
              if (book.coverUrl && !imgError) {
                setImgError(true);
              } else {
                setPdfThumb(null);
              }
            }}
            className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.04]"
          />
          {/* Subtle 3D hardcover spine crease & studio specular sheen */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-slate-900/10"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-1.5 w-px bg-black/10"
          />
        </>
      ) : (
        <div
          className={`relative h-full w-full bg-gradient-to-br ${gradient} p-3.5 flex flex-col justify-between text-white`}
        >
          {/* Warm 3D studio rim light & spine indentation */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_12%,rgba(255,255,255,0.28),transparent_50%)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-2 w-px bg-white/20"
          />
          <div className="relative flex items-center justify-between text-[10px] font-mono tracking-wider text-amber-100/95">
            <span className="tabular-nums">{book.code}</span>
            <span className="tabular-nums">{book.year}</span>
          </div>
          <div className="relative my-auto py-2 pl-1">
            <p className="font-serif text-sm sm:text-base font-semibold leading-snug line-clamp-3 text-white drop-shadow-[0_2px_4px_rgba(15,23,42,0.4)]">
              {book.title}
            </p>
          </div>
          <div className="relative border-t border-white/20 pt-2 pl-1">
            <p className="text-[11px] text-slate-100 truncate font-medium">{book.author}</p>
            <p className="text-[10px] text-sky-100/90 truncate">{book.category}</p>
          </div>
        </div>
      )}
    </div>
  );
};
