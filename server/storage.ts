import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface ServerMember {
  id: string;
  username: string;
  fullName: string;
  passwordHash: string;
  active: boolean;
  favorites: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BookStatEntry {
  readCount: number;
  downloadCount: number;
  lastReadAt?: string;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const MEMBERS_FILE = path.join(DATA_DIR, 'members.json');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');
const SECRET_FILE = path.join(DATA_DIR, '.session-secret');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getSessionSecret(): string {
  if (process.env.MEMBER_SESSION_SECRET && process.env.MEMBER_SESSION_SECRET.length >= 16) {
    return process.env.MEMBER_SESSION_SECRET;
  }
  ensureDataDir();
  if (fs.existsSync(SECRET_FILE)) {
    return fs.readFileSync(SECRET_FILE, 'utf8').trim();
  }
  const secret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(SECRET_FILE, secret, { mode: 0o600 });
  return secret;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derived = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derived.length) return false;
  return crypto.timingSafeEqual(keyBuf, derived);
}

export interface MemberTokenPayload {
  sub: string;
  username: string;
  exp: number;
}

export function signMemberToken(member: ServerMember): string {
  const payload: MemberTokenPayload = {
    sub: member.id,
    username: member.username,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyMemberToken(token: string | undefined): MemberTokenPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  const sigBuf = Buffer.from(sig, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as MemberTokenPayload;
    if (!payload.sub || !payload.exp || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function loadMembers(): ServerMember[] {
  ensureDataDir();
  if (!fs.existsSync(MEMBERS_FILE)) {
    const now = new Date().toISOString();
    const initial: ServerMember[] = [
      {
        id: 'member_demo_1',
        username: 'pembaca',
        fullName: 'Anggota Baca Komik',
        passwordHash: hashPassword('komik2026'),
        active: true,
        favorites: ['bk_001', 'bk_002'],
        createdAt: now,
        updatedAt: now,
      },
    ];
    fs.writeFileSync(MEMBERS_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  try {
    const raw = fs.readFileSync(MEMBERS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMembers(members: ServerMember[]): void {
  ensureDataDir();
  fs.writeFileSync(MEMBERS_FILE, JSON.stringify(members, null, 2));
}

export function loadStats(): Record<string, BookStatEntry> {
  ensureDataDir();
  if (!fs.existsSync(STATS_FILE)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(STATS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function trackBookStat(bookId: string, type: 'read' | 'download'): BookStatEntry {
  const stats = loadStats();
  const entry = stats[bookId] || { readCount: 0, downloadCount: 0 };
  if (type === 'read') {
    entry.readCount += 1;
    entry.lastReadAt = new Date().toISOString();
  } else {
    entry.downloadCount += 1;
  }
  stats[bookId] = entry;
  ensureDataDir();
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
  return entry;
}
