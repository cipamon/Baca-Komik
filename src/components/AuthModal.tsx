import { signInWithPopup, signOut } from 'firebase/auth';
import { LogOut, ShieldCheck, User, X } from 'lucide-react';
import React, { useState } from 'react';
import { auth, googleProvider } from '../firebase.ts';
import { verifyAndEnsureAdminProfile } from '../lib/libraryService.ts';
import type { AdminUser, MemberAccount } from '../types.ts';

interface AuthModalProps {
  adminUser: AdminUser | null;
  memberUser: MemberAccount | null;
  onClose: () => void;
  onMemberSignedIn: (member: MemberAccount, token: string) => void;
  onMemberSignedOut: () => void;
  onAdminSignedIn: (admin: AdminUser) => void;
  onAdminSignedOut: () => void;
  onOpenAdminDashboard: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  adminUser,
  memberUser,
  onClose,
  onMemberSignedIn,
  onMemberSignedOut,
  onAdminSignedIn,
  onAdminSignedOut,
  onOpenAdminDashboard,
}) => {
  const [activeTab, setActiveTab] = useState<'member' | 'admin'>(adminUser ? 'admin' : 'member');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/member/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json()) as {
        error?: string;
        token?: string;
        member?: MemberAccount;
      };
      if (!res.ok || !data.member || !data.token) {
        setError(data.error || 'Gagal masuk sebagai anggota.');
        return;
      }
      onMemberSignedIn(data.member, data.token);
      onClose();
    } catch {
      setError('Tidak dapat terhubung ke server autentikasi.');
    } finally {
      setLoading(false);
    }
  };

  const handleMemberLogout = async () => {
    await fetch('/api/member/logout', { method: 'POST' });
    onMemberSignedOut();
    onClose();
  };

  const handleGoogleAdminLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const user = cred.user;
      if (!user.emailVerified) {
        await signOut(auth);
        setError('Email Google Anda belum terverifikasi.');
        return;
      }
      const verified = await verifyAndEnsureAdminProfile(
        user.uid,
        user.email,
        user.displayName
      );
      if (!verified) {
        await signOut(auth);
        setError(
          `Akun ${user.email} tidak terdaftar sebagai administrator pada koleksi admins.`
        );
        return;
      }
      onAdminSignedIn(verified);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Autentikasi Google dibatalkan atau gagal.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogout = async () => {
    await signOut(auth);
    onAdminSignedOut();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Portal Masuk Baca Komik"
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold text-[#0F2342]">Portal Akun</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup portal masuk"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dual Portal Tabs */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setActiveTab('member');
                setError('');
              }}
              className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                activeTab === 'member'
                  ? 'bg-white text-[#0F2342] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Anggota
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('admin');
                setError('');
              }}
              className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-white text-[#0F2342] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Admin
            </button>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 px-3.5 py-2.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
              {error}
            </div>
          )}

          {activeTab === 'member' ? (
            memberUser ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#0F2342] text-white flex items-center justify-center">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {memberUser.fullName}
                    </p>
                    <p className="text-xs text-slate-500 font-mono">@{memberUser.username}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-600">
                  Daftar favorit Anda otomatis tersinkronisasi ke server perpustakaan.
                </p>
                <button
                  type="button"
                  onClick={handleMemberLogout}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Keluar dari Akun Anggota</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleMemberSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Username Anggota
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Contoh: pembaca"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 text-sm font-medium text-white bg-[#0F2342] hover:bg-[#17325C] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                >
                  {loading ? 'Memverifikasi...' : 'Masuk sebagai Anggota'}
                </button>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Akun anggota dibuat dan dikelola oleh Administrator perpustakaan untuk sinkronisasi favorit lintas perangkat.
                </p>
              </form>
            )
          ) : adminUser ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#0284C7] text-white flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {adminUser.displayName}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{adminUser.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAdminDashboard();
                  }}
                  className="py-2.5 px-4 text-xs font-medium text-white bg-[#0F2342] hover:bg-[#17325C] rounded-lg cursor-pointer"
                >
                  Buka Dashboard
                </button>
                <button
                  type="button"
                  onClick={handleAdminLogout}
                  className="py-2.5 px-4 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer"
                >
                  Keluar Admin
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Masuk menggunakan akun Google Administrator yang terverifikasi pada koleksi{' '}
                <code className="font-mono text-[#0F2342]">admins</code> di Firestore untuk mengelola katalog, anggota, dan statistik perpustakaan.
              </p>
              <button
                type="button"
                onClick={handleGoogleAdminLogin}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2.5 py-2.5 px-4 text-sm font-medium text-white bg-[#0F2342] hover:bg-[#17325C] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-sky-300" />
                <span>{loading ? 'Menghubungkan Google...' : 'Masuk dengan Google (Admin)'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
