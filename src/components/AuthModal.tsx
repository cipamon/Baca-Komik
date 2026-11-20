import { signInWithPopup, signOut } from 'firebase/auth';
import { Check, Copy, ExternalLink, LogOut, ShieldCheck, User, X } from 'lucide-react';
import React, { useState } from 'react';
import firebaseConfig from '../../firebase-applet-config.json';
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

const PREAUTHORIZED_PREVIEW_URL =
  'https://ais-dev-f2mkzf3xiz7n75an27qtsf-204741071158.asia-southeast1.run.app';

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
  const [unauthorizedHost, setUnauthorizedHost] = useState('');
  const [copiedHost, setCopiedHost] = useState(false);

  const handleCopyHostname = async () => {
    if (!unauthorizedHost) return;
    try {
      await navigator.clipboard.writeText(unauthorizedHost);
      setCopiedHost(true);
      setTimeout(() => setCopiedHost(false), 2000);
    } catch {
      // Clipboard API fallback ignored
    }
  };

  const handleMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setUnauthorizedHost('');
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
    setUnauthorizedHost('');
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
      const code = (err as { code?: string })?.code || '';
      const rawMessage = err instanceof Error ? err.message : '';
      if (code === 'auth/unauthorized-domain' || rawMessage.includes('auth/unauthorized-domain')) {
        const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
        setUnauthorizedHost(currentHost);
        setError(
          `Domain "${currentHost || 'saat ini'}" belum diizinkan pada Firebase Authentication.`
        );
      } else if (code === 'auth/popup-blocked') {
        setError(
          'Jendela pop-up login Google diblokir oleh browser. Izinkan pop-up untuk situs ini lalu coba lagi.'
        );
      } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setError('Login Google dibatalkan sebelum selesai.');
      } else if (code === 'auth/network-request-failed') {
        setError('Gagal terhubung ke layanan Google Auth. Periksa koneksi internet Anda.');
      } else {
        setError(rawMessage || 'Autentikasi Google dibatalkan atau gagal.');
      }
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
      className="fixed inset-0 z-50 bg-[#0F2342]/55 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Portal Masuk Baca Komik"
    >
      <div
        className="pixar-modal rounded-3xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200/70 bg-white/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/src/assets/images/pixar_owl_scholar_1795212787351.jpg"
              alt="Maskot pustakawan Baca Komik"
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-2xl object-cover shadow-[0_4px_10px_rgba(15,35,66,0.2)] border border-white"
            />
            <div>
              <h2 className="font-serif text-xl font-semibold text-[#0F2342] leading-tight">
                Portal Akun
              </h2>
              <p className="text-[11px] text-slate-500">Akses anggota & pengelola katalog</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup portal masuk"
            className="w-8 h-8 rounded-xl pixar-btn-soft flex items-center justify-center text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dual Portal Tabs */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-2 p-1.5 pixar-surface-inset rounded-2xl gap-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab('member');
                setError('');
                setUnauthorizedHost('');
              }}
              className={`py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === 'member'
                  ? 'bg-white text-[#0F2342] shadow-[0_2px_6px_rgba(15,35,66,0.12),inset_0_1px_0_#fff]'
                  : 'text-slate-600 hover:text-[#0F2342]'
              }`}
            >
              Anggota
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('admin');
                setError('');
                setUnauthorizedHost('');
              }}
              className={`py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-white text-[#0F2342] shadow-[0_2px_6px_rgba(15,35,66,0.12),inset_0_1px_0_#fff]'
                  : 'text-slate-600 hover:text-[#0F2342]'
              }`}
            >
              Admin
            </button>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 px-3.5 py-3 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-2xl space-y-2.5">
              <p className="font-medium leading-relaxed">{error}</p>
              {unauthorizedHost && (
                <div className="space-y-2 pt-1 border-t border-rose-200/80 text-[11px] text-rose-900">
                  <p className="leading-relaxed">
                    Tambahkan domain ini ke{' '}
                    <span className="font-semibold">
                      Firebase Console → Authentication → Settings → Authorized domains
                    </span>
                    :
                  </p>
                  <div className="flex items-center gap-2 bg-white border border-rose-200 rounded-xl px-2.5 py-1.5">
                    <code className="font-mono text-[11px] text-slate-800 truncate flex-1">
                      {unauthorizedHost}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyHostname}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium shrink-0 cursor-pointer"
                    >
                      {copiedHost ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Salin</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-0.5">
                    <a
                      href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-[#0284C7] hover:underline"
                    >
                      <span>Buka Pengaturan Firebase</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    {!unauthorizedHost.includes('f2mkzf3xiz7n75an27qtsf') && (
                      <a
                        href={PREAUTHORIZED_PREVIEW_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-[#0F2342] hover:underline"
                      >
                        <span>Buka URL Preview Terotorisasi</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'member' ? (
            memberUser ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl pixar-surface-inset flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl pixar-emblem-3d text-white flex items-center justify-center">
                    <User className="w-5 h-5 text-sky-200" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#0F2342] truncate">
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
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Keluar dari Akun Anggota</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleMemberSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#0F2342] mb-1.5">
                    Username Anggota
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Contoh: pembaca"
                    className="w-full px-3.5 py-2.5 text-sm pixar-surface-inset rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F2342] mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password"
                    className="w-full px-3.5 py-2.5 text-sm pixar-surface-inset rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 text-sm font-semibold rounded-xl pixar-btn-navy disabled:opacity-60 cursor-pointer"
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
              <div className="p-4 rounded-2xl pixar-surface-inset flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl pixar-btn-sky text-white flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#0F2342] truncate">
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
                  className="py-2.5 px-4 text-xs font-semibold rounded-xl pixar-btn-navy cursor-pointer"
                >
                  Buka Dashboard
                </button>
                <button
                  type="button"
                  onClick={handleAdminLogout}
                  className="py-2.5 px-4 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl cursor-pointer"
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
                className="w-full inline-flex items-center justify-center gap-2.5 py-2.5 px-4 text-sm font-semibold rounded-xl pixar-btn-navy disabled:opacity-60 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-amber-200" />
                <span>{loading ? 'Menghubungkan Google...' : 'Masuk dengan Google (Admin)'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
