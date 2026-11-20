import { BookOpen, Grid, Heart, Home, LayoutDashboard, LogIn, User } from 'lucide-react';
import React from 'react';
import type { AdminUser, MemberAccount, PublicNavTab } from '../types.ts';

interface HeaderNavProps {
  libraryName: string;
  activeTab: PublicNavTab;
  onSelectTab: (tab: PublicNavTab) => void;
  adminUser: AdminUser | null;
  memberUser: MemberAccount | null;
  inAdminView: boolean;
  onOpenAdmin: () => void;
  onExitAdmin: () => void;
  onOpenAuth: () => void;
  favoritesCount: number;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  libraryName,
  activeTab,
  onSelectTab,
  adminUser,
  memberUser,
  inAdminView,
  onOpenAdmin,
  onExitAdmin,
  onOpenAuth,
  favoritesCount,
}) => {
  const navItems: Array<{ id: PublicNavTab; label: string }> = [
    { id: 'home', label: 'Beranda' },
    { id: 'catalog', label: 'Semua Buku' },
    { id: 'categories', label: 'Kategori' },
    {
      id: 'favorites',
      label: favoritesCount > 0 ? `Favorit (${favoritesCount})` : 'Favorit',
    },
  ];

  return (
    <>
      {/* Desktop & Mobile Top Glassmorphic Sticky Header (3-Zone Top Bar Contract) */}
      <header className="sticky top-0 z-40 h-16 bg-white/85 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => {
              if (inAdminView) onExitAdmin();
              onSelectTab('home');
            }}
            className="flex items-center gap-2.5 text-[#0F2342] hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 rounded-md"
          >
            <span className="w-8 h-8 rounded-lg bg-[#0F2342] text-white flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4" />
            </span>
            <span className="font-serif text-lg sm:text-xl font-bold tracking-tight whitespace-nowrap">
              {libraryName || 'Baca Komik'}
            </span>
          </button>

          {/* Zone 2: 4 Clean Single-Line Navigation Links */}
          <nav
            aria-label="Navigasi utama"
            className="hidden md:flex items-center gap-7 text-sm font-medium"
          >
            {navItems.map((item) => {
              const isActive = !inAdminView && activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (inAdminView) onExitAdmin();
                    onSelectTab(item.id);
                  }}
                  className={`relative py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    isActive
                      ? 'text-[#0F2342] font-semibold'
                      : 'text-slate-600 hover:text-[#0F2342]'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute inset-x-0 -bottom-0.5 h-0.5 bg-[#0284C7] rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center shrink-0">
            {adminUser ? (
              <button
                type="button"
                onClick={inAdminView ? onExitAdmin : onOpenAdmin}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium text-white bg-[#0F2342] hover:bg-[#17325C] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>{inAdminView ? 'Lihat Katalog' : 'Dashboard Admin'}</span>
              </button>
            ) : memberUser ? (
              <button
                type="button"
                onClick={onOpenAuth}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium text-[#0F2342] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <User className="w-4 h-4 text-[#0284C7]" />
                <span className="max-w-[120px] truncate">{memberUser.fullName}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium text-white bg-[#0F2342] hover:bg-[#17325C] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Masuk</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Thumb Bottom Tab Bar (Compact h-14, visible only when not inside Admin full-screen workspace) */}
      {!inAdminView && (
        <nav
          aria-label="Navigasi seluler"
          className="md:hidden fixed bottom-0 inset-x-0 z-40 h-14 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-5"
        >
          <button
            type="button"
            onClick={() => onSelectTab('home')}
            className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
              activeTab === 'home' ? 'text-[#0284C7]' : 'text-slate-500'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Beranda</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('catalog')}
            className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
              activeTab === 'catalog' ? 'text-[#0284C7]' : 'text-slate-500'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Katalog</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('categories')}
            className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
              activeTab === 'categories' ? 'text-[#0284C7]' : 'text-slate-500'
            }`}
          >
            <Grid className="w-4 h-4" />
            <span>Kategori</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('favorites')}
            className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
              activeTab === 'favorites' ? 'text-[#0284C7]' : 'text-slate-500'
            }`}
          >
            <Heart className="w-4 h-4" />
            <span>Favorit</span>
          </button>
          <button
            type="button"
            onClick={adminUser ? onOpenAdmin : onOpenAuth}
            className="flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-slate-600"
          >
            {adminUser ? <LayoutDashboard className="w-4 h-4" /> : <User className="w-4 h-4" />}
            <span>{adminUser ? 'Admin' : memberUser ? 'Profil' : 'Masuk'}</span>
          </button>
        </nav>
      )}
    </>
  );
};
