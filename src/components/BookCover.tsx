import React, { useEffect, useRef, useState } from 'react';
import { getCachedCoverSync, renderAndCachePdfCover } from '../lib/pdfCoverCache.ts';
import type { Book } from '../types.ts';

const COVER_GRADIENTS = [
  'from-[#0F2342] via-[#17325C] to-[#0284C7]',
  'from-[#1E293B] via-[#0F172A] to-[#0369A1]',
  'from-[#172554] via-[#1E3A8A] to-[#0284C7]',
  'from-[#0C4A6E] via-[#075985] to-[#0EA5E9]',
  'from-[#1E1B4B] via-[#312E81] to-[#2563EB]',
  'from-[#134E4A] via-[#115E59] to-[#0284C7]',
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
      className={`relative aspect-[3/4] w-full overflow-hidden bg-slate-100 select-none ${className}`}
    >
      {activeImageSrc ? (
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
          className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <div
          className={`h-full w-full bg-gradient-to-br ${gradient} p-3.5 flex flex-col justify-between text-white`}
        >
          <div className="flex items-center justify-between text-[10px] font-mono tracking-wider text-sky-200/90">
            <span className="tabular-nums">{book.code}</span>
            <span>{book.year}</span>
          </div>
          <div className="my-auto py-2">
            <p className="font-serif text-sm sm:text-base font-semibold leading-snug line-clamp-3 text-white">
              {book.title}
            </p>
          </div>
          <div className="border-t border-white/15 pt-2">
            <p className="text-[11px] text-slate-200 truncate">{book.author}</p>
            <p className="text-[10px] text-sky-200/80 truncate">{book.category}</p>
          </div>
        </div>
      )}
    </div>
  );
};
