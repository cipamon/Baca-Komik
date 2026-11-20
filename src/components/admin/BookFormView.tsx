import { Sparkles } from 'lucide-react';
import React, { useState } from 'react';
import { auth } from '../../firebase.ts';
import type { Book, Category } from '../../types.ts';

interface BookFormViewProps {
  initialBook?: Book | null;
  categories: Category[];
  onSave: (bookData: Partial<Book>, existing?: Book | null) => Promise<void>;
  onCancel?: () => void;
}

export const BookFormView: React.FC<BookFormViewProps> = ({
  initialBook,
  categories,
  onSave,
  onCancel,
}) => {
  const [code, setCode] = useState(
    initialBook?.code || `BK-${String(Math.floor(100 + Math.random() * 900))}`
  );
  const [title, setTitle] = useState(initialBook?.title || '');
  const [author, setAuthor] = useState(initialBook?.author || '');
  const [category, setCategory] = useState(
    initialBook?.category || categories[0]?.name || 'Komik Nusantara'
  );
  const [year, setYear] = useState(String(initialBook?.year || new Date().getFullYear()));
  const [isbn, setIsbn] = useState(initialBook?.isbn || '');
  const [publisher, setPublisher] = useState(initialBook?.publisher || '');
  const [language, setLanguage] = useState(initialBook?.language || 'Indonesia');
  const [pages, setPages] = useState(initialBook?.pages ? String(initialBook.pages) : '48');
  const [pdfUrl, setPdfUrl] = useState(initialBook?.pdfUrl || '');
  const [coverUrl, setCoverUrl] = useState(initialBook?.coverUrl || '');
  const [description, setDescription] = useState(initialBook?.description || '');
  const [status, setStatus] = useState<'published' | 'hidden'>(
    initialBook?.status || 'published'
  );
  const [recommended, setRecommended] = useState(Boolean(initialBook?.recommended));

  const [autoFilling, setAutoFilling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleAutoFill = async () => {
    if (!title.trim() && !author.trim() && !isbn.trim() && !pdfUrl.trim()) {
      setMessage({
        type: 'err',
        text: 'Isi minimal satu dari Judul, Penulis, ISBN, atau URL PDF untuk Auto-Fill.',
      });
      return;
    }
    setAutoFilling(true);
    setMessage(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/admin/autofill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ title, author, isbn, pdfUrl }),
      });
      const data = (await res.json()) as {
        error?: string;
        suggestion?: {
          title?: string;
          author?: string;
          category?: string;
          year?: number;
          publisher?: string;
          language?: string;
          pages?: number;
          description?: string;
        };
      };
      if (!res.ok || !data.suggestion) {
        setMessage({ type: 'err', text: data.error || 'Gagal menjalankan Auto-Fill.' });
        return;
      }
      const s = data.suggestion;
      if (s.title && !title.trim()) setTitle(s.title);
      else if (s.title && pdfUrl && !title.trim()) setTitle(s.title);
      if (s.author && !author.trim()) setAuthor(s.author);
      if (s.category) setCategory(s.category);
      if (s.year) setYear(String(s.year));
      if (s.publisher) setPublisher(s.publisher);
      if (s.language) setLanguage(s.language);
      if (s.pages) setPages(String(s.pages));
      if (s.description) setDescription(s.description);

      setMessage({
        type: 'ok',
        text: 'Metadata berhasil dilengkapi secara otomatis. Silakan tinjau sebelum menyimpan.',
      });
    } catch {
      setMessage({ type: 'err', text: 'Gagal menghubungi layanan Auto-Fill.' });
    } finally {
      setAutoFilling(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !author.trim() || !pdfUrl.trim()) {
      setMessage({ type: 'err', text: 'Judul, Penulis, dan URL PDF wajib diisi.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await onSave(
        {
          id: initialBook?.id,
          code: code.trim(),
          title: title.trim(),
          author: author.trim(),
          category: category.trim() || 'Komik Nusantara',
          year: parseInt(year, 10) || new Date().getFullYear(),
          isbn: isbn.trim(),
          publisher: publisher.trim(),
          language: language.trim() || 'Indonesia',
          pages: parseInt(pages, 10) || 0,
          pdfUrl: pdfUrl.trim(),
          coverUrl: coverUrl.trim(),
          description: description.trim(),
          status,
          recommended,
        },
        initialBook
      );
      if (!initialBook) {
        setTitle('');
        setAuthor('');
        setIsbn('');
        setPublisher('');
        setPdfUrl('');
        setCoverUrl('');
        setDescription('');
        setCode(`BK-${String(Math.floor(100 + Math.random() * 900))}`);
      }
      setMessage({
        type: 'ok',
        text: initialBook ? 'Perubahan buku berhasil disimpan.' : 'Buku baru berhasil ditambahkan ke katalog.',
      });
    } catch (err) {
      setMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal menyimpan data buku.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h2 className="font-serif text-xl font-semibold text-[#0F2342]">
            {initialBook ? 'Edit Data Buku' : 'Tambah Buku Baru'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Kosongkan URL sampul untuk merender halaman pertama PDF secara otomatis.
          </p>
        </div>

        <button
          type="button"
          onClick={handleAutoFill}
          disabled={autoFilling}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#0284C7]" />
          <span>{autoFilling ? 'Mengisi Otomatis...' : 'Bantuan Isi Otomatis (Auto-Fill)'}</span>
        </button>
      </div>

      {message && (
        <div
          className={`mt-4 px-4 py-2.5 text-xs rounded-lg border ${
            message.type === 'ok'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Kode Buku</label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">Judul Komik / Buku *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Pendekar Bambu Runcing"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Penulis *</label>
            <input
              type="text"
              required
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Nama pengarang / ilustrator"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Kategori</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
              {!categories.some((c) => c.name === category) && (
                <option value={category}>{category}</option>
              )}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Tahun Terbit</label>
            <input
              type="number"
              min={1900}
              max={2100}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full px-3 py-2 text-sm tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">ISBN</label>
            <input
              type="text"
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              placeholder="978-602-..."
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Penerbit</label>
            <input
              type="text"
              value={publisher}
              onChange={(e) => setPublisher(e.target.value)}
              placeholder="Nama penerbit"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Bahasa</label>
            <input
              type="text"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Jumlah Halaman</label>
            <input
              type="number"
              min={0}
              max={10000}
              value={pages}
              onChange={(e) => setPages(e.target.value)}
              className="w-full px-3 py-2 text-sm tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">URL File PDF *</label>
            <input
              type="text"
              required
              value={pdfUrl}
              onChange={(e) => setPdfUrl(e.target.value)}
              placeholder="https://... atau link Google Drive / /api/sample-pdf"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              URL Gambar Sampul (Opsional)
            </label>
            <input
              type="text"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="Kosongkan untuk sampul PDF otomatis"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Sinopsis / Deskripsi</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ringkasan cerita atau informasi buku..."
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-6 pt-1">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-700">Status:</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value === 'hidden' ? 'hidden' : 'published')}
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="published">Terbit (Publik)</option>
              <option value="hidden">Disembunyikan</option>
            </select>
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={recommended}
              onChange={(e) => setRecommended(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-[#0284C7]"
            />
            <span>Tampilkan di Rekomendasi Pilihan</span>
          </label>
        </div>

        <div className="pt-3 flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 text-sm font-medium text-white bg-[#0F2342] hover:bg-[#17325C] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
          >
            {saving ? 'Menyimpan...' : initialBook ? 'Simpan Perubahan' : 'Simpan ke Katalog'}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Batal
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
