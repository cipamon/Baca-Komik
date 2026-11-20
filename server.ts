import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import dotenv from 'dotenv';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { generateSampleComicPdf } from './server/pdfGenerator.ts';
import {
  hashPassword,
  loadMembers,
  loadStats,
  saveMembers,
  signMemberToken,
  trackBookStat,
  verifyMemberToken,
  verifyPassword,
} from './server/storage.ts';
import type { ServerMember } from './server/storage.ts';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const PRIMARY_ADMIN_EMAIL = 'faniku2021@gmail.com';
const CACHE_DIR = path.resolve(process.cwd(), '.cache', 'pdfs');

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Read Firebase applet config synchronously for ID token verification
interface FirebaseAppletConfig {
  projectId: string;
  apiKey: string;
  firestoreDatabaseId?: string;
}

let firebaseConfig: FirebaseAppletConfig | null = null;
try {
  const rawCfg = fs.readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf8');
  firebaseConfig = JSON.parse(rawCfg) as FirebaseAppletConfig;
} catch {
  firebaseConfig = null;
}

// RAM LRU Cache for PDFs
interface CachedPdfEntry {
  buffer: Buffer;
  recoverySource: string;
  contentType: string;
  lastAccess: number;
}

const ramPdfCache = new Map<string, CachedPdfEntry>();
const MAX_RAM_BYTES = 80 * 1024 * 1024; // 80 MB
const inFlightFetches = new Map<string, Promise<CachedPdfEntry>>();

function getRamCacheTotalBytes(): number {
  let total = 0;
  for (const entry of ramPdfCache.values()) {
    total += entry.buffer.length;
  }
  return total;
}

function setRamCache(key: string, entry: CachedPdfEntry): void {
  if (entry.buffer.length > 25 * 1024 * 1024) return; // Don't hold huge >25MB single file in RAM
  ramPdfCache.set(key, { ...entry, lastAccess: Date.now() });
  while (getRamCacheTotalBytes() > MAX_RAM_BYTES && ramPdfCache.size > 1) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [k, v] of ramPdfCache.entries()) {
      if (v.lastAccess < oldestTime) {
        oldestTime = v.lastAccess;
        oldestKey = k;
      }
    }
    if (oldestKey) {
      ramPdfCache.delete(oldestKey);
    } else {
      break;
    }
  }
}

function getDiskCachePaths(cacheKey: string): { pdfPath: string; metaPath: string } {
  const hash = crypto.createHash('sha256').update(cacheKey).digest('hex');
  return {
    pdfPath: path.join(CACHE_DIR, `${hash}.pdf`),
    metaPath: path.join(CACHE_DIR, `${hash}.meta.json`),
  };
}

function readPdfFromCache(cacheKey: string): CachedPdfEntry | null {
  const ramHit = ramPdfCache.get(cacheKey);
  if (ramHit) {
    ramHit.lastAccess = Date.now();
    return ramHit;
  }

  const { pdfPath, metaPath } = getDiskCachePaths(cacheKey);
  if (fs.existsSync(pdfPath)) {
    try {
      const buffer = fs.readFileSync(pdfPath);
      let recoverySource = 'original';
      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as { recoverySource?: string };
        if (meta.recoverySource) recoverySource = meta.recoverySource;
      }
      const entry: CachedPdfEntry = {
        buffer,
        recoverySource,
        contentType: 'application/pdf',
        lastAccess: Date.now(),
      };
      setRamCache(cacheKey, entry);
      return entry;
    } catch {
      return null;
    }
  }
  return null;
}

function writePdfToCache(cacheKey: string, entry: CachedPdfEntry): void {
  setRamCache(cacheKey, entry);
  const { pdfPath, metaPath } = getDiskCachePaths(cacheKey);
  try {
    fs.writeFileSync(pdfPath, entry.buffer);
    fs.writeFileSync(metaPath, JSON.stringify({ recoverySource: entry.recoverySource }));
  } catch {
    // Ignore disk write failure
  }
}

