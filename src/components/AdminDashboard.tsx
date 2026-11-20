import {
  BarChart3,
  BookOpen,
  Check,
  Database,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FolderOpen,
  KeyRound,
  LayoutDashboard,
  Menu,
  Plus,
  Search,
  Settings,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { auth } from '../firebase.ts';
import {
  bulkCreateBooksInFirestore,
  bulkDeleteBooksInFirestore,
  bulkUpdateBooksInFirestore,
  deleteBookFromFirestore,
  deleteCategoryFromFirestore,
  deleteMemberMirrorFromFirestore,
  saveBookToFirestore,
  saveCategoryToFirestore,
  saveSettingsToFirestore,
  seedDemoCatalogToFirestore,
  syncMemberMirrorToFirestore,
} from '../lib/libraryService.ts';
import type {
  AdminTab,
  AdminUser,
  Book,
  BookStatMap,
  Category,
  LibrarySettings,
  MemberAccount,
} from '../types.ts';
import { BookFormView } from './admin/BookFormView.tsx';
import { ExportPanel, ImportPanel } from './admin/ImportExportPanels.tsx';

interface AdminDashboardProps {
  adminUser: AdminUser;
  books: Book[];
  categories: Category[];
  settings: LibrarySettings;
  statsMap: BookStatMap;
  onRefreshData: () => Promise<void>;
  onOpenReader: (book: Book) => void;
  onExitAdmin: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  adminUser,
  books,
  categories,
  settings,
  statsMap,
  onRefreshData,
  onOpenReader,
  onExitAdmin,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Book Management & Bulk Select state
  const [bookSearch, setBookSearch] = useState('');
  const [bookCatFilter, setBookCatFilter] = useState('ALL');
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkYear, setBulkYear] = useState('');
  const [bulkStatus, setBulkStatus] = useState<'' | 'published' | 'hidden'>('');
  const [bulkRecommended, setBulkRecommended] = useState<'' | 'true' | 'false'>('');

  // Category state
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [editingCat, setEditingCat] = useState<Category | null>(null);

  // Members state
  const [members, setMembers] = useState<MemberAccount[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<MemberAccount | null>(null);
  const [mUsername, setMUsername] = useState('');
  const [mFullName, setMFullName] = useState('');
  const [mPassword, setMPassword] = useState('');
  const [mActive, setMActive] = useState(true);
  const [resetPwdMember, setResetPwdMember] = useState<MemberAccount | null>(null);
  const [newResetPwd, setNewResetPwd] = useState('');

  // Settings state
  const [sLibraryName, setSLibraryName] = useState(settings.libraryName);
  const [sTagline, setSTagline] = useState(settings.tagline);
  const [sItemsPerPage, setSItemsPerPage] = useState(String(settings.itemsPerPage));
  const [sAllowGuestDownload, setSAllowGuestDownload] = useState(settings.allowGuestDownload);
  const [seeding, setSeeding] = useState(false);

  // Inline confirmation & toast feedback
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  useEffect(() => {
    setSLibraryName(settings.libraryName);
    setSTagline(settings.tagline);
    setSItemsPerPage(String(settings.itemsPerPage));
    setSAllowGuestDownload(settings.allowGuestDownload);
  }, [settings]);

  const showToast = (type: 'ok' | 'err', text: string) => {
    setFeedback({ type, text });
  };

  const fetchMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      const res = await fetch('/api/admin/members', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { members?: MemberAccount[] };
        setMembers(data.members || []);
      }
    } catch {
      // Ignore transient error
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'members' || activeTab === 'dashboard') {
      fetchMembers();
    }
  }, [activeTab, fetchMembers]);

  const publishedBooks = useMemo(
    () => books.filter((b) => b.status === 'published'),
    [books]
  );
  const hiddenBooks = useMemo(
    () => books.filter((b) => b.status === 'hidden'),
    [books]
  );

  const filteredBooks = useMemo(() => {
    const q = bookSearch.trim().toLowerCase();
    return books.filter((b) => {
      if (bookCatFilter !== 'ALL' && b.category !== bookCatFilter) return false;
      if (!q) return true;
      return (
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.code.toLowerCase().includes(q)
      );
    });
  }, [books, bookSearch, bookCatFilter]);

  const totalReads = useMemo(
    () =>
      books.reduce((acc, b) => acc + (b.readCount || 0) + (statsMap[b.id]?.readCount || 0), 0),
    [books, statsMap]
  );
  const totalDownloads = useMemo(
    () =>
      books.reduce(
        (acc, b) => acc + (b.downloadCount || 0) + (statsMap[b.id]?.downloadCount || 0),
        0
      ),
    [books, statsMap]
  );

  const popularBooks = useMemo(() => {
    return [...books]
      .map((b) => ({
        book: b,
        reads: (b.readCount || 0) + (statsMap[b.id]?.readCount || 0),
        downloads: (b.downloadCount || 0) + (statsMap[b.id]?.downloadCount || 0),
      }))
      .sort((a, b) => b.reads + b.downloads - (a.reads + a.downloads))
      .slice(0, 10);
  }, [books, statsMap]);

  const sidebarItems: Array<{ id: AdminTab; label: string; icon: React.ReactNode; count?: number }> = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'books', label: 'Manajemen Buku', icon: <BookOpen className="w-4 h-4" />, count: books.length },
    { id: 'add-book', label: 'Tambah Buku', icon: <Plus className="w-4 h-4" /> },
    { id: 'categories', label: 'Kategori', icon: <FolderOpen className="w-4 h-4" />, count: categories.length },
    { id: 'hidden', label: 'Buku Disembunyikan', icon: <EyeOff className="w-4 h-4" />, count: hiddenBooks.length },
    { id: 'members', label: 'Anggota', icon: <Users className="w-4 h-4" />, count: members.length },
    { id: 'import', label: 'Import Data', icon: <Upload className="w-4 h-4" /> },
    { id: 'export', label: 'Export Data', icon: <Download className="w-4 h-4" /> },
    { id: 'stats', label: 'Statistik', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'settings', label: 'Pengaturan', icon: <Settings className="w-4 h-4" /> },
  ];

  const handleSaveBook = async (data: Partial<Book>, existing?: Book | null) => {
    await saveBookToFirestore(data, existing);
    await onRefreshData();
    if (existing) {
      setEditingBook(null);
      setActiveTab('books');
    }
  };

  const handleBulkEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetBooks = books.filter((b) => selectedBookIds.includes(b.id));
    if (targetBooks.length === 0) return;

    const patch: Partial<Pick<Book, 'category' | 'year' | 'status' | 'recommended'>> = {};
    if (bulkCategory) patch.category = bulkCategory;
    if (bulkYear) {
      const y = parseInt(bulkYear, 10);
      if (y >= 1900 && y <= 2100) patch.year = y;
    }
    if (bulkStatus) patch.status = bulkStatus;
    if (bulkRecommended === 'true') patch.recommended = true;
    if (bulkRecommended === 'false') patch.recommended = false;

    await bulkUpdateBooksInFirestore(targetBooks, patch);
    await onRefreshData();
    setBulkEditOpen(false);
    setSelectedBookIds([]);
    setBulkCategory('');
    setBulkYear('');
    setBulkStatus('');
    setBulkRecommended('');
    showToast('ok', `${targetBooks.length} buku berhasil diperbarui secara massal.`);
  };

  const handleBulkDelete = () => {
    const count = selectedBookIds.length;
    if (count === 0) return;
    setConfirmState({
      title: 'Hapus Buku Massal',
      message: `Yakin ingin menghapus ${count} buku terpilih secara permanen dari katalog?`,
      onConfirm: async () => {
        await bulkDeleteBooksInFirestore(selectedBookIds);
        await onRefreshData();
        setSelectedBookIds([]);
        showToast('ok', `${count} buku berhasil dihapus.`);
      },
    });
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    await saveCategoryToFirestore({ name: catName, description: catDesc }, editingCat);
    await onRefreshData();
    setCatName('');
    setCatDesc('');
    setEditingCat(null);
    showToast('ok', 'Kategori berhasil disimpan.');
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;

    if (editingMember) {
      const res = await fetch(`/api/admin/members/${editingMember.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: mUsername,
          fullName: mFullName,
          active: mActive,
        }),
      });
      const data = (await res.json()) as { error?: string; member?: MemberAccount };
      if (!res.ok || !data.member) {
        showToast('err', data.error || 'Gagal memperbarui anggota.');
        return;
      }
      await syncMemberMirrorToFirestore(data.member, true);
      showToast('ok', 'Data anggota diperbarui.');
    } else {
      const res = await fetch('/api/admin/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: mUsername,
          fullName: mFullName,
          password: mPassword,
          active: mActive,
        }),
      });
      const data = (await res.json()) as { error?: string; member?: MemberAccount };
      if (!res.ok || !data.member) {
        showToast('err', data.error || 'Gagal menambah anggota.');
        return;
      }
      await syncMemberMirrorToFirestore(data.member, false);
      showToast('ok', 'Anggota baru berhasil dibuat.');
    }

    setMemberModalOpen(false);
    setEditingMember(null);
    setMUsername('');
    setMFullName('');
    setMPassword('');
    setMActive(true);
    await fetchMembers();
  };

  const handleResetMemberPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPwdMember || newResetPwd.length < 6) return;
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    const res = await fetch(`/api/admin/members/${resetPwdMember.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ password: newResetPwd }),
    });
    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      showToast('err', d.error || 'Gagal mengatur ulang password.');
      return;
    }
    setResetPwdMember(null);
    setNewResetPwd('');
    showToast('ok', 'Password anggota berhasil diatur ulang.');
  };

  const handleToggleMemberActive = async (member: MemberAccount) => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    const res = await fetch(`/api/admin/members/${member.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ active: !member.active }),
    });
    if (res.ok) {
      const data = (await res.json()) as { member: MemberAccount };
      await syncMemberMirrorToFirestore(data.member, true);
      await fetchMembers();
    }
  };

  const handleDeleteMember = (member: MemberAccount) => {
    setConfirmState({
      title: 'Hapus Akun Anggota',
      message: `Hapus anggota "${member.fullName}" (@${member.username}) secara permanen?`,
      onConfirm: async () => {
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;
        const res = await fetch(`/api/admin/members/${member.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          await deleteMemberMirrorFromFirestore(member.id);
          await fetchMembers();
          showToast('ok', 'Anggota berhasil dihapus.');
        }
      },
    });
  };

  const handleSeedDemo = async () => {
    setSeeding(true);
    try {
      await seedDemoCatalogToFirestore();
      await onRefreshData();
      showToast('ok', '36 buku koleksi Google Drive, 8 kategori, dan pengaturan berhasil disimpan ke Firestore.');
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Gagal mengisi data koleksi.');
    } finally {
      setSeeding(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveSettingsToFirestore({
      libraryName: sLibraryName,
      tagline: sTagline,
      itemsPerPage: parseInt(sItemsPerPage, 10) || 24,
      allowGuestDownload: sAllowGuestDownload,
    });
    await onRefreshData();
    showToast('ok', 'Pengaturan perpustakaan berhasil diperbarui.');
  };

  const currentTabLabel = sidebarItems.find((i) => i.id === activeTab)?.label || 'Dashboard';

  return (
    <div className="min-h-[calc(100vh-4rem)] pixar-canvas flex flex-col lg:flex-row">
      {/* Mobile/Tablet Admin Top Bar with Hamburger Menu strictly on the LEFT */}
      <div className="lg:hidden sticky top-16 z-30 bg-white border-b border-slate-200 px-4 h-12 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Buka menu navigasi admin"
            className="w-9 h-9 -ml-1.5 rounded-lg flex items-center justify-center text-[#0F2342] hover:bg-slate-100 cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-[#0F2342]">{currentTabLabel}</span>
        </div>
        <button
          type="button"
          onClick={onExitAdmin}
          className="text-xs font-medium text-[#0284C7] hover:underline whitespace-nowrap cursor-pointer"
        >
          Ke Katalog
        </button>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex"
          onClick={() => setMobileSidebarOpen(false)}
        >
          <aside
            className="w-72 bg-white h-full border-r border-slate-200 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-14 px-4 border-b border-slate-200 flex items-center justify-between">
              <span className="font-serif text-base font-bold text-[#0F2342]">
                Menu Administrator
              </span>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                aria-label="Tutup menu admin"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {sidebarItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setEditingBook(null);
                    setActiveTab(item.id);
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    activeTab === item.id
                      ? 'bg-[#0F2342] text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    {item.icon}
                    <span>{item.label}</span>
                  </span>
                  {item.count !== undefined && (
                    <span className="font-mono tabular-nums text-[11px] opacity-80">
                      {item.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 bg-white/90 backdrop-blur-md border-r border-slate-200/80 shadow-[4px_0_24px_-16px_rgba(15,35,66,0.14)] flex-col">
        <div className="p-4 border-b border-slate-200/70">
          <p className="text-xs font-semibold text-[#0F2342] truncate">{adminUser.displayName}</p>
          <p className="text-[11px] text-slate-500 truncate mt-0.5">{adminUser.email}</p>
        </div>

        <nav className="flex-1 p-3 space-y-1.5">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setEditingBook(null);
                setActiveTab(item.id);
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === item.id
                  ? 'pixar-btn-navy text-white'
                  : 'text-slate-700 hover:bg-slate-100/80'
              }`}
            >
              <span className="flex items-center gap-2.5">
                {item.icon}
                <span>{item.label}</span>
              </span>
              {item.count !== undefined && (
                <span className="font-mono tabular-nums text-[11px] opacity-80">{item.count}</span>
              )}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Admin Workspace */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-6xl">
        {feedback && (
          <div
            className={`mb-5 px-4 py-3 rounded-xl border text-xs flex items-center justify-between gap-4 ${
              feedback.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <span>{feedback.text}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-current opacity-70 hover:opacity-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="font-serif text-2xl font-semibold text-[#0F2342]">
                  Ringkasan Perpustakaan
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pantau koleksi buku, aktivitas pembaca, dan kelola data secara terpusat.
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleSeedDemo}
                  disabled={seeding}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl pixar-btn-soft cursor-pointer disabled:opacity-60"
                >
                  <Database className="w-3.5 h-3.5 text-[#0284C7]" />
                  <span>{seeding ? 'Menyimpan...' : 'Simpan 36 Koleksi ke Firestore'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingBook(null);
                    setActiveTab('add-book');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl pixar-btn-navy cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-200" />
                  <span>Tambah Buku</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              <div className="pixar-card rounded-2xl p-4">
                <p className="text-xs text-slate-500">Total Koleksi</p>
                <p className="font-mono text-2xl font-bold text-[#0F2342] tabular-nums mt-1">
                  {books.length}
                </p>
                <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
                  {publishedBooks.length} terbit · {hiddenBooks.length} tersembunyi
                </p>
              </div>
              <div className="pixar-card rounded-2xl p-4">
                <p className="text-xs text-slate-500">Kategori</p>
                <p className="font-mono text-2xl font-bold text-[#0F2342] tabular-nums mt-1">
                  {categories.length}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">Genre & topik aktif</p>
              </div>
              <div className="pixar-card rounded-2xl p-4">
                <p className="text-xs text-slate-500">Anggota Aktif</p>
                <p className="font-mono text-2xl font-bold text-[#0F2342] tabular-nums mt-1">
                  {members.filter((m) => m.active).length}
                </p>
                <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
                  Total {members.length} akun
                </p>
              </div>
              <div className="pixar-card rounded-2xl p-4">
                <p className="text-xs text-slate-500">Total Pembaca</p>
                <p className="font-mono text-2xl font-bold text-[#0284C7] tabular-nums mt-1">
                  {totalReads}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">Sesi baca tercatat</p>
              </div>
              <div className="col-span-2 lg:col-span-1 pixar-card rounded-2xl p-4">
                <p className="text-xs text-slate-500">Total Unduhan</p>
                <p className="font-mono text-2xl font-bold text-[#0F2342] tabular-nums mt-1">
                  {totalDownloads}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">Unduhan PDF</p>
              </div>
            </div>

            <div className="pixar-card rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200/70 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#0F2342]">Buku Terpopuler</h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('stats')}
                  className="text-xs font-medium text-[#0284C7] hover:underline cursor-pointer"
                >
                  Lihat Statistik Lengkap
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                      <th className="py-2.5 px-4">Kode</th>
                      <th className="py-2.5 px-4">Judul</th>
                      <th className="py-2.5 px-4">Kategori</th>
                      <th className="py-2.5 px-4 text-right">Dibaca</th>
                      <th className="py-2.5 px-4 text-right">Diunduh</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {popularBooks.slice(0, 6).map(({ book, reads, downloads }) => (
                      <tr key={book.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-mono tabular-nums text-slate-500">
                          {book.code}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-900">{book.title}</td>
                        <td className="py-2.5 px-4 text-slate-600">{book.category}</td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums">{reads}</td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                          {downloads}
                        </td>
                      </tr>
                    ))}
                    {popularBooks.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500">
                          Belum ada buku di Firestore. Klik &quot;Isi Data Contoh&quot; atau tambah buku baru.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MANAJEMEN BUKU (Bulk Select, Bulk Edit, Bulk Delete) */}
        {activeTab === 'books' && !editingBook && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="font-serif text-2xl font-semibold text-[#0F2342]">
                Manajemen Buku
              </h1>
              <button
                type="button"
                onClick={() => {
                  setEditingBook(null);
                  setActiveTab('add-book');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0F2342] hover:bg-[#17325C] rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Buku</span>
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={bookSearch}
                  onChange={(e) => setBookSearch(e.target.value)}
                  placeholder="Cari judul, penulis, atau kode buku..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                />
              </div>
              <select
                value={bookCatFilter}
                onChange={(e) => setBookCatFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="ALL">Semua Kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Bulk Selection Bar */}
            {selectedBookIds.length > 0 && (
              <div className="bg-[#0F2342] text-white rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-medium tabular-nums">
                  {selectedBookIds.length} buku dipilih
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBulkEditOpen(true)}
                    className="px-3 py-1.5 text-xs font-medium bg-[#0284C7] hover:bg-sky-600 rounded-lg cursor-pointer"
                  >
                    Edit Massal
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    className="px-3 py-1.5 text-xs font-medium bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
                  >
                    Hapus Massal
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBookIds([])}
                    className="px-2.5 py-1.5 text-xs text-slate-300 hover:text-white cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <th className="p-3 w-10">
                        <input
                          type="checkbox"
                          checked={
                            filteredBooks.length > 0 &&
                            filteredBooks.every((b) => selectedBookIds.includes(b.id))
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedBookIds(filteredBooks.map((b) => b.id));
                            } else {
                              setSelectedBookIds([]);
                            }
                          }}
                        />
                      </th>
                      <th className="p-3">Kode</th>
                      <th className="p-3">Judul & Penulis</th>
                      <th className="p-3">Kategori</th>
                      <th className="p-3">Tahun</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredBooks.map((book) => {
                      const isChecked = selectedBookIds.includes(book.id);
                      return (
                        <tr key={book.id} className="hover:bg-slate-50/70">
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedBookIds((prev) => [...prev, book.id]);
                                } else {
                                  setSelectedBookIds((prev) =>
                                    prev.filter((id) => id !== book.id)
                                  );
                                }
                              }}
                            />
                          </td>
                          <td className="p-3 font-mono tabular-nums text-slate-500">
                            {book.code}
                          </td>
                          <td className="p-3">
                            <p className="font-semibold text-slate-900">{book.title}</p>
                            <p className="text-slate-500">{book.author}</p>
                          </td>
                          <td className="p-3 text-slate-700">{book.category}</td>
                          <td className="p-3 tabular-nums text-slate-700">{book.year}</td>
                          <td className="p-3">
                            <span
                              className={`text-[11px] font-medium ${
                                book.status === 'published' ? 'text-emerald-700' : 'text-amber-700'
                              }`}
                            >
                              {book.status === 'published' ? 'Terbit' : 'Disembunyikan'}
                              {book.recommended ? ' · Pilihan' : ''}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => onOpenReader(book)}
                                title="Baca PDF"
                                className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingBook(book)}
                                title="Edit Buku"
                                className="p-1.5 rounded-md text-[#0284C7] hover:bg-sky-50 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmState({
                                    title: 'Hapus Buku',
                                    message: `Hapus "${book.title}" secara permanen?`,
                                    onConfirm: async () => {
                                      await deleteBookFromFirestore(book.id);
                                      await onRefreshData();
                                      showToast('ok', 'Buku berhasil dihapus.');
                                    },
                                  });
                                }}
                                title="Hapus Buku"
                                className="p-1.5 rounded-md text-rose-600 hover:bg-rose-50 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* EDITING BOOK FORM */}
        {activeTab === 'books' && editingBook && (
          <BookFormView
            initialBook={editingBook}
            categories={categories}
            onSave={handleSaveBook}
            onCancel={() => setEditingBook(null)}
          />
        )}

        {/* TAB 3: TAMBAH BUKU */}
        {activeTab === 'add-book' && (
          <BookFormView categories={categories} onSave={handleSaveBook} />
        )}

        {/* TAB 4: KATEGORI */}
        {activeTab === 'categories' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 h-fit">
              <h2 className="font-serif text-lg font-semibold text-[#0F2342]">
                {editingCat ? 'Edit Kategori' : 'Tambah Kategori'}
              </h2>
              <form onSubmit={handleSaveCategory} className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nama Kategori
                  </label>
                  <input
                    type="text"
                    required
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    placeholder="Contoh: Komik Sejarah"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Deskripsi Singkat
                  </label>
                  <textarea
                    rows={2}
                    value={catDesc}
                    onChange={(e) => setCatDesc(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-medium text-white bg-[#0F2342] hover:bg-[#17325C] rounded-lg cursor-pointer"
                  >
                    {editingCat ? 'Perbarui' : 'Simpan Kategori'}
                  </button>
                  {editingCat && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCat(null);
                        setCatName('');
                        setCatDesc('');
                      }}
                      className="px-3 py-2 text-xs text-slate-600 bg-slate-100 rounded-lg cursor-pointer"
                    >
                      Batal
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-[#0F2342]">
                  Daftar Kategori ({categories.length})
                </h2>
              </div>
              <div className="divide-y divide-slate-100">
                {categories.map((cat) => {
                  const count = books.filter((b) => b.category === cat.name).length;
                  return (
                    <div
                      key={cat.id}
                      className="px-5 py-3.5 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">
                          {cat.name}{' '}
                          <span className="font-mono text-xs text-slate-400 tabular-nums">
                            ({count})
                          </span>
                        </p>
                        {cat.description && (
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {cat.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCat(cat);
                            setCatName(cat.name);
                            setCatDesc(cat.description || '');
                          }}
                          className="p-1.5 text-[#0284C7] hover:bg-sky-50 rounded-md cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmState({
                              title: 'Hapus Kategori',
                              message: `Hapus kategori "${cat.name}"?`,
                              onConfirm: async () => {
                                await deleteCategoryFromFirestore(cat.id);
                                await onRefreshData();
                                showToast('ok', 'Kategori dihapus.');
                              },
                            });
                          }}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: BUKU DISEMBUNYIKAN */}
        {activeTab === 'hidden' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h1 className="font-serif text-xl font-semibold text-[#0F2342]">
                Buku Disembunyikan ({hiddenBooks.length})
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Buku berstatus tersembunyi tidak tampil di katalog publik.
              </p>
            </div>
            {hiddenBooks.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500">
                Tidak ada buku yang sedang disembunyikan.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {hiddenBooks.map((book) => (
                  <div
                    key={book.id}
                    className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{book.title}</p>
                      <p className="text-xs text-slate-500">
                        {book.author} · {book.category} · {book.year}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await saveBookToFirestore({ ...book, status: 'published' }, book);
                          await onRefreshData();
                          showToast('ok', `"${book.title}" diterbitkan kembali.`);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Terbitkan</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmState({
                            title: 'Hapus Permanen',
                            message: `Hapus "${book.title}" secara permanen?`,
                            onConfirm: async () => {
                              await deleteBookFromFirestore(book.id);
                              await onRefreshData();
                              showToast('ok', 'Buku dihapus.');
                            },
                          });
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: MANAJEMEN ANGGOTA */}
        {activeTab === 'members' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-serif text-2xl font-semibold text-[#0F2342]">
                  Manajemen Anggota
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kelola akun anggota perpustakaan (password di-hash aman dengan scrypt).
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingMember(null);
                  setMUsername('');
                  setMFullName('');
                  setMPassword('');
                  setMActive(true);
                  setMemberModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0F2342] hover:bg-[#17325C] rounded-lg cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Tambah Anggota</span>
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <th className="p-3.5">Username</th>
                      <th className="p-3.5">Nama Lengkap</th>
                      <th className="p-3.5">Favorit</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {membersLoading ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-500">
                          Memuat daftar anggota...
                        </td>
                      </tr>
                    ) : members.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-500">
                          Belum ada anggota terdaftar.
                        </td>
                      </tr>
                    ) : (
                      members.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50/70">
                          <td className="p-3.5 font-mono text-slate-800">@{m.username}</td>
                          <td className="p-3.5 font-medium text-slate-900">{m.fullName}</td>
                          <td className="p-3.5 font-mono tabular-nums text-slate-600">
                            {m.favorites?.length || 0} buku
                          </td>
                          <td className="p-3.5">
                            <button
                              type="button"
                              onClick={() => handleToggleMemberActive(m)}
                              className={`text-[11px] font-medium underline-offset-2 hover:underline cursor-pointer ${
                                m.active ? 'text-emerald-700' : 'text-rose-600'
                              }`}
                            >
                              {m.active ? 'Aktif (Nonaktifkan)' : 'Nonaktif (Aktifkan)'}
                            </button>
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMember(m);
                                  setMUsername(m.username);
                                  setMFullName(m.fullName);
                                  setMActive(m.active);
                                  setMemberModalOpen(true);
                                }}
                                title="Edit Anggota"
                                className="p-1.5 text-[#0284C7] hover:bg-sky-50 rounded-md cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setResetPwdMember(m);
                                  setNewResetPwd('');
                                }}
                                title="Reset Password"
                                className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-md cursor-pointer"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMember(m)}
                                title="Hapus Anggota"
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: IMPORT DATA & WEB SCRAPER */}
        {activeTab === 'import' && (
          <ImportPanel
            categories={categories}
            onBulkSave={async (items) => {
              await bulkCreateBooksInFirestore(items);
              await onRefreshData();
              showToast('ok', `${items.length} buku hasil impor berhasil disimpan.`);
            }}
          />
        )}

        {/* TAB 8: EXPORT DATA */}
        {activeTab === 'export' && <ExportPanel books={books} />}

        {/* TAB 9: STATISTIK */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            <div>
              <h1 className="font-serif text-2xl font-semibold text-[#0F2342]">
                Statistik Pembaca & Unduhan
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Rekapitulasi 10 koleksi dengan tingkat keterbacaan dan unduhan tertinggi.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              {popularBooks.map(({ book, reads, downloads }, index) => {
                const maxScore = Math.max(
                  1,
                  popularBooks[0].reads + popularBooks[0].downloads
                );
                const pct = Math.round(((reads + downloads) / maxScore) * 100);
                return (
                  <div key={book.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-medium text-slate-900 truncate">
                        <span className="font-mono text-slate-400 mr-2 tabular-nums">
                          {String(index + 1).padStart(2, '0')}.
                        </span>
                        {book.title}
                      </span>
                      <span className="font-mono tabular-nums text-slate-600 shrink-0">
                        {reads} baca · {downloads} unduh
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#0284C7] rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 10: PENGATURAN */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
              <h1 className="font-serif text-2xl font-semibold text-[#0F2342]">
                Pengaturan Perpustakaan
              </h1>
              <form onSubmit={handleSaveSettings} className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nama Perpustakaan
                  </label>
                  <input
                    type="text"
                    required
                    value={sLibraryName}
                    onChange={(e) => setSLibraryName(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Tagline / Deskripsi Singkat
                  </label>
                  <input
                    type="text"
                    value={sTagline}
                    onChange={(e) => setSTagline(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Jumlah Buku per Halaman (6–60)
                  </label>
                  <input
                    type="number"
                    min={6}
                    max={60}
                    value={sItemsPerPage}
                    onChange={(e) => setSItemsPerPage(e.target.value)}
                    className="w-32 px-3.5 py-2 text-sm tabular-nums border border-slate-300 rounded-lg"
                  />
                </div>
                <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={sAllowGuestDownload}
                    onChange={(e) => setSAllowGuestDownload(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-[#0284C7]"
                  />
                  <span>Izinkan pengunjung tamu mengunduh berkas PDF tanpa masuk</span>
                </label>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-sm font-medium text-white bg-[#0F2342] hover:bg-[#17325C] rounded-lg cursor-pointer"
                  >
                    Simpan Pengaturan
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-[#0F2342]">Data Contoh (Seed Demo)</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Simpan 36 koleksi komik PDF Google Drive & 8 kategori ke Firestore.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSeedDemo}
                disabled={seeding}
                className="px-4 py-2 text-xs font-medium text-[#0F2342] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                {seeding ? 'Mengisi...' : 'Jalankan Seed Demo'}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Bulk Edit Modal */}
      {bulkEditOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setBulkEditOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-lg font-semibold text-[#0F2342]">
              Edit Massal ({selectedBookIds.length} Buku)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Biarkan kosong jika tidak ingin mengubah kolom tertentu.
            </p>
            <form onSubmit={handleBulkEditSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Kategori</label>
                <select
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">— Tidak diubah —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Tahun</label>
                <input
                  type="number"
                  placeholder="Biarkan kosong jika tetap"
                  value={bulkYear}
                  onChange={(e) => setBulkYear(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={bulkStatus}
                  onChange={(e) =>
                    setBulkStatus(e.target.value as '' | 'published' | 'hidden')
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">— Tidak diubah —</option>
                  <option value="published">Terbit (Publik)</option>
                  <option value="hidden">Disembunyikan</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Rekomendasi
                </label>
                <select
                  value={bulkRecommended}
                  onChange={(e) =>
                    setBulkRecommended(e.target.value as '' | 'true' | 'false')
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">— Tidak diubah —</option>
                  <option value="true">Tandai sebagai Pilihan</option>
                  <option value="false">Hapus dari Pilihan</option>
                </select>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBulkEditOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-[#0F2342] rounded-lg cursor-pointer"
                >
                  Terapkan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Member Modal */}
      {memberModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setMemberModalOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-lg font-semibold text-[#0F2342]">
              {editingMember ? 'Edit Anggota' : 'Tambah Anggota Baru'}
            </h3>
            <form onSubmit={handleSaveMember} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={mUsername}
                  onChange={(e) => setMUsername(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={mFullName}
                  onChange={(e) => setMFullName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              {!editingMember && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Password (min. 6 karakter)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={mPassword}
                    onChange={(e) => setMPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              )}
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={mActive}
                  onChange={(e) => setMActive(e.target.checked)}
                />
                <span>Akun Aktif</span>
              </label>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMemberModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-[#0F2342] rounded-lg cursor-pointer"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPwdMember && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setResetPwdMember(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-lg font-semibold text-[#0F2342]">
              Reset Password Anggota
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Anggota: <strong className="text-slate-900">@{resetPwdMember.username}</strong>
            </p>
            <form onSubmit={handleResetMemberPassword} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Password Baru (min. 6 karakter)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newResetPwd}
                  onChange={(e) => setNewResetPwd(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetPwdMember(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-[#0F2342] rounded-lg cursor-pointer"
                >
                  Atur Ulang Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Action Modal (replaces window.confirm) */}
      {confirmState && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setConfirmState(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-lg font-semibold text-[#0F2342]">
              {confirmState.title}
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">{confirmState.message}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmState(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  const fn = confirmState.onConfirm;
                  setConfirmState(null);
                  await fn();
                }}
                className="px-4 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
