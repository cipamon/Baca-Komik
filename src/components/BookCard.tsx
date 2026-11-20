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
    <article className="group bg-white border border-slate-200/90 rounded-xl overflow-hidden flex flex-col transition-transform duration-150 hover:-translate-y-0.5">
      <div className="relative">
        <button
          type="button"
          onClick={() => onOpenDetail(book)}
          className="block w-full text-left cursor-pointer focus-visible:outline-none"
          aria-label={`Lihat detail ${book.title}`}
        >
          <BookCover book={book} priority={priority} />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(book.id);
          }}
          aria-label={isFavorite ? `Hapus ${book.title} dari favorit` : `Simpan ${book.title} ke favorit`}
          className={`absolute top-2 right-2 w-8 h-8 rounded-lg flex items-center justify-center backdrop-blur-sm border transition-colors cursor-pointer ${
            isFavorite
              ? 'bg-rose-500 text-white border-rose-500'
              : 'bg-white/90 text-slate-600 border-slate-200/80 hover:text-rose-600'
          }`}
        >
          <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
        </button>
      </div>

      <div className="p-2.5 sm:p-3 flex-1 flex flex-col">
        <h3 className="text-[13px] font-semibold text-slate-900 leading-snug line-clamp-2 min-h-[2.25rem]">
          {book.title}
        </h3>
        <p className="text-xs text-slate-600 truncate mt-1">{book.author}</p>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1 truncate">
          <span className="truncate">{book.category}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums shrink-0">{book.year}</span>
        </div>

        <div className="mt-auto pt-3 grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => onOpenDetail(book)}
            className="py-1.5 px-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            Detail
          </button>
          <button
            type="button"
            onClick={() => onReadBook(book)}
            className="py-1.5 px-2 text-xs font-medium text-white bg-[#0F2342] hover:bg-[#17325C] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            Baca
          </button>
        </div>
      </div>
    </article>
  );
};
