import { Download, FileSpreadsheet, Globe, Upload } from 'lucide-react';
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { auth } from '../../firebase.ts';
import type { Book, Category, ScrapePreviewItem } from '../../types.ts';

interface ImportPanelProps {
  categories: Category[];
  onBulkSave: (items: Array<Partial<Book>>) => Promise<void>;
}

export const ImportPanel: React.FC<ImportPanelProps> = ({ categories, onBulkSave }) => {
  const [subMode, setSubMode] = useState<'file' | 'scrape'>('scrape');

  // Web Scrape state
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [scrapeSourceTitle, setScrapeSourceTitle] = useState('');
  const [previewItems, setPreviewItems] = useState<ScrapePreviewItem[]>([]);
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [savingBulk, setSavingBulk] = useState(false);

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scrapeUrl.trim()) return;
    setScraping(true);
    setStatusMsg(null);
    setPreviewItems([]);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/admin/scrape-ebooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ url: scrapeUrl.trim() }),
      });
      const data = (await res.json()) as {
        error?: string;
        sourceTitle?: string;
        items?: Array<Omit<ScrapePreviewItem, 'selected'>>;
      };
      if (!res.ok) {
        setStatusMsg({ type: 'err', text: data.error || 'Gagal memindai halaman web.' });
        return;
      }
      const list = (data.items || []).map((item) => ({
        ...item,
        category: categories[0]?.name || item.category || 'Komik Nusantara',
        selected: true,
      }));
      setScrapeSourceTitle(data.sourceTitle || scrapeUrl);
      setPreviewItems(list);
      if (list.length === 0) {
        setStatusMsg({
          type: 'err',
          text: 'Tidak ditemukan tautan PDF atau Google Drive yang dapat diimpor pada halaman ini.',
        });
      }
    } catch {
      setStatusMsg({ type: 'err', text: 'Gagal menghubungi server pemindai.' });
    } finally {
      setScraping(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatusMsg(null);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      let rows: Array<Record<string, unknown>> = [];

      if (ext === 'json') {
        const text = await file.text();
        const parsed = JSON.parse(text);
        rows = Array.isArray(parsed) ? parsed : [];
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const firstSheet = wb.SheetNames[0];
        if (firstSheet) {
          rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[firstSheet]);
        }
      }

      const mapped: ScrapePreviewItem[] = rows
        .map((r) => {
          const pdfUrl = String(r.pdfUrl || r.pdf_url || r.url || r.link || '').trim();
          const title = String(r.title || r.judul || '').trim();
          if (!title && !pdfUrl) return null;
          return {
            selected: true,
            title: title || 'Komik Impor',
            author: String(r.author || r.penulis || 'Penulis').trim(),
            category: String(r.category || r.kategori || categories[0]?.name || 'Komik Nusantara').trim(),
            year: parseInt(String(r.year || r.tahun || new Date().getFullYear()), 10) || new Date().getFullYear(),
            pdfUrl: pdfUrl || '/api/sample-pdf',
            description: String(r.description || r.deskripsi || '').trim(),
          };
        })
        .filter((x): x is ScrapePreviewItem => x !== null);

      setScrapeSourceTitle(file.name);
      setPreviewItems(mapped);
      if (mapped.length === 0) {
        setStatusMsg({ type: 'err', text: 'Tidak ada baris valid yang ditemukan dalam berkas.' });
      }
    } catch {
      setStatusMsg({ type: 'err', text: 'Format berkas tidak dapat dibaca. Gunakan .xlsx, .csv, atau .json.' });
    }
  };

  const handleSaveSelected = async () => {
    const selected = previewItems.filter((i) => i.selected && i.pdfUrl && i.title);
    if (selected.length === 0) {
      setStatusMsg({ type: 'err', text: 'Pilih minimal satu buku untuk disimpan.' });
      return;
    }
    setSavingBulk(true);
    setStatusMsg(null);
    try {
      const payload: Array<Partial<Book>> = selected.map((item, idx) => ({
        code: `IMP-${String(Date.now()).slice(-3)}${idx + 1}`,
        title: item.title,
        author: item.author,
        category: item.category,
        year: item.year,
        pdfUrl: item.pdfUrl,
        description: item.description,
        status: 'published',
        recommended: false,
      }));
      await onBulkSave(payload);
      setStatusMsg({
        type: 'ok',
        text: `${selected.length} buku berhasil disimpan ke katalog Firestore.`,
      });
      setPreviewItems([]);
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal menyimpan impor massal.',
      });
    } finally {
      setSavingBulk(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="font-serif text-xl font-semibold text-[#0F2342]">Import Data Katalog</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Impor massal dari berkas Excel/CSV/JSON atau pindai tautan PDF dari halaman web eksternal.
            </p>
          </div>
          <div className="flex items-center p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setSubMode('scrape')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                subMode === 'scrape' ? 'bg-white text-[#0F2342] shadow-xs' : 'text-slate-600'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Scrape Halaman Web</span>
            </button>
            <button
              type="button"
              onClick={() => setSubMode('file')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                subMode === 'file' ? 'bg-white text-[#0F2342] shadow-xs' : 'text-slate-600'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>File (.xlsx / .csv / .json)</span>
            </button>
          </div>
        </div>

        {statusMsg && (
          <div
            className={`mt-4 px-4 py-2.5 text-xs rounded-lg border ${
              statusMsg.type === 'ok'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            {statusMsg.text}
          </div>
        )}

        {subMode === 'scrape' ? (
          <form onSubmit={handleScrape} className="mt-5 flex flex-col sm:flex-row gap-3">
            <input
              type="url"
              required
              value={scrapeUrl}
              onChange={(e) => setScrapeUrl(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/... atau URL blog daftar PDF"
              className="flex-1 px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
            />
            <button
              type="submit"
              disabled={scraping}
              className="px-5 py-2.5 text-sm font-medium text-white bg-[#0F2342] hover:bg-[#17325C] disabled:opacity-60 rounded-lg whitespace-nowrap cursor-pointer"
            >
              {scraping ? 'Memindai Halaman...' : 'Pindai Tautan PDF'}
            </button>
          </form>
        ) : (
          <div className="mt-5 p-6 border border-dashed border-slate-300 rounded-xl bg-slate-50 text-center">
            <FileSpreadsheet className="w-8 h-8 text-[#0284C7] mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-800 mb-1">
              Unggah berkas Excel (.xlsx), CSV (.csv), atau JSON (.json)
            </p>
            <p className="text-xs text-slate-500 mb-4">
              Kolom yang dikenali: <code className="font-mono">title/judul, author/penulis, category/kategori, year/tahun, pdfUrl/url, description</code>
            </p>
            <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-[#0F2342] hover:bg-[#17325C] rounded-lg cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Pilih Berkas</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        )}
      </div>

      {/* Preview Table before Bulk Save */}
      {previewItems.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[#0F2342]">
                Pratinjau Hasil ({previewItems.filter((i) => i.selected).length} / {previewItems.length} dipilih)
              </h3>
              <p className="text-xs text-slate-500 truncate max-w-md">Sumber: {scrapeSourceTitle}</p>
            </div>
            <button
              type="button"
              onClick={handleSaveSelected}
              disabled={savingBulk}
              className="px-4 py-2 text-xs font-medium text-white bg-[#0284C7] hover:bg-sky-700 disabled:opacity-60 rounded-lg cursor-pointer"
            >
              {savingBulk ? 'Menyimpan...' : 'Simpan Massal ke Katalog'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="p-3 w-10">
                    <input
                      type="checkbox"
                      checked={previewItems.every((i) => i.selected)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setPreviewItems((prev) => prev.map((it) => ({ ...it, selected: checked })));
                      }}
                    />
                  </th>
                  <th className="p-3">Judul</th>
                  <th className="p-3">Penulis</th>
                  <th className="p-3">Kategori</th>
                  <th className="p-3 w-20">Tahun</th>
                  <th className="p-3">URL PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setPreviewItems((prev) =>
                            prev.map((row, rIdx) => (rIdx === idx ? { ...row, selected: checked } : row))
                          );
                        }}
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPreviewItems((prev) =>
                            prev.map((row, rIdx) => (rIdx === idx ? { ...row, title: val } : row))
                          );
                        }}
                        className="w-full px-2 py-1 border border-slate-200 rounded"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="text"
                        value={item.author}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPreviewItems((prev) =>
                            prev.map((row, rIdx) => (rIdx === idx ? { ...row, author: val } : row))
                          );
                        }}
                        className="w-full px-2 py-1 border border-slate-200 rounded"
                      />
                    </td>
                    <td className="p-3">
                      <select
                        value={item.category}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPreviewItems((prev) =>
                            prev.map((row, rIdx) => (rIdx === idx ? { ...row, category: val } : row))
                          );
                        }}
                        className="px-2 py-1 border border-slate-200 rounded bg-white"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                        {!categories.some((c) => c.name === item.category) && (
                          <option value={item.category}>{item.category}</option>
                        )}
                      </select>
                    </td>
                    <td className="p-3">
                      <input
                        type="number"
                        value={item.year}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 2026;
                          setPreviewItems((prev) =>
                            prev.map((row, rIdx) => (rIdx === idx ? { ...row, year: val } : row))
                          );
                        }}
                        className="w-20 px-2 py-1 border border-slate-200 rounded tabular-nums"
                      />
                    </td>
                    <td className="p-3 max-w-[220px] truncate font-mono text-[11px] text-slate-500">
                      {item.pdfUrl}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

interface ExportPanelProps {
  books: Book[];
}

export const ExportPanel: React.FC<ExportPanelProps> = ({ books }) => {
  const buildExportRows = () =>
    books.map((b) => ({
      id: b.id,
      code: b.code,
      title: b.title,
      author: b.author,
      category: b.category,
      year: b.year,
      isbn: b.isbn || '',
      publisher: b.publisher || '',
      language: b.language || 'Indonesia',
      pages: b.pages || 0,
      status: b.status,
      recommended: b.recommended,
      pdfUrl: b.pdfUrl,
      coverUrl: b.coverUrl || '',
      description: b.description || '',
    }));

  const exportXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(buildExportRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Katalog Baca Komik');
    XLSX.writeFile(wb, `katalog-baca-komik-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportCsv = () => {
    const ws = XLSX.utils.json_to_sheet(buildExportRows());
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `katalog-baca-komik-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(buildExportRows(), null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `katalog-baca-komik-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
      <h2 className="font-serif text-xl font-semibold text-[#0F2342]">Export Data Katalog</h2>
      <p className="text-xs text-slate-500 mt-1">
        Unduh seluruh {books.length} entri katalog buku dan komik untuk pencadangan atau penyuntingan luring.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        <button
          type="button"
          onClick={exportXlsx}
          className="p-5 text-left border border-slate-200 rounded-xl hover:border-[#0284C7] hover:bg-sky-50/30 transition-colors cursor-pointer"
        >
          <Download className="w-5 h-5 text-[#0284C7] mb-3" />
          <p className="text-sm font-semibold text-slate-900">Excel (.xlsx)</p>
          <p className="text-xs text-slate-500 mt-1">Format spreadsheet standar Microsoft Excel.</p>
        </button>

        <button
          type="button"
          onClick={exportCsv}
          className="p-5 text-left border border-slate-200 rounded-xl hover:border-[#0284C7] hover:bg-sky-50/30 transition-colors cursor-pointer"
        >
          <Download className="w-5 h-5 text-[#0F2342] mb-3" />
          <p className="text-sm font-semibold text-slate-900">CSV (.csv)</p>
          <p className="text-xs text-slate-500 mt-1">Teks terpisah koma untuk olah data cepat.</p>
        </button>

        <button
          type="button"
          onClick={exportJson}
          className="p-5 text-left border border-slate-200 rounded-xl hover:border-[#0284C7] hover:bg-sky-50/30 transition-colors cursor-pointer"
        >
          <Download className="w-5 h-5 text-slate-700 mb-3" />
          <p className="text-sm font-semibold text-slate-900">JSON (.json)</p>
          <p className="text-xs text-slate-500 mt-1">Cadangan struktur objek lengkap untuk sistem.</p>
        </button>
      </div>
    </div>
  );
};
