import { Heart } from 'lucide-react';
import React from 'react';
import type { Book } from '../types.ts';
import { BookCover } from './BookCover.tsx';

interface BookCardProps {
  book: Book;
  isFavorite: boolean;
  onToggleFavorite: (bookId: string) => void;
  onOpenDetail: (book: Book) => void;
  onReadBook: (book: Book) => void;
  priority?: boolean;
}

export const BookCard: React.FC<BookCardProps> = ({
  book,
  isFavorite,
  onToggleFavorite,
  onOpenDetail,
  onReadBook,
  priority = false,
}) => {
  return (
    <article className="group pixar-card pixar-card-interactive rounded-2xl overflow-hidden flex flex-col p-2">
      <div className="relative rounded-xl overflow-hidden shadow-[0_6px_14px_-6px_rgba(15,35,66,0.28)]">
        <button
          type="button"
          onClick={() => onOpenDetail(book)}
          className="block w-full text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0284C7] rounded-xl"
          aria-label={`Lihat detail ${book.title}`}
        >
          <BookCover book={book} priority={priority} className="rounded-xl" />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(book.id);
          }}
          aria-label={isFavorite ? `Hapus ${book.title} dari favorit` : `Simpan ${book.title} ke favorit`}
          className={`absolute top-2 right-2 w-8 h-8 rounded-xl flex items-center justify-center transition-transform duration-150 active:scale-90 hover:scale-105 cursor-pointer ${
            isFavorite
              ? 'bg-gradient-to-b from-rose-400 to-rose-600 text-white shadow-[inset_0_1.5px_0_rgba(255,255,255,0.45),0_3px_0_#be123c,0_6px_12px_rgba(225,29,72,0.35)]'
              : 'bg-white/92 text-slate-600 hover:text-rose-600 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.95),0_2px_0_rgba(203,213,225,0.9),0_4px_10px_rgba(15,35,66,0.16)]'
          }`}
        >
          <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
        </button>
      </div>

      <div className="px-1 pt-2.5 pb-1 flex-1 flex flex-col">
        <h3 className="text-[13px] font-semibold text-[#0F2342] leading-snug line-clamp-2 min-h-[2.25rem]">
          {book.title}
        </h3>
        <p className="text-xs text-slate-600 truncate mt-1">{book.author}</p>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1 truncate">
          <span className="truncate">{book.category}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums shrink-0">{book.year}</span>
        </div>

        <div className="mt-auto pt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onOpenDetail(book)}
            className="py-1.5 px-2 text-xs font-semibold rounded-xl pixar-btn-soft whitespace-nowrap cursor-pointer"
          >
            Detail
          </button>
          <button
            type="button"
            onClick={() => onReadBook(book)}
            className="py-1.5 px-2 text-xs font-semibold rounded-xl pixar-btn-navy whitespace-nowrap cursor-pointer"
          >
            Baca
          </button>
        </div>
      </div>
    </article>
  );
};
