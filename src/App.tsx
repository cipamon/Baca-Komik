import { onAuthStateChanged } from 'firebase/auth';
import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Heart,
  Search,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { BookCard } from './components/BookCard.tsx';
import { BookDetailModal } from './components/BookDetailModal.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { HeaderNav } from './components/HeaderNav.tsx';
import { PdfReaderModal } from './components/PdfReaderModal.tsx';
import { auth } from './firebase.ts';
import {
  fetchBooksFromFirestore,
  fetchCategoriesFromFirestore,
  fetchSettingsFromFirestore,
  verifyAndEnsureAdminProfile,
} from './lib/libraryService.ts';
import {
  DEFAULT_SETTINGS,
  SEED_BOOKS,
  SEED_CATEGORIES,
} from './types.ts';
import type {
  AdminUser,
  Book,
  BookStatMap,
  Category,
  LibrarySettings,
  MemberAccount,
  PublicNavTab,
} from './types.ts';

const GUEST_FAVS_KEY = 'baca_komik_guest_favorites';
const MEMBER_TOKEN_KEY = 'baca_komik_member_token';

function BacaKomikApp() {
  // Navigation & View State
  const [activeTab, setActiveTab] = useState<PublicNavTab>('home');
  const [inAdminView, setInAdminView] = useState(false);

  // Auth State
  const [authReady, setAuthReady] = useState(false);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [memberUser, setMemberUser] = useState<MemberAccount | null>(null);
  const [memberToken, setMemberToken] = useState<string>(() => {
    try {
      return localStorage.getItem(MEMBER_TOKEN_KEY) || '';
    } catch {
      return '';
    }
  });
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Catalog Data State
  const [books, setBooks] = useState<Book[]>(SEED_BOOKS);
  const [categories, setCategories] = useState<Category[]>(() =>
    SEED_CATEGORIES.map((c) => ({ ...c, createdBy: 'system' }))
  );
  const [settings, setSettings] = useState<LibrarySettings>(DEFAULT_SETTINGS);
  const [statsMap, setStatsMap] = useState<BookStatMap>({});
  const [usingSeedFallback, setUsingSeedFallback] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);

  // Favorites State (synced with server when Member logged in; localStorage for guest)
  const [guestFavorites, setGuestFavorites] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(GUEST_FAVS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Search, Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [sortBy, setSortBy] = useState<'popular' | 'newest' | 'title'>('popular');
  const [currentPage, setCurrentPage] = useState(1);

  // Modals
  const [detailBook, setDetailBook] = useState<Book | null>(null);
  const [readerBook, setReaderBook] = useState<Book | null>(null);

  // Load Member Session on boot
  useEffect(() => {
    const headers: Record<string, string> = {};
    if (memberToken) {
      headers.Authorization = `Bearer ${memberToken}`;
    }
    fetch('/api/member/me', { headers })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { member?: MemberAccount };
        if (data.member) {
          setMemberUser(data.member);
        }
      })
      .catch(() => {
        // Ignore guest session check
      });
  }, [memberToken]);

  // Listen to Firebase Auth State (Admin Google Sign-In)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser && fbUser.emailVerified) {
        try {
          const verified = await verifyAndEnsureAdminProfile(
            fbUser.uid,
            fbUser.email,
            fbUser.displayName
          );
          setAdminUser(verified);
        } catch {
          setAdminUser(null);
        }
      } else {
        setAdminUser(null);
        setInAdminView(false);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Load Stats from server
  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = (await res.json()) as { stats?: BookStatMap };
        if (data.stats) setStatsMap(data.stats);
      }
    } catch {
      // Ignore stats error
    }
  }, []);

  // Load Catalog from Firestore
  const loadCatalogData = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const [fsBooks, fsCats, fsSettings] = await Promise.all([
        fetchBooksFromFirestore(Boolean(adminUser)),
        fetchCategoriesFromFirestore(),
        fetchSettingsFromFirestore(),
      ]);

      if (fsBooks.length > 0) {
        setBooks(fsBooks);
        setUsingSeedFallback(false);
      } else {
        setBooks(SEED_BOOKS);
        setUsingSeedFallback(true);
      }

      if (fsCats.length > 0) {
        setCategories(fsCats);
      } else {
        setCategories(SEED_CATEGORIES.map((c) => ({ ...c, createdBy: 'system' })));
      }

      if (fsSettings) {
        setSettings(fsSettings);
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
    } catch {
      // Keep starter catalog visible if offline/uninitialized
    } finally {
      setCatalogLoading(false);
    }
  }, [adminUser]);

  useEffect(() => {
    if (!authReady) return;
    loadCatalogData();
    loadStats();
  }, [authReady, loadCatalogData, loadStats]);

  // Active Favorites list
  const activeFavorites = useMemo(() => {
    return memberUser ? memberUser.favorites || [] : guestFavorites;
  }, [memberUser, guestFavorites]);

  const toggleFavorite = async (bookId: string) => {
    if (memberUser) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (memberToken) headers.Authorization = `Bearer ${memberToken}`;
      const res = await fetch('/api/member/favorites', {
        method: 'POST',
        headers,
        body: JSON.stringify({ bookId, action: 'toggle' }),
      });
      if (res.ok) {
        const data = (await res.json()) as { favorites: string[] };
        setMemberUser((prev) => (prev ? { ...prev, favorites: data.favorites } : prev));
      }
      return;
    }

    setGuestFavorites((prev) => {
      const exists = prev.includes(bookId);
      const next = exists ? prev.filter((id) => id !== bookId) : [...prev, bookId];
      try {
        localStorage.setItem(GUEST_FAVS_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const trackActivity = async (bookId: string, type: 'read' | 'download') => {
    try {
      const res = await fetch('/api/stats/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId, type }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          bookId: string;
          stat: { readCount: number; downloadCount: number };
        };
        setStatsMap((prev) => ({ ...prev, [data.bookId]: data.stat }));
      }
    } catch {
      // Silent fail
    }
  };

  const handleOpenReader = (book: Book) => {
    setDetailBook(null);
    setReaderBook(book);
    trackActivity(book.id, 'read');
  };

  const publicBooks = useMemo(
    () => books.filter((b) => b.status === 'published'),
    [books]
  );

  const recommendedBooks = useMemo(
    () => publicBooks.filter((b) => b.recommended).slice(0, 6),
    [publicBooks]
  );

  const filteredPublicBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = publicBooks.filter((b) => {
      if (activeTab === 'favorites' && !activeFavorites.includes(b.id)) return false;
      if (selectedCategory !== 'ALL' && b.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q) ||
        b.code.toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'newest') return (b.year || 0) - (a.year || 0);
      const aScore = (a.readCount || 0) + (statsMap[a.id]?.readCount || 0);
      const bScore = (b.readCount || 0) + (statsMap[b.id]?.readCount || 0);
      return bScore - aScore;
    });
  }, [publicBooks, activeTab, activeFavorites, selectedCategory, searchQuery, sortBy, statsMap]);

  const itemsPerPage = Math.max(6, settings.itemsPerPage || 24);
  const totalPages = Math.max(1, Math.ceil(filteredPublicBooks.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const pagedBooks = useMemo(() => {
    const start = (safePage - 1) * itemsPerPage;
    return filteredPublicBooks.slice(start, start + itemsPerPage);
  }, [filteredPublicBooks, safePage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, sortBy, activeTab]);

  const canDownload = settings.allowGuestDownload || Boolean(memberUser) || Boolean(adminUser);

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900">
      <HeaderNav
        libraryName={settings.libraryName}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        adminUser={adminUser}
        memberUser={memberUser}
        inAdminView={inAdminView}
        onOpenAdmin={() => setInAdminView(true)}
        onExitAdmin={() => setInAdminView(false)}
        onOpenAuth={() => setAuthModalOpen(true)}
        favoritesCount={activeFavorites.length}
      />

      {/* ADMIN WORKSPACE */}
      {inAdminView && adminUser ? (
        <AdminDashboard
          adminUser={adminUser}
          books={books}
          categories={categories}
          settings={settings}
          statsMap={statsMap}
          onRefreshData={loadCatalogData}
          onOpenReader={handleOpenReader}
          onExitAdmin={() => setInAdminView(false)}
        />
      ) : (
        /* PUBLIC DIGITAL LIBRARY CATALOG */
        <main className="flex-1 pb-20 md:pb-12">
          {/* BERANDA HERO */}
          {activeTab === 'home' && (
            <section className="bg-slate-50/80 border-b border-slate-200/80">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                <div className="lg:col-span-7 flex flex-col justify-center">
                  <p className="text-xs font-medium text-[#0284C7] tracking-wide mb-2">
                    Perpustakaan Digital Modern
                  </p>
                  <h1 className="font-serif text-3xl sm:text-5xl font-semibold text-[#0F2342] leading-[1.12] text-balance">
                    Jelajahi Komik dan Literatur Grafis Tanpa Batas
                  </h1>
                  <p className="text-sm sm:text-base text-slate-600 leading-relaxed mt-4 max-w-2xl">
                    {settings.tagline} Baca langsung dari peramban dengan mode ringan, pratinjau cepat, serta dukungan mode malam yang nyaman.
                  </p>

                  {/* Live Catalog Search */}
                  <div className="mt-6 flex flex-col sm:flex-row gap-2.5 max-w-xl">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Cari judul komik, penulis, atau kode..."
                        className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('catalog')}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#0F2342] hover:bg-[#17325C] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <span>Semua Buku</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Clean Quantitative Strip */}
                  <div className="mt-7 pt-6 border-t border-slate-200/80 grid grid-cols-3 gap-4 max-w-md">
                    <div>
                      <p className="font-mono text-xl sm:text-2xl font-semibold text-[#0F2342] tabular-nums">
                        {publicBooks.length}
                      </p>
                      <p className="text-xs text-slate-500">Koleksi Komik</p>
                    </div>
                    <div>
                      <p className="font-mono text-xl sm:text-2xl font-semibold text-[#0F2342] tabular-nums">
                        {categories.length}
                      </p>
                      <p className="text-xs text-slate-500">Kategori</p>
                    </div>
                    <div>
                      <p className="font-mono text-xl sm:text-2xl font-semibold text-[#0284C7] tabular-nums">
                        PDF
                      </p>
                      <p className="text-xs text-slate-500">Pembaca Ganda</p>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5">
                  <div className="h-full min-h-[220px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                    <img
                      src="/src/assets/images/hero_library_editorial_1795158918999.jpg"
                      alt="Ruang baca perpustakaan digital Baca Komik"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Admin notice if catalog still using starter seed */}
          {adminUser && usingSeedFallback && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-5">
              <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-sky-900">
                <span>
                  Saat ini katalog menampilkan data contoh bawaan. Simpan ke Firestore lewat Dashboard Admin agar dapat disunting permanen.
                </span>
                <button
                  type="button"
                  onClick={() => setInAdminView(true)}
                  className="px-3 py-1.5 font-medium text-white bg-[#0F2342] rounded-lg cursor-pointer"
                >
                  Buka Dashboard Admin
                </button>
              </div>
            </div>
          )}

          {/* BERANDA: REKOMENDASI PILIHAN */}
          {activeTab === 'home' && recommendedBooks.length > 0 && !searchQuery && selectedCategory === 'ALL' && (
            <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10">
              <div className="flex items-end justify-between gap-4 mb-4">
                <div>
                  <h2 className="font-serif text-xl sm:text-2xl font-semibold text-[#0F2342]">
                    Pilihan Kurator
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Rekomendasi bacaan komik terbaik minggu ini
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('catalog')}
                  className="text-xs font-medium text-[#0284C7] hover:underline whitespace-nowrap cursor-pointer"
                >
                  Lihat Semua
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {recommendedBooks.map((book) => (
                  <BookCard
                    key={`rec-${book.id}`}
                    book={book}
                    isFavorite={activeFavorites.includes(book.id)}
                    onToggleFavorite={toggleFavorite}
                    onOpenDetail={setDetailBook}
                    onReadBook={handleOpenReader}
                    priority
                  />
                ))}
              </div>
            </section>
          )}

          {/* KATEGORI VIEW */}
          {activeTab === 'categories' ? (
            <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
              <div className="mb-6">
                <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#0F2342]">
                  Kategori Koleksi
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Pilih genre atau topik untuk menelusuri komik dan literatur terkait.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {categories.map((cat) => {
                  const count = publicBooks.filter((b) => b.category === cat.name).length;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat.name);
                        setActiveTab('catalog');
                      }}
                      className="text-left p-5 bg-white border border-slate-200 rounded-xl hover:border-[#0284C7] transition-colors flex flex-col justify-between cursor-pointer"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <FolderOpen className="w-5 h-5 text-[#0284C7]" />
                          <span className="font-mono text-xs tabular-nums text-slate-500">
                            {count} buku
                          </span>
                        </div>
                        <h2 className="font-serif text-lg font-semibold text-[#0F2342]">
                          {cat.name}
                        </h2>
                        <p className="text-xs text-slate-600 mt-1.5 line-clamp-2 leading-relaxed">
                          {cat.description || `Koleksi komik dan bacaan kategori ${cat.name}.`}
                        </p>
                      </div>
                      <span className="mt-4 text-xs font-medium text-[#0284C7] inline-flex items-center gap-1">
                        <span>Jelajahi</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : (
            /* CATALOG / HOME MAIN GRID / FAVORITES */
            <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-200/80">
                <div>
                  <h2 className="font-serif text-xl sm:text-2xl font-semibold text-[#0F2342]">
                    {activeTab === 'favorites'
                      ? 'Koleksi Favorit Saya'
                      : activeTab === 'catalog'
                      ? 'Semua Koleksi Buku'
                      : 'Katalog Perpustakaan'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                    Menampilkan {filteredPublicBooks.length} judul
                    {selectedCategory !== 'ALL' ? ` dalam kategori ${selectedCategory}` : ''}
                  </p>
                </div>

                {/* Filter & Search Toolbar */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {activeTab !== 'home' && (
                    <div className="relative flex-1 sm:w-56">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Cari judul / penulis..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                      />
                    </div>
                  )}

                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    aria-label="Filter kategori"
                    className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="ALL">Semua Kategori</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) =>
                      setSortBy(e.target.value as 'popular' | 'newest' | 'title')
                    }
                    aria-label="Urutkan buku"
                    className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="popular">Terpopuler</option>
                    <option value="newest">Terbaru</option>
                    <option value="title">Judul A–Z</option>
                  </select>
                </div>
              </div>

              {activeTab === 'favorites' && !memberUser && (
                <div className="mt-4 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                  <span>
                    Favorit tersimpan di peramban ini. Masuk sebagai Anggota untuk menyinkronkan favorit ke server lintas perangkat.
                  </span>
                  <button
                    type="button"
                    onClick={() => setAuthModalOpen(true)}
                    className="px-3 py-1.5 font-medium text-white bg-[#0F2342] rounded-lg cursor-pointer"
                  >
                    Masuk Anggota
                  </button>
                </div>
              )}

              {catalogLoading ? (
                <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={i}
                      className="border border-slate-200 rounded-xl overflow-hidden bg-white animate-pulse"
                    >
                      <div className="aspect-[3/4] bg-slate-100" />
                      <div className="p-3 space-y-2">
                        <div className="h-3.5 bg-slate-100 rounded w-5/6" />
                        <div className="h-3 bg-slate-100 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : pagedBooks.length === 0 ? (
                <div className="my-12 py-12 px-6 text-center border border-slate-200 rounded-2xl bg-slate-50/50">
                  {activeTab === 'favorites' ? (
                    <Heart className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                  ) : (
                    <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                  )}
                  <h3 className="font-serif text-lg font-semibold text-[#0F2342]">
                    {activeTab === 'favorites'
                      ? 'Belum Ada Buku Favorit'
                      : 'Tidak Ada Buku yang Cocok'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    {activeTab === 'favorites'
                      ? 'Klik ikon hati pada kartu komik untuk menyimpannya ke daftar favorit Anda.'
                      : 'Coba ubah kata kunci pencarian atau pilih kategori lain.'}
                  </p>
                  {(searchQuery || selectedCategory !== 'ALL' || activeTab === 'favorites') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedCategory('ALL');
                        setActiveTab('catalog');
                      }}
                      className="mt-4 px-4 py-2 text-xs font-medium text-white bg-[#0F2342] rounded-lg cursor-pointer"
                    >
                      Tampilkan Semua Buku
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                    {pagedBooks.map((book, idx) => (
                      <BookCard
                        key={book.id}
                        book={book}
                        isFavorite={activeFavorites.includes(book.id)}
                        onToggleFavorite={toggleFavorite}
                        onOpenDetail={setDetailBook}
                        onReadBook={handleOpenReader}
                        priority={idx < 6}
                      />
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="mt-8 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        disabled={safePage <= 1}
                        onClick={() => {
                          setCurrentPage((p) => Math.max(1, p - 1));
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Sebelumnya</span>
                      </button>
                      <span className="px-3 text-xs font-mono tabular-nums text-slate-600">
                        Halaman {safePage} dari {totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={safePage >= totalPages}
                        onClick={() => {
                          setCurrentPage((p) => Math.min(totalPages, p + 1));
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                      >
                        <span>Berikutnya</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </main>
      )}

      {/* Quiet Editorial Footer */}
      {!inAdminView && (
        <footer className="border-t border-slate-200 bg-slate-50/70 py-6 px-4 sm:px-6 mb-14 md:mb-0">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>
              © {new Date().getFullYear()} {settings.libraryName}. Perpustakaan Komik & Literatur Digital.
            </p>
            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={() => setActiveTab('catalog')}
                className="hover:text-[#0F2342] cursor-pointer"
              >
                Katalog Lengkap
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('categories')}
                className="hover:text-[#0F2342] cursor-pointer"
              >
                Kategori
              </button>
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="hover:text-[#0F2342] cursor-pointer"
              >
                Portal Akun
              </button>
            </div>
          </div>
        </footer>
      )}

      {/* Book Detail Modal (with Pre-warm & Download) */}
      {detailBook && (
        <BookDetailModal
          book={detailBook}
          isFavorite={activeFavorites.includes(detailBook.id)}
          allowDownload={canDownload}
          readCount={(detailBook.readCount || 0) + (statsMap[detailBook.id]?.readCount || 0)}
          downloadCount={
            (detailBook.downloadCount || 0) + (statsMap[detailBook.id]?.downloadCount || 0)
          }
          onClose={() => setDetailBook(null)}
          onToggleFavorite={toggleFavorite}
          onReadBook={handleOpenReader}
          onDownloadComplete={(id) => trackActivity(id, 'download')}
          onRequireLogin={() => {
            setDetailBook(null);
            setAuthModalOpen(true);
          }}
        />
      )}

      {/* Dual-Mode PDF Reader Modal */}
      {readerBook && (
        <PdfReaderModal
          book={readerBook}
          allowDownload={canDownload}
          onClose={() => setReaderBook(null)}
          onDownloadComplete={(id) => trackActivity(id, 'download')}
          onRequireLogin={() => {
            setReaderBook(null);
            setAuthModalOpen(true);
          }}
        />
      )}

      {/* Dual Auth Portal Modal */}
      {authModalOpen && (
        <AuthModal
          adminUser={adminUser}
          memberUser={memberUser}
          onClose={() => setAuthModalOpen(false)}
          onMemberSignedIn={(member, token) => {
            setMemberUser(member);
            setMemberToken(token);
            try {
              localStorage.setItem(MEMBER_TOKEN_KEY, token);
            } catch {
              // Ignore storage errors
            }
          }}
          onMemberSignedOut={() => {
            setMemberUser(null);
            setMemberToken('');
            try {
              localStorage.removeItem(MEMBER_TOKEN_KEY);
            } catch {
              // Ignore storage errors
            }
          }}
          onAdminSignedIn={(admin) => {
            setAdminUser(admin);
            setInAdminView(true);
          }}
          onAdminSignedOut={() => {
            setAdminUser(null);
            setInAdminView(false);
          }}
          onOpenAdminDashboard={() => setInAdminView(true)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BacaKomikApp />
    </ErrorBoundary>
  );
}