function sendBufferWithRange(
  req: Request,
  res: Response,
  buffer: Buffer,
  extraHeaders: Record<string, string> = {}
): void {
  const total = buffer.length;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, X-Cache, X-Recovery-Source');
  for (const [k, v] of Object.entries(extraHeaders)) {
    res.setHeader(k, v);
  }

  const rangeHeader = req.headers.range;
  if (req.method === 'HEAD') {
    res.setHeader('Content-Length', String(total));
    res.status(200).end();
    return;
  }

  if (rangeHeader && rangeHeader.startsWith('bytes=')) {
    const [startStr, endStr] = rangeHeader.replace('bytes=', '').split('-');
    let start = startStr ? parseInt(startStr, 10) : 0;
    let end = endStr ? parseInt(endStr, 10) : total - 1;

    if (!startStr && endStr) {
      // Suffix byte range e.g. bytes=-500
      const suffixLen = parseInt(endStr, 10);
      start = Math.max(0, total - suffixLen);
      end = total - 1;
    }

    if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || start >= total || end < start) {
      res.setHeader('Content-Range', `bytes */${total}`);
      res.status(416).end();
      return;
    }

    end = Math.min(end, total - 1);
    const chunk = buffer.subarray(start, end + 1);
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
    res.setHeader('Content-Length', String(chunk.length));
    res.end(chunk);
    return;
  }

  res.setHeader('Content-Length', String(total));
  res.status(200).end(buffer);
}

function extractDriveId(rawUrl: string): string | null {
  const fileMatch = rawUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (fileMatch?.[1]) return fileMatch[1];
  const openMatch = rawUrl.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/i);
  if (openMatch?.[1]) return openMatch[1];
  const ucMatch = rawUrl.match(/drive\.google\.com\/uc\?(?:.*&)?id=([a-zA-Z0-9_-]+)/i);
  if (ucMatch?.[1]) return ucMatch[1];
  return null;
}

function normalizeDriveDownloadUrl(rawUrl: string): string {
  const driveId = extractDriveId(rawUrl);
  if (driveId) {
    return `https://drive.usercontent.google.com/download?id=${driveId}&export=download&confirm=t`;
  }
  return rawUrl;
}

function isLikelyPdfBuffer(buf: Buffer, contentType: string | null): boolean {
  if (buf.length < 16) return false;
  const header = buf.subarray(0, 1024).toString('latin1');
  if (header.includes('%PDF-')) return true;
  if (contentType && contentType.toLowerCase().includes('application/pdf') && !header.trimStart().startsWith('<')) {
    return true;
  }
  return false;
}

async function fetchPdfBuffer(targetUrl: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(targetUrl, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'application/pdf,application/octet-stream,*/*;q=0.8',
      },
    });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type');
    const arrayBuf = await response.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    if (isLikelyPdfBuffer(buf, contentType)) {
      return { buffer: buf, contentType: 'application/pdf' };
    }

    // Handle Google Drive virus-scan confirmation HTML page if returned
    if (contentType && contentType.includes('text/html') && targetUrl.includes('google.com')) {
      const html = buf.toString('utf8');
      const $ = cheerio.load(html);
      const formAction = $('#download-form').attr('action');
      if (formAction) {
        const params = new URLSearchParams();
        $('#download-form input[name]').each((_, el) => {
          const name = $(el).attr('name');
          const value = $(el).attr('value') || '';
          if (name) params.set(name, value);
        });
        const retryUrl = `${formAction}?${params.toString()}`;
        const retryRes = await fetch(retryUrl, {
          redirect: 'follow',
          signal: AbortSignal.timeout(30000),
        });
        if (retryRes.ok) {
          const retryBuf = Buffer.from(await retryRes.arrayBuffer());
          if (isLikelyPdfBuffer(retryBuf, retryRes.headers.get('content-type'))) {
            return { buffer: retryBuf, contentType: 'application/pdf' };
          }
        }
      }
    }

    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRecovery(rawUrl: string): Promise<CachedPdfEntry> {
  const normalizedUrl = normalizeDriveDownloadUrl(rawUrl);

  // 1. Direct attempt (using drive.usercontent for Google Drive links)
  const direct = await fetchPdfBuffer(normalizedUrl);
  if (direct) {
    return {
      buffer: direct.buffer,
      contentType: direct.contentType,
      recoverySource: 'original',
      lastAccess: Date.now(),
    };
  }

  // Fallback for Google Drive uc?export=download if usercontent failed
  const driveId = extractDriveId(rawUrl);
  if (driveId) {
    const ucFallback = await fetchPdfBuffer(
      `https://drive.google.com/uc?export=download&id=${driveId}&confirm=t`
    );
    if (ucFallback) {
      return {
        buffer: ucFallback.buffer,
        contentType: ucFallback.contentType,
        recoverySource: 'original',
        lastAccess: Date.now(),
      };
    }
  }

  // 2. HTTPS upgrade if original was http://
  if (normalizedUrl.startsWith('http://')) {
    const httpsUrl = normalizedUrl.replace(/^http:\/\//i, 'https://');
    const upgraded = await fetchPdfBuffer(httpsUrl);
    if (upgraded) {
      return {
        buffer: upgraded.buffer,
        contentType: upgraded.contentType,
        recoverySource: 'https-upgrade',
        lastAccess: Date.now(),
      };
    }
  }

  // 3. Wayback Machine Archive Recovery
  try {
    const wbCheck = await fetch(
      `https://archive.org/wayback/available?url=${encodeURIComponent(rawUrl)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (wbCheck.ok) {
      const wbJson = (await wbCheck.json()) as {
        archived_snapshots?: { closest?: { available?: boolean; url?: string; timestamp?: string } };
      };
      const closest = wbJson?.archived_snapshots?.closest;
      if (closest?.available && closest.url) {
        const rawSnapshotUrl = closest.timestamp
          ? `https://web.archive.org/web/${closest.timestamp}id_/${rawUrl}`
          : closest.url.replace(/\/web\/(\d+)\//, '/web/$1id_/');
        const archived = await fetchPdfBuffer(rawSnapshotUrl);
        if (archived) {
          return {
            buffer: archived.buffer,
            contentType: archived.contentType,
            recoverySource: 'wayback',
            lastAccess: Date.now(),
          };
        }
      }
    }
  } catch {
    // Wayback fallback unavailable
  }

  throw new Error('Dokumen PDF tidak dapat diakses atau diblokir oleh sumber eksternal.');
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      result[k] = decodeURIComponent(v);
    }
  }
  return result;
}

function extractMemberToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies.baca_komik_member;
}

interface VerifiedFirebaseAdmin {
  uid: string;
  email: string;
  displayName?: string;
}

async function verifyAdminRequest(req: Request): Promise<VerifiedFirebaseAdmin | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ') || !firebaseConfig?.apiKey) {
    return null;
  }
  const idToken = authHeader.slice(7).trim();
  if (!idToken) return null;

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      users?: Array<{
        localId: string;
        email?: string;
        emailVerified?: boolean;
        displayName?: string;
      }>;
    };
    const user = data.users?.[0];
    if (!user || !user.email || !user.emailVerified) return null;

    if (user.email.toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase()) {
      return { uid: user.localId, email: user.email, displayName: user.displayName };
    }

    // Also check Firestore /admins/{uid} via Firestore REST API using the user's own Bearer token
    const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
    const fsUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${dbId}/documents/admins/${user.localId}`;
    const fsRes = await fetch(fsUrl, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (fsRes.ok) {
      return { uid: user.localId, email: user.email, displayName: user.displayName };
    }
    return null;
  } catch {
    return null;
  }
}

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const admin = await verifyAdminRequest(req);
  if (!admin) {
    res.status(403).json({ error: 'Akses ditolak. Autentikasi Admin Google diperlukan.' });
    return;
  }
  (req as Request & { adminUser?: VerifiedFirebaseAdmin }).adminUser = admin;
  next();
}

function sanitizeMemberPublic(member: ServerMember) {
  return {
    id: member.id,
    username: member.username,
    fullName: member.fullName,
    active: member.active,
    favorites: member.favorites || [],
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
  };
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  // 1. Sample PDF Generator endpoint with HTTP Range & Multi-tier Cache
  app.all('/api/sample-pdf', (req: Request, res: Response) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.status(405).end();
      return;
    }
    const id = String(req.query.id || 'bk_sample');
    const code = String(req.query.code || 'BK-001');
    const title = String(req.query.title || 'Komik Nusantara');
    const author = String(req.query.author || 'Penulis Baca Komik');
    const category = String(req.query.category || 'Petualangan');
    const year = parseInt(String(req.query.year || '2026'), 10) || 2026;
    const publisher = String(req.query.publisher || 'Pustaka Baca Komik');

    const cacheKey = `sample:${id}:${code}:${title}:${author}:${category}:${year}`;
    let cached = readPdfFromCache(cacheKey);
    let cacheStatus = 'HIT';

    if (!cached) {
      cacheStatus = 'MISS';
      const buffer = generateSampleComicPdf({
        id,
        code,
        title,
        author,
        category,
        year,
        publisher,
      });
      cached = {
        buffer,
        contentType: 'application/pdf',
        recoverySource: 'original',
        lastAccess: Date.now(),
      };
      writePdfToCache(cacheKey, cached);
    }

    sendBufferWithRange(req, res, cached.buffer, {
      'X-Cache': cacheStatus,
      'X-Recovery-Source': 'original',
    });
  });

  // 2. Smart PDF Proxy with RAM + Disk Cache, Request Deduplication, HTTP Range, and HTTPS/Wayback Recovery
  app.all('/api/proxy-pdf', async (req: Request, res: Response) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    const rawUrl = String(req.query.url || '').trim();
    if (!rawUrl || (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://'))) {
      res.status(400).json({ error: 'Parameter url harus berupa URL http/https yang valid.' });
      return;
    }

    const cacheKey = `proxy:${rawUrl}`;
    const existing = readPdfFromCache(cacheKey);
    if (existing) {
      sendBufferWithRange(req, res, existing.buffer, {
        'X-Cache': 'HIT',
        'X-Recovery-Source': existing.recoverySource,
      });
      return;
    }

    const normalizedUrl = normalizeDriveDownloadUrl(rawUrl);

    // Fast HEAD without downloading the entire file
    if (req.method === 'HEAD') {
      try {
        const headRes = await fetch(normalizedUrl, {
          method: 'HEAD',
          redirect: 'follow',
          signal: AbortSignal.timeout(10000),
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          },
        });
        if (headRes.ok) {
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Accept-Ranges', headRes.headers.get('accept-ranges') || 'bytes');
          const len = headRes.headers.get('content-length');
          if (len) res.setHeader('Content-Length', len);
          res.setHeader('X-Cache', 'MISS');
          res.setHeader('X-Recovery-Source', 'original');
          res.status(200).end();
          return;
        }
      } catch {
        // Fall through to recovery check
      }
    }

    // Fast upstream HTTP Range passthrough so PDF.js only downloads initial byte chunks for Page-1 covers
    const rangeHeader = req.headers.range;
    if (req.method === 'GET' && rangeHeader && rangeHeader.startsWith('bytes=')) {
      try {
        const rangeRes = await fetch(normalizedUrl, {
          redirect: 'follow',
          signal: AbortSignal.timeout(15000),
          headers: {
            Range: rangeHeader,
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          },
        });
        if (rangeRes.status === 206) {
          const buf = Buffer.from(await rangeRes.arrayBuffer());
          res.status(206);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Accept-Ranges', 'bytes');
          const cr = rangeRes.headers.get('content-range');
          if (cr) res.setHeader('Content-Range', cr);
          res.setHeader('Content-Length', String(buf.length));
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.setHeader(
            'Access-Control-Expose-Headers',
            'Content-Range, Accept-Ranges, Content-Length, X-Cache, X-Recovery-Source'
          );
          res.setHeader('X-Cache', 'BYPASS-RANGE');
          res.setHeader('X-Recovery-Source', 'original');
          res.end(buf);
          return;
        }
      } catch {
        // Fall through to full fetch + recovery
      }
    }

    try {
      let pending = inFlightFetches.get(cacheKey);
      if (!pending) {
        pending = fetchWithRecovery(rawUrl).then((entry) => {
          writePdfToCache(cacheKey, entry);
          return entry;
        });
        inFlightFetches.set(cacheKey, pending);
      }

      const entry = await pending.finally(() => {
        inFlightFetches.delete(cacheKey);
      });

      sendBufferWithRange(req, res, entry.buffer, {
        'X-Cache': 'MISS',
        'X-Recovery-Source': entry.recoverySource,
      });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Gagal memuat PDF dari sumber eksternal.',
      });
    }
  });

  // 3. Member Authentication & Server-Synced Favorites
  app.post('/api/member/login', (req: Request, res: Response) => {
    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!username || !password) {
      res.status(400).json({ error: 'Username dan password wajib diisi.' });
      return;
    }

    const members = loadMembers();
    const member = members.find((m) => m.username.toLowerCase() === username);
    if (!member || !verifyPassword(password, member.passwordHash)) {
      res.status(401).json({ error: 'Username atau password anggota salah.' });
      return;
    }
    if (!member.active) {
      res.status(403).json({ error: 'Akun anggota ini sedang dinonaktifkan oleh administrator.' });
      return;
    }

    const token = signMemberToken(member);
    res.setHeader(
      'Set-Cookie',
      `baca_komik_member=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
    );
    res.json({
      token,
      member: sanitizeMemberPublic(member),
    });
  });

  app.post('/api/member/logout', (_req: Request, res: Response) => {
    res.setHeader('Set-Cookie', 'baca_komik_member=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
    res.json({ ok: true });
  });

  app.get('/api/member/me', (req: Request, res: Response) => {
    const token = extractMemberToken(req);
    const payload = verifyMemberToken(token);
    if (!payload) {
      res.status(401).json({ error: 'Sesi anggota tidak valid atau telah kedaluwarsa.' });
      return;
    }
    const members = loadMembers();
    const member = members.find((m) => m.id === payload.sub);
    if (!member || !member.active) {
      res.status(401).json({ error: 'Akun anggota tidak aktif.' });
      return;
    }
    res.json({ member: sanitizeMemberPublic(member) });
  });

  app.post('/api/member/favorites', (req: Request, res: Response) => {
    const token = extractMemberToken(req);
    const payload = verifyMemberToken(token);
    if (!payload) {
      res.status(401).json({ error: 'Silakan masuk sebagai anggota untuk menyinkronkan favorit.' });
      return;
    }
    const bookId = String(req.body?.bookId || '').trim();
    const action = String(req.body?.action || 'toggle');
    if (!bookId) {
      res.status(400).json({ error: 'ID buku wajib disertakan.' });
      return;
    }

    const members = loadMembers();
    const idx = members.findIndex((m) => m.id === payload.sub);
    if (idx === -1) {
      res.status(404).json({ error: 'Anggota tidak ditemukan.' });
      return;
    }

    const currentFavs = new Set(members[idx].favorites || []);
    if (action === 'add') {
      currentFavs.add(bookId);
    } else if (action === 'remove') {
      currentFavs.delete(bookId);
    } else {
      if (currentFavs.has(bookId)) currentFavs.delete(bookId);
      else currentFavs.add(bookId);
    }

    members[idx].favorites = Array.from(currentFavs);
    members[idx].updatedAt = new Date().toISOString();
    saveMembers(members);

    res.json({ favorites: members[idx].favorites });
  });

  // 4. Book Read & Download Statistics
  app.get('/api/stats', (_req: Request, res: Response) => {
    res.json({ stats: loadStats() });
  });

  app.post('/api/stats/track', (req: Request, res: Response) => {
    const bookId = String(req.body?.bookId || '').trim();
    const type = req.body?.type === 'download' ? 'download' : 'read';
    if (!bookId) {
      res.status(400).json({ error: 'bookId diperlukan.' });
      return;
    }
    const entry = trackBookStat(bookId, type);
    res.json({ bookId, stat: entry });
  });

  // 5. Admin Member Management (Google Firebase ID Token Protected)
  app.get('/api/admin/members', requireAdmin, (_req: Request, res: Response) => {
    const members = loadMembers().map(sanitizeMemberPublic);
    res.json({ members });
  });

  app.post('/api/admin/members', requireAdmin, (req: Request, res: Response) => {
    const username = String(req.body?.username || '').trim();
    const fullName = String(req.body?.fullName || '').trim();
    const password = String(req.body?.password || '');
    const active = req.body?.active !== false;

    if (!/^[a-zA-Z0-9_.-]{3,50}$/.test(username)) {
      res.status(400).json({ error: 'Username harus 3–50 karakter (huruf, angka, titik, garis bawah, atau hubung).' });
      return;
    }
    if (!fullName || fullName.length > 120) {
      res.status(400).json({ error: 'Nama lengkap wajib diisi (maks 120 karakter).' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password minimal 6 karakter.' });
      return;
    }

    const members = loadMembers();
    if (members.some((m) => m.username.toLowerCase() === username.toLowerCase())) {
      res.status(409).json({ error: 'Username sudah digunakan anggota lain.' });
      return;
    }

    const now = new Date().toISOString();
    const newMember: ServerMember = {
      id: `mem_${crypto.randomBytes(6).toString('hex')}`,
      username,
      fullName,
      passwordHash: hashPassword(password),
      active,
      favorites: [],
      createdAt: now,
      updatedAt: now,
    };
    members.unshift(newMember);
    saveMembers(members);

    res.status(201).json({ member: sanitizeMemberPublic(newMember) });
  });

  app.put('/api/admin/members/:id', requireAdmin, (req: Request, res: Response) => {
    const memberId = String(req.params.id || '');
    const members = loadMembers();
    const idx = members.findIndex((m) => m.id === memberId);
    if (idx === -1) {
      res.status(404).json({ error: 'Anggota tidak ditemukan.' });
      return;
    }

    const username = req.body?.username !== undefined ? String(req.body.username).trim() : members[idx].username;
    const fullName = req.body?.fullName !== undefined ? String(req.body.fullName).trim() : members[idx].fullName;
    const active = req.body?.active !== undefined ? Boolean(req.body.active) : members[idx].active;
    const newPassword = req.body?.password ? String(req.body.password) : '';

    if (!/^[a-zA-Z0-9_.-]{3,50}$/.test(username)) {
      res.status(400).json({ error: 'Format username tidak valid.' });
      return;
    }
    if (!fullName) {
      res.status(400).json({ error: 'Nama lengkap wajib diisi.' });
      return;
    }
    if (
      members.some(
        (m, mIdx) => mIdx !== idx && m.username.toLowerCase() === username.toLowerCase()
      )
    ) {
      res.status(409).json({ error: 'Username sudah digunakan.' });
      return;
    }

    members[idx].username = username;
    members[idx].fullName = fullName;
    members[idx].active = active;
    if (newPassword) {
      if (newPassword.length < 6) {
        res.status(400).json({ error: 'Password baru minimal 6 karakter.' });
        return;
      }
      members[idx].passwordHash = hashPassword(newPassword);
    }
    members[idx].updatedAt = new Date().toISOString();
    saveMembers(members);

    res.json({ member: sanitizeMemberPublic(members[idx]) });
  });

  app.delete('/api/admin/members/:id', requireAdmin, (req: Request, res: Response) => {
    const memberId = String(req.params.id || '');
    const members = loadMembers();
    const next = members.filter((m) => m.id !== memberId);
    if (next.length === members.length) {
      res.status(404).json({ error: 'Anggota tidak ditemukan.' });
      return;
    }
    saveMembers(next);
    res.json({ ok: true });
  });

  // 6. Admin Web Scraper for External E-Book / Comic PDF Lists & Google Drive Folders
  app.post('/api/admin/scrape-ebooks', requireAdmin, async (req: Request, res: Response) => {
    const targetUrl = String(req.body?.url || '').trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      res.status(400).json({ error: 'URL halaman web harus diawali http:// atau https://' });
      return;
    }

    try {
      // Special support for Google Drive Folder URLs
      const folderMatch = targetUrl.match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]+)/i);
      if (folderMatch && folderMatch[1]) {
        const folderId = folderMatch[1];
        const embedUrl = `https://drive.google.com/embeddedfolderview?id=${folderId}#list`;
        const folderRes = await fetch(embedUrl, {
          redirect: 'follow',
          signal: AbortSignal.timeout(15000),
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          },
        });
        if (!folderRes.ok) {
          res.status(502).json({ error: `Gagal membuka folder Google Drive (HTTP ${folderRes.status}). Pastikan akses folder disetel publik.` });
          return;
        }
        const html = await folderRes.text();
        const $ = cheerio.load(html);
        const items: Array<{
          title: string;
          author: string;
          category: string;
          year: number;
          pdfUrl: string;
          description: string;
        }> = [];
        const seenIds = new Set<string>();

        $('.flip-entry').each((_idx, el) => {
          const href = ($(el).find('a').attr('href') || '').trim();
          const rawName = $(el).find('.flip-entry-title').text().trim();
          const idMatch = href.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
          const fileId = idMatch?.[1];
          if (!fileId || seenIds.has(fileId)) return;
          if (!rawName.toLowerCase().endsWith('.pdf')) return;
          seenIds.add(fileId);

          const cleanTitle = rawName.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
          items.push({
            title: cleanTitle || 'Dokumen PDF Drive',
            author: 'Pustaka Nusantara',
            category: 'Sejarah & Budaya',
            year: 2026,
            pdfUrl: `https://drive.google.com/file/d/${fileId}/view`,
            description: `Diimpor dari folder Google Drive (${rawName}).`,
          });
        });

        res.json({
          sourceTitle: `Google Drive Folder (${folderId})`,
          count: items.length,
          items: items.slice(0, 150),
        });
        return;
      }

      const response = await fetch(targetUrl, {
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,*/*',
        },
      });
      if (!response.ok) {
        res.status(502).json({ error: `Gagal mengambil halaman (HTTP ${response.status}).` });
        return;
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      const pageTitle = $('title').first().text().trim();
      const seenUrls = new Set<string>();
      const items: Array<{
        title: string;
        author: string;
        category: string;
        year: number;
        pdfUrl: string;
        description: string;
      }> = [];

      const baseUrl = new URL(targetUrl);

      $('a[href]').each((_idx, el) => {
        const href = ($(el).attr('href') || '').trim();
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

        let resolved: string;
        try {
          resolved = new URL(href, baseUrl).toString();
        } catch {
          return;
        }

        const lower = resolved.toLowerCase();
        const isPdfLink =
          lower.includes('.pdf') ||
          lower.includes('drive.google.com/file/d/') ||
          lower.includes('drive.google.com/open?id=') ||
          lower.includes('export=download');

        if (!isPdfLink || seenUrls.has(resolved)) return;
        seenUrls.add(resolved);

        let linkText = $(el).text().replace(/\s+/g, ' ').trim();
        if (!linkText || /^(download|unduh|baca|pdf|klik di sini|link|view)$/i.test(linkText)) {
          const parentText = $(el)
            .closest('li, tr, article, div, p')
            .clone()
            .find('a')
            .remove()
            .end()
            .text()
            .replace(/\s+/g, ' ')
            .trim();
          const headingText = $(el)
            .closest('article, section, div')
            .find('h1, h2, h3, h4, strong')
            .first()
            .text()
            .trim();
          linkText = headingText || parentText || '';
        }

        if (!linkText) {
          try {
            const u = new URL(resolved);
            const seg = decodeURIComponent(u.pathname.split('/').pop() || 'Komik Digital');
            linkText = seg.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();
          } catch {
            linkText = 'Komik Digital';
          }
        }

        // Clean title & infer year if present
        const yearMatch = linkText.match(/\b(19\d{2}|20\d{2})\b/);
        const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
        const cleanedTitle = linkText
          .replace(/\[?pdf\]?/gi, '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 180);

        // Try extracting author after " - " or " oleh "
        let title = cleanedTitle;
        let author = 'Koleksi Web';
        const byMatch = cleanedTitle.match(/^(.+?)\s+(?:oleh|by|-|—)\s+(.+)$/i);
        if (byMatch && byMatch[1].length > 3 && byMatch[2].length > 2) {
          title = byMatch[1].trim();
          author = byMatch[2].trim().slice(0, 100);
        }

        items.push({
          title: title || 'E-Book PDF',
          author,
          category: 'Komik & Grafis',
          year,
          pdfUrl: resolved,
          description: `Diimpor dari ${baseUrl.hostname}${pageTitle ? ` (${pageTitle.slice(0, 80)})` : ''}.`,
        });
      });

      res.json({
        sourceTitle: pageTitle || baseUrl.hostname,
        count: items.length,
        items: items.slice(0, 100),
      });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Gagal memindai halaman web target.',
      });
    }
  });

  // 7. Admin Auto-Fill Metadata (Gemini Server-Side + OpenLibrary ISBN + Heuristic)
  app.post('/api/admin/autofill', requireAdmin, async (req: Request, res: Response) => {
    const title = String(req.body?.title || '').trim();
    const author = String(req.body?.author || '').trim();
    const isbn = String(req.body?.isbn || '').trim();
    const pdfUrl = String(req.body?.pdfUrl || '').trim();

    if (!title && !author && !isbn && !pdfUrl) {
      res.status(400).json({ error: 'Isi minimal satu dari judul, penulis, ISBN, atau URL PDF.' });
      return;
    }

    // Optional OpenLibrary lookup if ISBN provided
    let olData: {
      title?: string;
      authors?: string[];
      publishers?: string[];
      publishDate?: string;
      numberOfPages?: number;
    } | null = null;

    if (isbn) {
      const cleanIsbn = isbn.replace(/[^0-9Xx]/g, '');
      if (cleanIsbn.length >= 10) {
        try {
          const olRes = await fetch(
            `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`,
            { signal: AbortSignal.timeout(5000) }
          );
          if (olRes.ok) {
            const olJson = (await olRes.json()) as Record<string, any>;
            const rec = olJson[`ISBN:${cleanIsbn}`];
            if (rec) {
              olData = {
                title: rec.title,
                authors: Array.isArray(rec.authors) ? rec.authors.map((a: any) => a.name) : [],
                publishers: Array.isArray(rec.publishers) ? rec.publishers.map((p: any) => p.name) : [],
                publishDate: rec.publish_date,
                numberOfPages: rec.number_of_pages,
              };
            }
          }
        } catch {
          // Ignore OpenLibrary timeout
        }
      }
    }

    // Use Gemini API on server if GEMINI_API_KEY is configured
    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const promptText = [
          'Lengkapi metadata katalog perpustakaan digital "Baca Komik" dalam Bahasa Indonesia yang akurat dan ringkas.',
          title ? `Judul: ${title}` : '',
          author ? `Penulis: ${author}` : '',
          isbn ? `ISBN: ${isbn}` : '',
          pdfUrl ? `URL PDF: ${pdfUrl}` : '',
          olData ? `Referensi OpenLibrary: ${JSON.stringify(olData)}` : '',
          'Pilih kategori yang paling sesuai dari: Aksi & Petualangan, Fantasi & Sihir, Komik Nusantara, Misteri & Detektif, Sci-Fi & Futuristik, Slice of Life, Sejarah & Budaya, Edukasi & Sains.',
          'Jika URL PDF mengandung nama file, ekstrak judul yang rapi tanpa ekstensi .pdf atau karakter underscore.',
        ]
          .filter(Boolean)
          .join('\n');

        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: promptText,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                author: { type: Type.STRING },
                category: { type: Type.STRING },
                year: { type: Type.INTEGER },
                publisher: { type: Type.STRING },
                language: { type: Type.STRING },
                pages: { type: Type.INTEGER },
                description: { type: Type.STRING },
              },
              required: ['title', 'author', 'category', 'year', 'publisher', 'language', 'pages', 'description'],
            },
          },
        });

        if (response.text) {
          const parsed = JSON.parse(response.text);
          res.json({ suggestion: parsed, source: 'gemini' });
          return;
        }
      } catch {
        // Fall through to deterministic enrichment if Gemini key missing or unavailable
      }
    }

    // Deterministic enrichment fallback (from OpenLibrary + URL filename parsing)
    let inferredTitle = olData?.title || title;
    if (!inferredTitle && pdfUrl) {
      try {
        const pathname = new URL(pdfUrl).pathname;
        const filename = decodeURIComponent(pathname.split('/').pop() || '');
        inferredTitle = filename.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();
      } catch {
        inferredTitle = 'Komik Digital Baru';
      }
    }

    const yearFromDate = olData?.publishDate?.match(/\b(19\d{2}|20\d{2})\b/)?.[1];
    res.json({
      source: olData ? 'openlibrary' : 'metadata',
      suggestion: {
        title: inferredTitle || 'Komik Digital Baru',
        author: olData?.authors?.[0] || author || 'Penulis Nusantara',
        category: 'Komik Nusantara',
        year: yearFromDate ? parseInt(yearFromDate, 10) : new Date().getFullYear(),
        publisher: olData?.publishers?.[0] || 'Pustaka Baca Komik',
        language: 'Indonesia',
        pages: olData?.numberOfPages || 48,
        description: `Edisi digital "${inferredTitle || 'komik ini'}" yang tersedia untuk dibaca langsung dan diunduh di perpustakaan Baca Komik.`,
      },
    });
  });

  // Vite dev middleware vs Production static bundle
  const distDir = path.resolve(process.cwd(), 'dist');
  const isProd = process.env.NODE_ENV === 'production' || (process.env.npm_lifecycle_event === 'start' && fs.existsSync(distDir));

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Baca Komik server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
