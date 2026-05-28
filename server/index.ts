import express from 'express';
import cors from 'cors';
import path from 'path';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import db, { DATA_DIR } from './database';

const _dirname = path.resolve(); // Fallback for various environments

const app = express();
app.set('trust proxy', 1);
const PORT = parseInt(process.env.PORT || '3000');
const JWT_SECRET = process.env.JWT_SECRET || 'viewtube-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET + '-refresh';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_DAYS = 30;
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const APP_TZ = process.env.TZ || 'Europe/Athens';

function zonedDateParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  return parts as Record<string, string>;
}
function localDateString(date = new Date()) {
  const p = zonedDateParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}
function localDateTimeString(date = new Date()) {
  const p = zonedDateParts(date);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR));

const distPath = path.join(_dirname, 'dist');
if (process.env.NODE_ENV === 'production') {
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
  }
}

// ══════════════════════════════════════════
// RATE LIMITING
// ══════════════════════════════════════════

function getRoleFromAccessToken(req: express.Request): string | null {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return decoded?.role || null;
  } catch {
    return null;
  }
}

function isAdminRequest(req: express.Request): boolean {
  try {
    // Authenticated admin via access token
    if (getRoleFromAccessToken(req) === 'admin') return true;

    // Admin login attempt by identifier (email or username)
    if (req.path.includes('/auth/login')) {
      const id = (req.body as any)?.identifier || (req.body as any)?.email;
      if (!id) return false;
      const user = db.prepare('SELECT role FROM channels WHERE email = ? OR username = ?').get(id, id) as any;
      return user?.role === 'admin';
    }

    // Admin refresh attempt by refresh token
    if (req.path.includes('/auth/refresh')) {
      const refreshToken = (req.body as any)?.refreshToken;
      if (!refreshToken) return false;
      const row = db.prepare('SELECT c.role FROM refresh_tokens rt JOIN channels c ON c.id = rt.channel_id WHERE rt.token = ?').get(refreshToken) as any;
      return row?.role === 'admin';
    }
  } catch (err) {
    console.error('Error in isAdminRequest:', err);
  }

  return false;
}

// Reusable helper to log administrative actions
export function logAdminAction(req: any, action: string, details: string) {
  const adminId = req?.user?.id || 'system';
  try {
    const id = `log-${uuidv4()}`;
    db.prepare('INSERT INTO admin_logs (id, action, channel_id, details, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))')
      .run(id, action, adminId, details);
  } catch (err) {
    console.error('Failed to log admin action:', err);
  }
}

// Strict: auth endpoints — 10 requests per 15 minutes per IP
// Admin accounts are exempt.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isAdminRequest(req),
  message: { error: 'Too many attempts. Please try again later.' },
});

// General: all API — 200 requests per minute per IP
// Authenticated admins are exempt.
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isAdminRequest(req),
  message: { error: 'Too many requests. Please slow down.' },
});

app.use('/api/', generalLimiter);

// Upload limiter — custom by authenticated user role
// user: 20/hour, vip: 50/hour, vip+: 100/hour, vip++: 200/hour, admin: unlimited
const uploadAttempts = new Map<string, number[]>();
function uploadLimiter(req: any, res: any, next: any) {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (user.role === 'admin') return next();

  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  
  let limit = 20;
  if (user.role === 'vip') limit = 50;
  else if (user.role === 'vip+') limit = 100;
  else if (user.role === 'vip++') limit = 200;

  const key = user.id;
  const timestamps = (uploadAttempts.get(key) || []).filter((ts) => now - ts < windowMs);

  if (timestamps.length >= limit) {
    return res.status(429).json({
      error: `${user.role.toUpperCase()} upload limit reached (${limit}/hour). Please try again later.`,
    });
  }

  timestamps.push(now);
  uploadAttempts.set(key, timestamps);
  next();
}

// ── Multer setup ──
const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    const sub = file.mimetype.startsWith('video/') ? 'videos' : file.fieldname === 'banner' ? 'banners' : file.fieldname === 'avatar' ? 'avatars' : 'thumbnails';
    cb(null, path.join(UPLOAD_DIR, sub));
  },
  filename: (_req, file, cb) => {
    const sub = file.mimetype.startsWith('video/') ? 'videos' : file.fieldname === 'banner' ? 'banners' : file.fieldname === 'avatar' ? 'avatars' : 'thumbnails';
    const dir = path.join(UPLOAD_DIR, sub);
    cb(null, uniqueFileName(file.originalname, dir));
  },
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 * 1024 } });

function sanitizeBaseName(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._ -]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/ /g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120) || 'file';
}

function uniqueFileName(originalName: string, destDir: string) {
  const parsed = path.parse(originalName);
  const ext = parsed.ext || '';
  const safeBase = sanitizeBaseName(parsed.name);
  let candidate = `${safeBase}${ext}`;
  let counter = 2;
  while (fs.existsSync(path.join(destDir, candidate))) {
    candidate = `${safeBase}-${counter}${ext}`;
    counter++;
  }
  return candidate;
}

function categoryFolderName(category?: string) {
  return sanitizeBaseName(category || 'Uncategorized');
}

function ensureCategoryVideoDir(category?: string) {
  const dir = path.join(UPLOAD_DIR, 'videos', categoryFolderName(category));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function deriveStorageCategoryFromPath(videoPath: string | null | undefined) {
  if (!videoPath) return null;
  const relative = path.relative(path.join(UPLOAD_DIR, 'videos'), videoPath);
  const first = relative.split(path.sep)[0];
  if (!first || first === relative) return null;
  return first;
}

// ══════════════════════════════════════════
// AUTH HELPERS
// ══════════════════════════════════════════

function generateAccessToken(userId: string, role: string): string {
  return jwt.sign({ id: userId, role }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

function generateRefreshToken(userId: string): string {
  const token = crypto.randomBytes(40).toString('hex');
  const id = uuidv4();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Clean up old tokens for this user (keep max 5 sessions)
  const existing = db.prepare('SELECT id FROM refresh_tokens WHERE channel_id = ? ORDER BY created_at DESC').all(userId) as any[];
  if (existing.length >= 5) {
    const toDelete = existing.slice(4).map((r: any) => r.id);
    toDelete.forEach((rid: string) => db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(rid));
  }

  db.prepare('INSERT INTO refresh_tokens (id, channel_id, token, expires_at) VALUES (?, ?, ?, ?)').run(id, userId, token, expiresAt);
  return token;
}

function formatUser(user: any) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    bannerImage: user.banner_image,
    description: user.description,
    subscriberCount: user.subscriber_count,
    role: user.role,
    notificationsEnabled: !!user.notifications_enabled,
    mustChangePassword: !!user.must_change_password,
    country: user.country,
    likedVideos: (db.prepare(`SELECT video_id FROM video_likes WHERE channel_id = ? AND type = 'like'`).all(user.id) as any[]).map((v) => v.video_id),
    dislikedVideos: (db.prepare(`SELECT video_id FROM video_likes WHERE channel_id = ? AND type = 'dislike'`).all(user.id) as any[]).map((v) => v.video_id),
    subscribers: [],
    bellEnabled: user.bell_enabled !== 0,
    audioChimeEnabled: user.audio_chime_enabled !== 0,
    siteNotificationsEnabled: user.site_notifications_enabled !== 0,
  };
}

function issueTokens(user: any) {
  const accessToken = generateAccessToken(user.id, user.role);
  const refreshToken = generateRefreshToken(user.id);
  return { accessToken, refreshToken, user: formatUser(user) };
}

// ── Auth middleware ──
function auth(req: any, _res: any, next: any) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { req.user = null; return next(); }
  try { req.user = jwt.verify(token, JWT_SECRET) as any; } catch { req.user = null; }
  next();
}
function requireAuth(req: any, res: any, next: any) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ── Hierarchy Helpers ──
const ROLE_WEIGHTS: Record<string, number> = {
  'guest': -1,
  'user': 0,
  'vip': 1,
  'vip+': 2,
  'vip++': 3,
  'moderator': 1.5,
  'moderator_vip_plus': 2.5,
  'moderator_vip_plus_plus': 3.5,
  'admin': 4
};

const VISIBILITY_WEIGHTS: Record<string, number> = {
  'public': -1,
  'unlisted': -1,
  'user': 0,
  'vip': 1,
  'vip+': 2,
  'vip++': 3,
  'private': 100 // only owner/admin
};

function getRoleWeight(id: string, role: string): number {
  if (id === 'ch-admin') return 100;
  switch (role) {
    case 'admin': return 99;
    case 'moderator_vip_plus_plus': return 12;
    case 'moderator_vip_plus': return 11;
    case 'moderator': return 10;
    case 'vip++': return 4;
    case 'vip+': return 3;
    case 'vip': return 2;
    case 'user': return 1;
    default: return 0;
  }
}

function isUserMuted(userId: string): { muted: boolean; mutedUntil?: string } {
  try {
    const row = db.prepare('SELECT muted_until FROM channels WHERE id = ?').get(userId) as any;
    if (row?.muted_until) {
      if (new Date(row.muted_until) > new Date()) {
        return { muted: true, mutedUntil: row.muted_until };
      } else {
        // Natural expiration of mute
        db.prepare('UPDATE channels SET muted_until = NULL WHERE id = ?').run(userId);
      }
    }
  } catch (err) {
    console.error('Error checking mute status:', err);
  }
  return { muted: false };
}

function checkMuted(req: any, res: any, next: any) {
  const muteCheck = isUserMuted(req.user.id);
  if (muteCheck.muted) {
    return res.status(403).json({ error: `You are muted and cannot perform this action. Your mute expires on ${muteCheck.mutedUntil}.` });
  }
  next();
}

function canSeeVideo(userRole: string, videoVisibility: string, isOwner: boolean): boolean {
  if (isOwner) return true;
  const userWeight = ROLE_WEIGHTS[userRole] ?? -1;
  const videoWeight = VISIBILITY_WEIGHTS[videoVisibility] ?? -1;
  
  if (userRole === 'admin') return true;
  if (videoVisibility === 'unlisted') return true; // Direct link access
  if (videoVisibility === 'private') return isOwner;
  
  return userWeight >= videoWeight;
}

// ── Helper: get video with categories + channel info ──
function getVideoFull(row: any) {
  if (!row) return null;
  const cats = db.prepare('SELECT category_name FROM video_categories WHERE video_id = ?').all(row.id) as any[];
  const ch = db.prepare('SELECT name, avatar, role FROM channels WHERE id = ?').get(row.channel_id) as any;
  return {
    id: row.id, title: row.title, description: row.description,
    thumbnailUrl: row.thumbnail_url, videoUrl: row.video_url || row.video_path,
    duration: row.duration, views: row.views, likes: row.likes, dislikes: row.dislikes,
    uploadDate: row.upload_date, channelId: row.channel_id,
    channelName: ch?.name || '', channelAvatar: ch?.avatar || '',
    channelRole: ch?.role || 'user',
    visibility: row.visibility, categories: cats.map((c: any) => c.category_name),
  };
}

// ══════════════════════════════════════════
// AUTH ROUTES
// ══════════════════════════════════════════
app.post('/api/auth/login', authLimiter, (req, res) => {
  const { identifier, password } = req.body;
  try {
    const blocked = db.prepare('SELECT * FROM blacklist WHERE email = ? OR username = ?').get(identifier, identifier) as any;
    if (blocked) {
      if (blocked.banned_until === 'permanent') {
        return res.status(403).json({ error: 'This account has been permanently banned from the platform.' });
      } else {
        const untilDate = new Date(blocked.banned_until);
        if (untilDate > new Date()) {
          const diffTime = untilDate.getTime() - Date.now();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return res.status(403).json({ error: `This account has been banned. Days remaining: ${diffDays} day(s).` });
        } else {
          // Natural ban expiration! Remove from blacklist
          db.prepare('DELETE FROM blacklist WHERE email = ? OR username = ?').run(identifier, identifier);
          db.prepare('UPDATE channels SET banned = 0 WHERE email = ? OR username = ?').run(identifier, identifier);
        }
      }
    }

    const user = db.prepare('SELECT * FROM channels WHERE email = ? OR username = ?').get(identifier, identifier) as any;
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    res.json(issueTokens(user));
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
});

app.post('/api/auth/register', authLimiter, (req, res) => {
  const { name, username, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  if (password.length < 4) return res.status(400).json({ error: 'Password too short' });

  if (!username || !username.trim()) {
    return res.status(400).json({ error: 'Username is required' });
  }

  const cleanUsername = username.trim().toLowerCase();
  
  if (cleanUsername.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters long' });
  }

  if (!/^[a-z0-9_-]+$/.test(cleanUsername)) {
    return res.status(400).json({ error: 'Username can only contain alphanumeric characters, hyphens (-) or underscores (_)' });
  }

  try {
    const blocked = db.prepare('SELECT 1 FROM blacklist WHERE email = ? OR username = ?').get(email.trim().toLowerCase(), cleanUsername);
    if (blocked) {
      return res.status(403).json({ error: 'This email or username is banned / blacklisted from registering.' });
    }

    const existingEmail = db.prepare('SELECT id FROM channels WHERE email = ?').get(email.trim().toLowerCase());
    if (existingEmail) return res.status(409).json({ error: 'Email already in use' });

    const existingUsername = db.prepare('SELECT id FROM channels WHERE username = ?').get(cleanUsername);
    if (existingUsername) return res.status(409).json({ error: 'Username already in use' });

    const existingName = db.prepare('SELECT id FROM channels WHERE LOWER(name) = ?').get(name.trim().toLowerCase());
    if (existingName) return res.status(409).json({ error: 'Channel name already in use' });

    const id = `ch-${uuidv4()}`;
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO channels (id,name,username,email,password) VALUES (?,?,?,?,?)').run(id, name.trim(), cleanUsername, email.trim().toLowerCase(), hash);
    const user = db.prepare('SELECT * FROM channels WHERE id = ?').get(id) as any;
    res.json(issueTokens(user));
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
});

app.get('/api/auth/check-username', (req, res) => {
  const { q } = req.query;
  if (!q) return res.json({ available: false, error: 'Username is required' });
  const username = String(q).trim().toLowerCase();
  if (username.length < 3) {
    return res.json({ available: false, error: 'Must be at least 3 characters' });
  }
  if (!/^[a-z0-9_-]+$/.test(username)) {
    return res.json({ available: false, error: 'Only letters, numbers, hyphens (-) and underscores (_)' });
  }
  const row = db.prepare('SELECT 1 FROM channels WHERE username = ?').get(username);
  return res.json({ available: !row });
});

app.get('/api/auth/check-email', (req, res) => {
  const { q } = req.query;
  if (!q) return res.json({ available: false, error: 'Email is required' });
  const email = String(q).trim().toLowerCase();
  const row = db.prepare('SELECT 1 FROM channels WHERE email = ?').get(email);
  return res.json({ available: !row });
});

app.get('/api/auth/check-name', (req, res) => {
  const { q, excludeId } = req.query;
  if (!q) return res.json({ available: false, error: 'Channel name is required' });
  const name = String(q).trim();
  if (name.length < 2) {
    return res.json({ available: false, error: 'Must be at least 2 characters' });
  }
  let row;
  if (excludeId) {
    row = db.prepare('SELECT 1 FROM channels WHERE LOWER(name) = ? AND id != ?').get(name.toLowerCase(), String(excludeId));
  } else {
    row = db.prepare('SELECT 1 FROM channels WHERE LOWER(name) = ?').get(name.toLowerCase());
  }
  return res.json({ available: !row });
});

app.post('/api/auth/refresh', authLimiter, (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

  const stored = db.prepare('SELECT * FROM refresh_tokens WHERE token = ?').get(refreshToken) as any;
  if (!stored) return res.status(401).json({ error: 'Invalid refresh token' });

  // Check expiry
  if (new Date(stored.expires_at) < new Date()) {
    db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(stored.id);
    return res.status(401).json({ error: 'Refresh token expired' });
  }

  // Rotate: delete old token, issue new pair
  db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(stored.id);
  const user = db.prepare('SELECT * FROM channels WHERE id = ?').get(stored.channel_id) as any;
  if (!user) return res.status(401).json({ error: 'User not found' });

  res.json(issueTokens(user));
});

app.post('/api/auth/logout', auth, (req: any, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);
  }
  // Optionally clear all sessions for this user
  if (req.user?.id && req.body.allDevices) {
    db.prepare('DELETE FROM refresh_tokens WHERE channel_id = ?').run(req.user.id);
  }
  res.json({ ok: true });
});

app.get('/api/auth/me', auth, requireAuth, (req: any, res) => {
  const user = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.user.id) as any;
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(formatUser(user));
});

// Request account/password recovery (no email system yet)
app.post('/api/auth/request-reset', authLimiter, (req, res) => {
  const { identifier, note } = req.body;
  if (!identifier) return res.status(400).json({ error: 'Email or username is required' });
  const user = db.prepare('SELECT id FROM channels WHERE email = ? OR username = ?').get(identifier, identifier) as any;
  const id = `pr-${uuidv4()}`;
  db.prepare('INSERT INTO password_reset_requests (id, channel_id, identifier, note) VALUES (?,?,?,?)').run(id, user?.id || null, identifier, note || '');
  res.json({ ok: true });
});

// ══════════════════════════════════════════
// VIDEO ROUTES
// ══════════════════════════════════════════
app.get('/api/videos', auth, (req: any, res) => {
  const role = req.user?.role || 'guest';
  const userId = req.user?.id || null;

  const limitParam = req.query.limit;
  const pageParam = req.query.page;
  const category = req.query.category;
  const categoriesParam = req.query.categories;
  const matchAllParam = req.query.matchAll === 'true';
  const search = req.query.search;
  const visibility = req.query.visibility;
  const channelId = req.query.channelId;
  const excludeId = req.query.excludeId;
  const sortBy = req.query.sortBy || 'newest';
  const subscribed = req.query.subscribed === 'true';

  const conditions: string[] = [];
  const params: any[] = [];

  // Visibility constraints
  if (role === 'admin') {
    // Admin has god-mode access
  } else if (role === 'moderator_vip_plus_plus') {
    // VIP++ moderator can see:
    // 1. All videos they own
    // 2. All videos up to VIP++ (role is 'user', 'vip', 'vip+', 'vip++') regardless of visibility
    // 3. Regular viewable videos from others (up to 'vip++')
    conditions.push(`(
      channel_id = ? OR 
      channel_id IN (SELECT id FROM channels WHERE role IN ('user', 'vip', 'vip+', 'vip++')) OR
      (visibility IN ('public', 'unlisted', 'user', 'vip', 'vip+', 'vip++') AND channel_id NOT IN (SELECT id FROM channels WHERE id = ?))
    )`);
    params.push(userId, userId);
  } else if (role === 'moderator_vip_plus') {
    // VIP+ moderator can see:
    // 1. All videos they own
    // 2. All videos owned by VIP+/VIP/User, but excluding VIP++ level videos
    // 3. Regular viewable videos up to 'vip+' (explicitly no 'vip++' videos from others)
    conditions.push(`(
      channel_id = ? OR 
      (channel_id IN (SELECT id FROM channels WHERE role IN ('user', 'vip', 'vip+')) AND visibility != 'vip++') OR
      (visibility IN ('public', 'unlisted', 'user', 'vip', 'vip+') AND channel_id NOT IN (SELECT id FROM channels WHERE id = ?))
    )`);
    params.push(userId, userId);
  } else if (role === 'moderator') {
    // Standard moderators can see:
    // 1. All videos they own
    // 2. All videos owned by VIP/User, but excluding VIP++ level videos
    // 3. Regular viewable videos up to 'vip+' (no 'vip++' videos allowed)
    conditions.push(`(
      channel_id = ? OR 
      (channel_id IN (SELECT id FROM channels WHERE role IN ('user', 'vip')) AND visibility != 'vip++') OR
      (visibility IN ('public', 'unlisted', 'user', 'vip', 'vip+') AND channel_id NOT IN (SELECT id FROM channels WHERE id = ?))
    )`);
    params.push(userId, userId);
  } else if (role === 'vip++') {
    conditions.push(`(visibility IN ('public', 'unlisted', 'user', 'vip', 'vip+', 'vip++') OR channel_id = ?)`);
    params.push(userId);
  } else {
    // Other roles and mods DO NOT belong to vip++ or vip++ mod group, so they CANNOT see 'vip++' videos of other users
    conditions.push(`(visibility IN ('public', 'unlisted', 'user', 'vip', 'vip+') OR channel_id = ?)`);
    params.push(userId);
  }

  // Filter criteria
  if (category) {
    conditions.push(`id IN (SELECT video_id FROM video_categories WHERE category_name = ?)`);
    params.push(category);
  } else if (categoriesParam) {
    const cats = String(categoriesParam).split(',').map(s => s.trim()).filter(Boolean);
    if (cats.length > 0) {
      const placeholders = cats.map(() => '?').join(',');
      if (matchAllParam) {
        conditions.push(`id IN (SELECT video_id FROM video_categories WHERE category_name IN (${placeholders}) GROUP BY video_id HAVING COUNT(DISTINCT category_name) = ?)`);
        params.push(...cats, cats.length);
      } else {
        conditions.push(`id IN (SELECT video_id FROM video_categories WHERE category_name IN (${placeholders}))`);
        params.push(...cats);
      }
    }
  }

  if (search) {
    conditions.push(`(title LIKE ? OR description LIKE ?)`);
    params.push(`%${search}%`, `%${search}%`);
  }

  if (visibility) {
    conditions.push(`visibility = ?`);
    params.push(visibility);
  }

  if (channelId) {
    conditions.push(`channel_id = ?`);
    params.push(channelId);
  }

  if (excludeId) {
    conditions.push(`id != ?`);
    params.push(excludeId);
  }

  if (subscribed) {
    if (userId) {
      conditions.push(`channel_id IN (SELECT channel_id FROM subscriptions WHERE subscriber_id = ?)`);
      params.push(userId);
    } else {
      conditions.push(`1 = 0`);
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Sorting
  let orderBy = 'ORDER BY created_at DESC';
  if (sortBy === 'oldest') {
    orderBy = 'ORDER BY created_at ASC';
  } else if (sortBy === 'popular') {
    orderBy = 'ORDER BY views DESC';
  } else if (sortBy === 'likes') {
    orderBy = 'ORDER BY likes DESC';
  } else if (sortBy === 'random') {
    orderBy = 'ORDER BY RANDOM()';
  }

  // Calculate matching rows
  const totalRow = db.prepare(`SELECT COUNT(*) as total FROM videos ${whereClause}`).get(...params) as any;
  const total = totalRow?.total || 0;

  // Pagination parameters
  const limit = limitParam ? parseInt(limitParam as string, 10) : null;
  const page = pageParam ? parseInt(pageParam as string, 10) : 1;

  let queryStr = `SELECT * FROM videos ${whereClause} ${orderBy}`;
  const queryParams = [...params];

  if (limit) {
    const offset = (page - 1) * limit;
    queryStr += ` LIMIT ? OFFSET ?`;
    queryParams.push(limit, offset);
  }

  const rows = db.prepare(queryStr).all(...queryParams);
  const formattedVideos = rows.map(getVideoFull);

  if (limitParam || pageParam) {
    res.json({
      videos: formattedVideos,
      total,
      page,
      limit: limit || 12,
      hasMore: limit ? (page * limit < total) : false,
    });
  } else {
    res.json(formattedVideos);
  }
});

app.get('/api/videos/:id', auth, (req: any, res) => {
  const row = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: 'Not found' });
  
  const role = req.user?.role || 'guest';
  const isOwner = req.user?.id === row.channel_id;

  if (!canSeeVideo(role, row.visibility, isOwner)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.json(getVideoFull(row));
});

app.post('/api/videos/:id/view', auth, (req: any, res) => {
  db.prepare('UPDATE videos SET views = views + 1 WHERE id = ?').run(req.params.id);
  db.prepare('INSERT INTO view_events (video_id, channel_id, created_at) VALUES (?, ?, ?)').run(req.params.id, req.user?.id || null, localDateTimeString());
  res.json({ ok: true });
});

app.post('/api/videos', auth, requireAuth, checkMuted, uploadLimiter, upload.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]), (req: any, res) => {
  const { title, description, visibility, categories, duration } = req.body;
  const videoFile = req.files?.video?.[0];
  const thumbFile = req.files?.thumbnail?.[0];
  const id = `v-${uuidv4()}`;
  const thumbUrl = thumbFile ? `/uploads/thumbnails/${thumbFile.filename}` : '';
  const cats = categories ? JSON.parse(categories) : ['Entertainment'];
  const dur = duration ? parseFloat(duration) : 0;

  let storedVideoPath = '';
  let videoUrl = '';
  if (videoFile) {
    const primaryCategory = Array.isArray(cats) && cats.length > 0 ? cats[0] : 'Entertainment';
    const targetDir = ensureCategoryVideoDir(primaryCategory);
    const finalName = uniqueFileName(videoFile.originalname, targetDir);
    const finalPath = path.join(targetDir, finalName);
    // Move from temporary root upload into category folder
    fs.renameSync(videoFile.path, finalPath);
    storedVideoPath = finalPath;
    videoUrl = `/uploads/videos/${categoryFolderName(primaryCategory)}/${finalName}`;
  }

  db.prepare('INSERT INTO videos (id,title,description,thumbnail_url,video_url,video_path,mime_type,file_size,duration,channel_id,visibility) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, title || 'Untitled', description || '', thumbUrl, videoUrl, storedVideoPath, videoFile?.mimetype || 'video/mp4', videoFile?.size || 0, dur, req.user.id, visibility || 'public');

  const insertVC = db.prepare('INSERT OR IGNORE INTO video_categories (video_id,category_name) VALUES (?,?)');
  cats.forEach((c: string) => insertVC.run(id, c));

  res.json(getVideoFull(db.prepare('SELECT * FROM videos WHERE id = ?').get(id)));
});

app.put('/api/videos/:id', auth, requireAuth, (req: any, res) => {
  const { title, description, visibility, categories, forceMove } = req.body;
  const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id) as any;
  if (!video) return res.status(404).json({ error: 'Not found' });

  const caller = db.prepare('SELECT role FROM channels WHERE id = ?').get(req.user.id) as any;
  const callerRole = caller?.role || 'user';

  let canEdit = false;
  if (video.channel_id === req.user.id) {
    canEdit = true;
  } else if (callerRole === 'admin') {
    canEdit = true;
  } else if (callerRole === 'moderator') {
    const owner = db.prepare('SELECT role FROM channels WHERE id = ?').get(video.channel_id) as any;
    const ownerRole = owner?.role || 'user';
    if (ownerRole === 'user' || ownerRole === 'vip') {
      canEdit = true;
    }
  }

  if (!canEdit) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (title !== undefined) db.prepare('UPDATE videos SET title = ? WHERE id = ?').run(title, req.params.id);
  if (description !== undefined) db.prepare('UPDATE videos SET description = ? WHERE id = ?').run(description, req.params.id);
  if (visibility !== undefined) db.prepare('UPDATE videos SET visibility = ? WHERE id = ?').run(visibility, req.params.id);

  if (categories) {
    const currentCats = (db.prepare('SELECT category_name FROM video_categories WHERE video_id = ?').all(req.params.id) as any[]).map((r: any) => r.category_name);
    const currentPrimary = currentCats[0] || null;
    const newPrimary = Array.isArray(categories) && categories.length > 0 ? categories[0] : null;

    // Move file to new category folder only if explicitly confirmed by client.
    if (forceMove && newPrimary && currentPrimary && newPrimary !== currentPrimary && video.video_path && fs.existsSync(video.video_path)) {
      const targetDir = ensureCategoryVideoDir(newPrimary);
      const currentName = path.basename(video.video_path);
      const finalName = uniqueFileName(currentName, targetDir);
      const finalPath = path.join(targetDir, finalName);
      fs.renameSync(video.video_path, finalPath);
      const newUrl = `/uploads/videos/${categoryFolderName(newPrimary)}/${finalName}`;
      db.prepare('UPDATE videos SET video_path = ?, video_url = ? WHERE id = ?').run(finalPath, newUrl, req.params.id);
    }

    db.prepare('DELETE FROM video_categories WHERE video_id = ?').run(req.params.id);
    const insertVC = db.prepare('INSERT OR IGNORE INTO video_categories (video_id,category_name) VALUES (?,?)');
    categories.forEach((c: string) => insertVC.run(req.params.id, c));
  }

  res.json(getVideoFull(db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id)));
});

app.delete('/api/videos/:id', auth, requireAuth, (req: any, res) => {
  const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id) as any;
  if (!video) return res.status(404).json({ error: 'Not found' });

  const caller = db.prepare('SELECT role FROM channels WHERE id = ?').get(req.user.id) as any;
  const callerRole = caller?.role || 'user';

  let canDelete = false;
  if (video.channel_id === req.user.id) {
    canDelete = true;
  } else if (callerRole === 'admin') {
    canDelete = true;
  } else if (callerRole === 'moderator') {
    const owner = db.prepare('SELECT role FROM channels WHERE id = ?').get(video.channel_id) as any;
    const ownerRole = owner?.role || 'user';
    if (ownerRole === 'user' || ownerRole === 'vip') {
      canDelete = true;
    }
  }

  if (!canDelete) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  db.prepare('DELETE FROM videos WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Helper: add notification ──
function addNotification(targetId: string, data: { type: string; fromId?: string; fromName?: string; fromAvatar?: string; videoId?: string; videoTitle?: string; commentText?: string; newRole?: string }) {
  const id = `n-${uuidv4()}`;
  db.prepare(`
    INSERT INTO notifications (id, type, target_channel_id, from_channel_id, from_channel_name, from_channel_avatar, video_id, video_title, comment_text, new_role)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.type, targetId, data.fromId || null, data.fromName || null, data.fromAvatar || null, data.videoId || null, data.videoTitle || null, data.commentText || null, data.newRole || null);
}

// ── Likes ──
app.post('/api/videos/:id/like', auth, requireAuth, (req: any, res) => {
  const existing = db.prepare('SELECT type FROM video_likes WHERE channel_id = ? AND video_id = ?').get(req.user.id, req.params.id) as any;
  const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id) as any;
  if (!video) return res.status(404).json({ error: 'Video not found' });

  if (existing?.type === 'like') {
    db.prepare('DELETE FROM video_likes WHERE channel_id = ? AND video_id = ?').run(req.user.id, req.params.id);
    db.prepare('UPDATE videos SET likes = likes - 1 WHERE id = ?').run(req.params.id);
  } else {
    if (existing?.type === 'dislike') db.prepare('UPDATE videos SET dislikes = dislikes - 1 WHERE id = ?').run(req.params.id);
    db.prepare('INSERT OR REPLACE INTO video_likes (channel_id,video_id,type) VALUES (?,?,?)').run(req.user.id, req.params.id, 'like');
    db.prepare('UPDATE videos SET likes = likes + 1 WHERE id = ?').run(req.params.id);
    // Log event for analytics timeline
    db.prepare('INSERT INTO like_events (video_id, channel_id, created_at) VALUES (?, ?, ?)').run(req.params.id, req.user.id, localDateTimeString());

    // Notification for like
    if (video.channel_id !== req.user.id) {
      const me = db.prepare('SELECT name, avatar FROM channels WHERE id = ?').get(req.user.id) as any;
      addNotification(video.channel_id, {
        type: 'like',
        fromId: req.user.id,
        fromName: me?.name,
        fromAvatar: me?.avatar,
        videoId: video.id,
        videoTitle: video.title
      });
    }
  }
  res.json(getVideoFull(db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id)));
});

app.post('/api/videos/:id/dislike', auth, requireAuth, (req: any, res) => {
  const existing = db.prepare('SELECT type FROM video_likes WHERE channel_id = ? AND video_id = ?').get(req.user.id, req.params.id) as any;
  if (existing?.type === 'dislike') {
    db.prepare('DELETE FROM video_likes WHERE channel_id = ? AND video_id = ?').run(req.user.id, req.params.id);
    db.prepare('UPDATE videos SET dislikes = dislikes - 1 WHERE id = ?').run(req.params.id);
  } else {
    if (existing?.type === 'like') db.prepare('UPDATE videos SET likes = likes - 1 WHERE id = ?').run(req.params.id);
    db.prepare('INSERT OR REPLACE INTO video_likes (channel_id,video_id,type) VALUES (?,?,?)').run(req.user.id, req.params.id, 'dislike');
    db.prepare('UPDATE videos SET dislikes = dislikes + 1 WHERE id = ?').run(req.params.id);
  }
  res.json(getVideoFull(db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id)));
});

// ── Stream video ──
app.get('/api/stream/:id', (req, res) => {
  const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id) as any;
  if (!video) return res.status(404).json({ error: 'Not found' });
  const filePath = video.video_path;
  if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  const stat = fs.statSync(filePath);
  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Content-Type': video.mime_type || 'video/mp4' });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Length': stat.size, 'Content-Type': video.mime_type || 'video/mp4' });
    fs.createReadStream(filePath).pipe(res);
  }
});

// ══════════════════════════════════════════
// CHANNELS
// ══════════════════════════════════════════
app.get('/api/channels', auth, (req: any, res) => {
  const rows = db.prepare('SELECT id,name,username,email,avatar,banner_image,description,subscriber_count,role,country,muted_until,banned FROM channels').all();
  res.json(rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    username: r.username || '',
    email: r.email || '',
    avatar: r.avatar,
    bannerImage: r.banner_image,
    description: r.description,
    subscriberCount: r.subscriber_count,
    role: r.role,
    country: r.country,
    subscribers: [],
    mutedUntil: r.muted_until,
    banned: r.banned === 1,
  })));
});

app.put('/api/channels/me', auth, requireAuth, upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), (req: any, res) => {
  const { name, username, description, email, country, notificationsEnabled, password, bellEnabled, audioChimeEnabled, siteNotificationsEnabled } = req.body;
  
  if (name) {
    const cleanName = name.trim();
    if (cleanName.length < 2) {
      return res.status(400).json({ error: 'Channel name must be at least 2 characters' });
    }
    const exists = db.prepare('SELECT id FROM channels WHERE LOWER(name) = ? AND id != ?').get(cleanName.toLowerCase(), req.user.id);
    if (exists) return res.status(409).json({ error: 'Channel name already in use' });
    db.prepare('UPDATE channels SET name = ? WHERE id = ?').run(cleanName, req.user.id);
  }
  if (username) {
    const cleanUsername = username.trim().toLowerCase();
    const user = db.prepare('SELECT username FROM channels WHERE id = ?').get(req.user.id) as any;
    if (req.user.id === 'ch-admin' || !user?.username || user.username === username) {
      if (cleanUsername.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters long' });
      }
      if (!/^[a-z0-9_-]+$/.test(cleanUsername)) {
        return res.status(400).json({ error: 'Username can only contain alphanumeric characters, hyphens (-) or underscores (_)' });
      }
      const exists = db.prepare('SELECT id FROM channels WHERE username = ? AND id != ?').get(cleanUsername, req.user.id);
      if (exists) return res.status(409).json({ error: 'Username already in use' });
      db.prepare('UPDATE channels SET username = ? WHERE id = ?').run(cleanUsername, req.user.id);
    } else {
      // Username already set and trying to change it - ignore or error
      // As per request: "usernames should not be able to be edited after signing up"
    }
  }
  if (description !== undefined) db.prepare('UPDATE channels SET description = ? WHERE id = ?').run(description, req.user.id);
  if (email) db.prepare('UPDATE channels SET email = ? WHERE id = ?').run(email, req.user.id);
  if (country) db.prepare('UPDATE channels SET country = ? WHERE id = ?').run(country, req.user.id);
  if (notificationsEnabled !== undefined) db.prepare('UPDATE channels SET notifications_enabled = ? WHERE id = ?').run(notificationsEnabled === 'true' || notificationsEnabled === true ? 1 : 0, req.user.id);
  if (bellEnabled !== undefined) db.prepare('UPDATE channels SET bell_enabled = ? WHERE id = ?').run(bellEnabled === 'true' || bellEnabled === true ? 1 : 0, req.user.id);
  if (audioChimeEnabled !== undefined) db.prepare('UPDATE channels SET audio_chime_enabled = ? WHERE id = ?').run(audioChimeEnabled === 'true' || audioChimeEnabled === true ? 1 : 0, req.user.id);
  if (siteNotificationsEnabled !== undefined) db.prepare('UPDATE channels SET site_notifications_enabled = ? WHERE id = ?').run(siteNotificationsEnabled === 'true' || siteNotificationsEnabled === true ? 1 : 0, req.user.id);
  if (password) db.prepare('UPDATE channels SET password = ?, must_change_password = 0 WHERE id = ?').run(bcrypt.hashSync(password, 10), req.user.id);
  if (req.files?.avatar?.[0]) db.prepare('UPDATE channels SET avatar = ? WHERE id = ?').run(`/uploads/avatars/${req.files.avatar[0].filename}`, req.user.id);
  if (req.files?.banner?.[0]) db.prepare('UPDATE channels SET banner_image = ? WHERE id = ?').run(`/uploads/banners/${req.files.banner[0].filename}`, req.user.id);
  const user = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.user.id) as any;
  res.json(formatUser(user));
});

app.delete('/api/channels/me', auth, requireAuth, (req: any, res) => {
  const userId = req.user.id;
  
  if (userId === 'ch-admin') {
    return res.status(403).json({ error: 'Main server admin account cannot be deleted' });
  }

  try {
    const deleteTx = db.transaction(() => {
      // 1. Delete comments made by the user, and comments on the user's videos
      db.prepare(`
        DELETE FROM comments 
        WHERE channel_id = ? 
           OR video_id IN (SELECT id FROM videos WHERE channel_id = ?)
      `).run(userId, userId);

      // 2. Delete video likes/dislikes made by the user, and on the user's videos
      db.prepare(`
        DELETE FROM video_likes 
        WHERE channel_id = ? 
           OR video_id IN (SELECT id FROM videos WHERE channel_id = ?)
      `).run(userId, userId);

      // 3. Delete playlist_videos entries for playlists owned by the user, OR videos owned by the user
      db.prepare(`
        DELETE FROM playlist_videos 
        WHERE playlist_id IN (SELECT id FROM playlists WHERE channel_id = ?)
           OR video_id IN (SELECT id FROM videos WHERE channel_id = ?)
      `).run(userId, userId);

      // 4. Delete playlists owned by the user
      db.prepare('DELETE FROM playlists WHERE channel_id = ?').run(userId);

      // 5. Delete video_categories for the user's videos
      db.prepare(`
        DELETE FROM video_categories 
        WHERE video_id IN (SELECT id FROM videos WHERE channel_id = ?)
      `).run(userId);

      // 6. Delete view_events, like_events, sub_events related to this user
      db.prepare('DELETE FROM view_events WHERE channel_id = ? OR video_id IN (SELECT id FROM videos WHERE channel_id = ?)').run(userId, userId);
      db.prepare('DELETE FROM like_events WHERE channel_id = ? OR video_id IN (SELECT id FROM videos WHERE channel_id = ?)').run(userId, userId);
      db.prepare('DELETE FROM sub_events WHERE channel_id = ? OR subscriber_id = ?').run(userId, userId);

      // 7. Delete videos uploaded by the user
      db.prepare('DELETE FROM videos WHERE channel_id = ?').run(userId);

      // 8. Delete subscriptions involving the user (as subscriber or target)
      db.prepare('DELETE FROM subscriptions WHERE subscriber_id = ? OR channel_id = ?').run(userId, userId);

      // 9. Delete notifications targetting or initiated by user
      db.prepare('DELETE FROM notifications WHERE target_channel_id = ? OR from_channel_id = ?').run(userId, userId);

      // 10. Delete refresh tokens
      db.prepare('DELETE FROM refresh_tokens WHERE channel_id = ?').run(userId);

      // 11. Delete password reset requests
      db.prepare('DELETE FROM password_reset_requests WHERE channel_id = ?').run(userId);

      // 12. Delete watch history
      db.prepare('DELETE FROM watch_history WHERE channel_id = ?').run(userId);

      // 13. Finally, delete the channel itself
      db.prepare('DELETE FROM channels WHERE id = ?').run(userId);
    });

    deleteTx();
    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error: any) {
    console.error('Failed to delete account:', error);
    res.status(500).json({ error: 'Failed to delete account: ' + error.message });
  }
});

app.put('/api/channels/:id/role', auth, requireAuth, (req: any, res) => {
  const caller = db.prepare('SELECT role FROM channels WHERE id = ?').get(req.user.id) as any;
  const callerRole = caller?.role || 'user';
  
  const isModRole = callerRole === 'moderator' || callerRole === 'moderator_vip_plus' || callerRole === 'moderator_vip_plus_plus';
  if (callerRole !== 'admin' && !isModRole) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Prevent modifying the Main Admin (ch-admin)
  if (req.params.id === 'ch-admin') {
    return res.status(403).json({ error: 'Forbidden: Main Admin role cannot be modified or revoked' });
  }

  const target = db.prepare('SELECT role FROM channels WHERE id = ?').get(req.params.id) as any;
  const targetRole = target?.role || 'user';
  if (!target) {
    return res.status(404).json({ error: 'User not found' });
  }

  const isTargetProtected = targetRole === 'admin' || targetRole === 'moderator' || targetRole === 'moderator_vip_plus' || targetRole === 'moderator_vip_plus_plus';

  // Only Admin accounts can revoke, modify, or demote existing Admin or Moderator accounts
  if (isTargetProtected) {
    if (callerRole !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Only administrators are authorized to revoke or demote Admin or Moderator roles.' });
    }
  }

  const newRole = req.body.role || 'user';

  // If new role is a mod or admin, caller MUST be an admin
  const isNewRoleProtected = newRole === 'admin' || newRole === 'moderator' || newRole === 'moderator_vip_plus' || newRole === 'moderator_vip_plus_plus';
  if (isNewRoleProtected && callerRole !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Only administrators can promote users to Admin or Moderator groups.' });
  }

  // Handle Moderator bounds
  if (isModRole) {
    if (callerRole === 'moderator') {
      // 1. Can only promote to user or vip
      if (newRole !== 'user' && newRole !== 'vip') {
        return res.status(403).json({ error: 'Forbidden: Standard moderators can only set roles to User or VIP' });
      }
      // 2. Can only touch users who are currently VIP and below
      if (targetRole !== 'user' && targetRole !== 'vip') {
        return res.status(403).json({ error: 'Forbidden: Standard moderators cannot modify users with role higher than VIP' });
      }
    } else if (callerRole === 'moderator_vip_plus') {
      // 1. Can only promote to user, vip, or vip+
      if (newRole !== 'user' && newRole !== 'vip' && newRole !== 'vip+') {
        return res.status(403).json({ error: 'Forbidden: VIP+ moderators can only set roles to User, VIP, or VIP+' });
      }
      // 2. Can only touch users who are currently VIP+ and below
      if (targetRole !== 'user' && targetRole !== 'vip' && targetRole !== 'vip+') {
        return res.status(403).json({ error: 'Forbidden: VIP+ moderators cannot modify users with role higher than VIP+' });
      }
    } else if (callerRole === 'moderator_vip_plus_plus') {
      // 1. Can only promote up to vip++
      if (newRole !== 'user' && newRole !== 'vip' && newRole !== 'vip+' && newRole !== 'vip++') {
        return res.status(403).json({ error: 'Forbidden: VIP++ moderators can only set roles up to VIP++' });
      }
      // 2. Can only touch users who are currently VIP++ and below
      if (targetRole !== 'user' && targetRole !== 'vip' && targetRole !== 'vip+' && targetRole !== 'vip++') {
        return res.status(403).json({ error: 'Forbidden: VIP++ moderators cannot modify users with role higher than VIP++' });
      }
    }
  }

  db.prepare('UPDATE channels SET role = ? WHERE id = ?').run(newRole, req.params.id);
  
  // Notification for role upgrade
  addNotification(req.params.id, {
    type: 'role_upgrade',
    newRole: newRole
  });

  // Log administrative action
  logAdminAction(req, 'ROLE_CHANGE', `Changed user ${req.params.id} role to ${newRole}`);

  res.json({ ok: true });
});

// ── Subscriptions ──
app.post('/api/subscribe/:channelId', auth, requireAuth, (req: any, res) => {
  if (req.user.id === req.params.channelId) {
    return res.status(400).json({ error: 'Users cannot subscribe to their own channel' });
  }
  const existing = db.prepare('SELECT 1 FROM subscriptions WHERE subscriber_id = ? AND channel_id = ?').get(req.user.id, req.params.channelId);
  if (existing) {
    db.prepare('DELETE FROM subscriptions WHERE subscriber_id = ? AND channel_id = ?').run(req.user.id, req.params.channelId);
    db.prepare('UPDATE channels SET subscriber_count = subscriber_count - 1 WHERE id = ?').run(req.params.channelId);
  } else {
    db.prepare('INSERT INTO subscriptions (subscriber_id,channel_id) VALUES (?,?)').run(req.user.id, req.params.channelId);
    db.prepare('UPDATE channels SET subscriber_count = subscriber_count + 1 WHERE id = ?').run(req.params.channelId);
    // Log event for analytics timeline
    db.prepare('INSERT INTO sub_events (channel_id, subscriber_id, created_at) VALUES (?, ?, ?)').run(req.params.channelId, req.user.id, localDateTimeString());

    // Notification for subscribe
    if (req.params.channelId !== req.user.id) {
      const me = db.prepare('SELECT name, avatar FROM channels WHERE id = ?').get(req.user.id) as any;
      addNotification(req.params.channelId, {
        type: 'subscribe',
        fromId: req.user.id,
        fromName: me?.name,
        fromAvatar: me?.avatar
      });
    }
  }
  res.json({ subscribed: !existing });
});

app.get('/api/subscriptions', auth, requireAuth, (req: any, res) => {
  // Automatically clean up orphaned subscription entries in the database
  try {
    db.prepare(`
      DELETE FROM subscriptions 
      WHERE subscriber_id NOT IN (SELECT id FROM channels)
         OR channel_id NOT IN (SELECT id FROM channels)
    `).run();
  } catch (err) {
    console.error('Failed to clean up orphaned subscriptions:', err);
  }

  const rows = db.prepare('SELECT channel_id FROM subscriptions WHERE subscriber_id = ?').all(req.user.id) as any[];
  res.json(rows.map((r: any) => r.channel_id));
});

// ══════════════════════════════════════════
// CATEGORIES
// ══════════════════════════════════════════
app.get('/api/categories', (_req, res) => {
  res.json(db.prepare('SELECT * FROM categories').all().map((r: any) => ({ id: r.id, name: r.name, nameEl: r.name_el })));
});

app.post('/api/categories', auth, requireAuth, (req: any, res) => {
  const admin = db.prepare('SELECT role FROM channels WHERE id = ?').get(req.user.id) as any;
  if (admin?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const id = `cat-${uuidv4()}`;
  db.prepare('INSERT INTO categories (id,name,name_el) VALUES (?,?,?)').run(id, req.body.name, req.body.nameEl || '');
  res.json({ id, name: req.body.name, nameEl: req.body.nameEl || '' });
});

app.put('/api/categories/:id', auth, requireAuth, (req: any, res) => {
  const admin = db.prepare('SELECT role FROM channels WHERE id = ?').get(req.user.id) as any;
  if (admin?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  db.prepare('UPDATE categories SET name = ?, name_el = ? WHERE id = ?').run(req.body.name, req.body.nameEl, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/categories/:id', auth, requireAuth, (req: any, res) => {
  const admin = db.prepare('SELECT role FROM channels WHERE id = ?').get(req.user.id) as any;
  if (admin?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const cat = db.prepare('SELECT name FROM categories WHERE id = ?').get(req.params.id) as any;
  if (cat) {
    db.prepare('UPDATE video_categories SET category_name = ? WHERE category_name = ?').run('Entertainment', cat.name);
    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  }
  res.json({ ok: true });
});

// ══════════════════════════════════════════
// COMMENTS
// ══════════════════════════════════════════
app.get('/api/videos/:id/comments', (req, res) => {
  const rows = db.prepare('SELECT c.*, ch.name as channel_name, ch.avatar as channel_avatar FROM comments c JOIN channels ch ON c.channel_id = ch.id WHERE c.video_id = ? ORDER BY c.created_at DESC').all(req.params.id);
  res.json(rows.map((r: any) => ({
    id: r.id,
    videoId: r.video_id,
    channelId: r.channel_id,
    channelName: r.channel_name,
    channelAvatar: r.channel_avatar,
    text: r.text,
    date: r.created_at,
    likes: r.likes,
    parentId: r.parent_id || null
  })));
});

app.post('/api/videos/:id/comments', auth, requireAuth, checkMuted, (req: any, res) => {
  const id = `c-${uuidv4()}`;
  const createdAt = localDateTimeString();
  const { text, parentId } = req.body;
  db.prepare('INSERT INTO comments (id,video_id,channel_id,text,parent_id,created_at) VALUES (?,?,?,?,?,?)').run(id, req.params.id, req.user.id, text, parentId || null, createdAt);
  const ch = db.prepare('SELECT name, avatar FROM channels WHERE id = ?').get(req.user.id) as any;
  const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id) as any;

  // Notification for comment/reply
  if (video) {
    if (req.user.id !== video.channel_id) {
      addNotification(video.channel_id, {
        type: 'comment',
        fromId: req.user.id,
        fromName: ch?.name,
        fromAvatar: ch?.avatar,
        videoId: video.id,
        videoTitle: video.title,
        commentText: text
      });
    }
  }

  res.json({ id, videoId: req.params.id, channelId: req.user.id, channelName: ch?.name, channelAvatar: ch?.avatar, text, date: createdAt, likes: 0 });
});

app.put('/api/comments/:id', auth, requireAuth, checkMuted, (req: any, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Comment text is required.' });
  }

  try {
    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id) as any;
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found.' });
    }

    const isOwner = comment.channel_id === req.user.id;
    if (isOwner) {
      db.prepare('UPDATE comments SET text = ? WHERE id = ?').run(text.trim(), req.params.id);
      const updated = db.prepare('SELECT c.*, ch.name as channel_name, ch.avatar as channel_avatar FROM comments c JOIN channels ch ON c.channel_id = ch.id WHERE c.id = ?').get(req.params.id) as any;
      return res.json({
        id: updated.id,
        videoId: updated.video_id,
        channelId: updated.channel_id,
        channelName: updated.channel_name,
        channelAvatar: updated.channel_avatar,
        text: updated.text,
        date: updated.created_at,
        likes: updated.likes,
        parentId: updated.parent_id || null
      });
    }

    // Role weight verification
    const callerRole = req.user.role;
    const isModOrAdmin = ['admin', 'moderator', 'moderator_vip_plus', 'moderator_vip_plus_plus'].includes(callerRole);

    if (!isModOrAdmin) {
      return res.status(403).json({ error: 'Forbidden: You cannot edit other users’ comments.' });
    }

    const author = db.prepare('SELECT id, role FROM channels WHERE id = ?').get(comment.channel_id) as any;
    if (!author) {
      return res.status(404).json({ error: 'Comment author not found.' });
    }

    const callerWeight = getRoleWeight(req.user.id, callerRole);
    const targetWeight = getRoleWeight(author.id, author.role);

    if (callerWeight <= targetWeight) {
      return res.status(403).json({ error: 'Forbidden: You do not have sufficient role hierarchy weight to edit this user’s comment.' });
    }

    db.prepare('UPDATE comments SET text = ? WHERE id = ?').run(text.trim(), req.params.id);
    const updated = db.prepare('SELECT c.*, ch.name as channel_name, ch.avatar as channel_avatar FROM comments c JOIN channels ch ON c.channel_id = ch.id WHERE c.id = ?').get(req.params.id) as any;
    logAdminAction(req, 'EDIT_COMMENT', `Edited comment ${req.params.id} written by ${author.id}`);

    return res.json({
      id: updated.id,
      videoId: updated.video_id,
      channelId: updated.channel_id,
      channelName: updated.channel_name,
      channelAvatar: updated.channel_avatar,
      text: updated.text,
      date: updated.created_at,
      likes: updated.likes,
      parentId: updated.parent_id || null
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/comments/:id', auth, requireAuth, (req: any, res) => {
  try {
    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id) as any;
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found.' });
    }

    const isOwner = comment.channel_id === req.user.id;
    if (isOwner) {
      db.prepare('DELETE FROM comments WHERE id = ? OR parent_id = ?').run(req.params.id, req.params.id);
      return res.json({ ok: true });
    }

    // Role weight verification for mod or admin deletion
    const callerRole = req.user.role;
    const isModOrAdmin = ['admin', 'moderator', 'moderator_vip_plus', 'moderator_vip_plus_plus'].includes(callerRole);

    if (!isModOrAdmin) {
      return res.status(403).json({ error: 'Forbidden: You cannot delete other users’ comments.' });
    }

    const author = db.prepare('SELECT id, role FROM channels WHERE id = ?').get(comment.channel_id) as any;
    if (!author) {
      db.prepare('DELETE FROM comments WHERE id = ? OR parent_id = ?').run(req.params.id, req.params.id);
      logAdminAction(req, 'DELETE_COMMENT', `Deleted comment ${req.params.id} (author missing)`);
      return res.json({ ok: true });
    }

    const callerWeight = getRoleWeight(req.user.id, callerRole);
    const targetWeight = getRoleWeight(author.id, author.role);

    if (callerWeight <= targetWeight) {
      return res.status(403).json({ error: 'Forbidden: You do not have sufficient role hierarchy weight to delete this user’s comment.' });
    }

    db.prepare('DELETE FROM comments WHERE id = ? OR parent_id = ?').run(req.params.id, req.params.id);
    logAdminAction(req, 'DELETE_COMMENT', `Deleted comment ${req.params.id} written by ${author.id}`);

    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════
// NOTIFICATIONS
// ══════════════════════════════════════════
app.get('/api/notifications', auth, requireAuth, (req: any, res) => {
  const rows = db.prepare(`
    SELECT * FROM notifications 
    WHERE target_channel_id = ? 
    ORDER BY created_at DESC 
    LIMIT 50
  `).all(req.user.id);
  res.json(rows.map((r: any) => ({
    id: r.id,
    type: r.type,
    fromChannelId: r.from_channel_id,
    fromChannelName: r.from_channel_name,
    fromChannelAvatar: r.from_channel_avatar,
    videoId: r.video_id,
    videoTitle: r.video_title,
    commentText: r.comment_text,
    newRole: r.new_role,
    read: !!r.read,
    date: r.created_at
  })));
});

app.post('/api/notifications/:id/read', auth, requireAuth, (req: any, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND target_channel_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

app.post('/api/notifications/read-all', auth, requireAuth, (req: any, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE target_channel_id = ?').run(req.user.id);
  res.json({ ok: true });
});

app.delete('/api/notifications', auth, requireAuth, (req: any, res) => {
  db.prepare('DELETE FROM notifications WHERE target_channel_id = ?').run(req.user.id);
  res.json({ ok: true });
});

// ══════════════════════════════════════════
// PLAYLISTS
// ══════════════════════════════════════════
app.get('/api/playlists', auth, (req: any, res) => {
  const qChannelId = req.query.channelId;
  const loggedInId = req.user?.id;
  
  let rows: any[];
  if (qChannelId) {
    rows = db.prepare('SELECT * FROM playlists WHERE channel_id = ? ORDER BY created_at DESC').all(qChannelId);
  } else {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    rows = db.prepare('SELECT * FROM playlists WHERE channel_id = ? ORDER BY created_at DESC').all(loggedInId);
  }
  
  res.json(rows.map((r: any) => {
    const vids = db.prepare('SELECT video_id FROM playlist_videos WHERE playlist_id = ? ORDER BY position').all(r.id) as any[];
    return { id: r.id, name: r.name, description: r.description, coverThumbnail: r.cover_thumbnail, videoIds: vids.map((v: any) => v.video_id), channelId: r.channel_id, createdAt: r.created_at, visibility: r.visibility || 'public' };
  }));
});

app.post('/api/playlists', auth, requireAuth, checkMuted, (req: any, res) => {
  const id = `pl-${uuidv4()}`;
  const createdAt = localDateTimeString();
  const visibility = req.body.visibility || 'public';
  db.prepare('INSERT INTO playlists (id,name,description,channel_id,created_at,visibility) VALUES (?,?,?,?,?,?)').run(id, req.body.name, req.body.description || '', req.user.id, createdAt, visibility);
  res.json({ id, name: req.body.name, description: req.body.description || '', coverThumbnail: '', videoIds: [], channelId: req.user.id, createdAt, visibility });
});

app.delete('/api/playlists/:id', auth, requireAuth, (req: any, res) => {
  db.prepare('DELETE FROM playlists WHERE id = ? AND channel_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

app.post('/api/playlists/:id/videos', auth, requireAuth, checkMuted, (req: any, res) => {
  const maxPos = db.prepare('SELECT MAX(position) as m FROM playlist_videos WHERE playlist_id = ?').get(req.params.id) as any;
  db.prepare('INSERT OR IGNORE INTO playlist_videos (playlist_id,video_id,position) VALUES (?,?,?)').run(req.params.id, req.body.videoId, (maxPos?.m || 0) + 1);
  res.json({ ok: true });
});

app.delete('/api/playlists/:id/videos/:videoId', auth, requireAuth, (req: any, res) => {
  db.prepare('DELETE FROM playlist_videos WHERE playlist_id = ? AND video_id = ?').run(req.params.id, req.params.videoId);
  res.json({ ok: true });
});

app.put('/api/playlists/:id/reorder', auth, requireAuth, (req: any, res) => {
  const { videoIds } = req.body;
  db.prepare('DELETE FROM playlist_videos WHERE playlist_id = ?').run(req.params.id);
  const insert = db.prepare('INSERT INTO playlist_videos (playlist_id,video_id,position) VALUES (?,?,?)');
  videoIds.forEach((vid: string, i: number) => insert.run(req.params.id, vid, i));
  res.json({ ok: true });
});

// ══════════════════════════════════════════
// WATCH HISTORY
// ══════════════════════════════════════════
app.get('/api/history', auth, requireAuth, (req: any, res) => {
  const rows = db.prepare(`
    SELECT wh.video_id, wh.progress, wh.watched_at, v.title
    FROM watch_history wh JOIN videos v ON v.id = wh.video_id
    WHERE wh.channel_id = ?
    GROUP BY wh.video_id
    ORDER BY MAX(wh.watched_at) DESC
    LIMIT 200
  `).all(req.user.id);
  res.json(rows.map((r: any) => ({ videoId: r.video_id, progress: r.progress, watchedAt: r.watched_at })));
});

app.post('/api/history', auth, requireAuth, (req: any, res) => {
  const { videoId, progress } = req.body;
  db.prepare('DELETE FROM watch_history WHERE channel_id = ? AND video_id = ?').run(req.user.id, videoId);
  db.prepare('INSERT INTO watch_history (channel_id, video_id, progress, watched_at) VALUES (?, ?, ?, ?)').run(req.user.id, videoId, progress || 0, localDateTimeString());
  res.json({ ok: true });
});

app.delete('/api/history', auth, requireAuth, (req: any, res) => {
  db.prepare('DELETE FROM watch_history WHERE channel_id = ?').run(req.user.id);
  res.json({ ok: true });
});

// ══════════════════════════════════════════
// ANALYTICS (timeline data)
// ══════════════════════════════════════════
app.get('/api/analytics', auth, requireAuth, (req: any, res) => {
  const userId = req.user.id;
  const days = parseInt(req.query.days as string) || 30;
  const videoId = req.query.videoId as string;
  const category = req.query.category as string;

  // 1. Resolve eligible Videos for the user
  let queryVideoSql = 'SELECT id FROM videos WHERE channel_id = ?';
  const queryParams: any[] = [userId];

  if (videoId) {
    queryVideoSql += ' AND id = ?';
    queryParams.push(videoId);
  } else if (category) {
    queryVideoSql = `
      SELECT v.id FROM videos v 
      JOIN video_categories vc ON v.id = vc.video_id 
      WHERE v.channel_id = ? AND vc.category_name = ?
    `;
    queryParams.push(category);
  }

  const myVideoIds = (db.prepare(queryVideoSql).all(...queryParams) as any[]).map((r: any) => r.id);
  
  if (myVideoIds.length === 0) {
    return res.json({ 
      views: [], 
      likes: [], 
      subscribers: [], 
      totals: { views: 0, likes: 0, comments: 0, videos: 0, avgProgress: 0, subscribers: 0 }, 
      topVideos: [] 
    });
  }

  const placeholders = myVideoIds.map(() => '?').join(',');

  // 2. Resolve Date Range
  let endDateStr = (req.query.endDate as string) || new Date().toISOString().split('T')[0];
  let startDateStr = (req.query.startDate as string) || '';

  if (!startDateStr) {
    const endD = new Date(endDateStr);
    endD.setDate(endD.getDate() - days + 1);
    startDateStr = endD.toISOString().split('T')[0];
  }

  // Parse for safe iteration
  const startD = new Date(startDateStr);
  const endD = new Date(endDateStr);

  const fillDays = (data: any[]) => {
    const map = new Map(data.map((d: any) => [d.day, d.count]));
    const result: { day: string; count: number }[] = [];
    const current = new Date(startD);
    // Boundary check to prevent potential infinite loops or extreme memory payloads
    const limitDate = new Date(endD);
    if (limitDate.getTime() - current.getTime() > 1000 * 60 * 60 * 24 * 365) {
      limitDate.setTime(current.getTime() + 1000 * 60 * 60 * 24 * 365); // Cap to 1 year max
    }
    while (current <= limitDate) {
      const key = current.toISOString().split('T')[0];
      result.push({ day: key, count: map.get(key) || 0 });
      current.setDate(current.getDate() + 1);
    }
    return result;
  };

  // 3. Views per day in range
  const viewsPerDay = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as count
    FROM view_events
    WHERE video_id IN (${placeholders})
      AND date(created_at) >= ? AND date(created_at) <= ?
    GROUP BY day ORDER BY day
  `).all(...myVideoIds, startDateStr, endDateStr) as any[];

  // 4. Likes per day in range
  const likesPerDay = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as count
    FROM like_events
    WHERE video_id IN (${placeholders})
      AND date(created_at) >= ? AND date(created_at) <= ?
    GROUP BY day ORDER BY day
  `).all(...myVideoIds, startDateStr, endDateStr) as any[];

  // 5. Subscribers per day in range
  const subsPerDay = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as count
    FROM sub_events
    WHERE channel_id = ?
      AND date(created_at) >= ? AND date(created_at) <= ?
    GROUP BY day ORDER BY day
  `).all(userId, startDateStr, endDateStr) as any[];

  // 6. Compute Totals in date range
  const totalViews = (db.prepare(`
    SELECT COUNT(*) as c FROM view_events 
    WHERE video_id IN (${placeholders}) AND date(created_at) >= ? AND date(created_at) <= ?
  `).get(...myVideoIds, startDateStr, endDateStr) as any)?.c || 0;

  const totalLikes = (db.prepare(`
    SELECT COUNT(*) as c FROM like_events 
    WHERE video_id IN (${placeholders}) AND date(created_at) >= ? AND date(created_at) <= ?
  `).get(...myVideoIds, startDateStr, endDateStr) as any)?.c || 0;

  const totalComments = (db.prepare(`
    SELECT COUNT(*) as c FROM comments 
    WHERE video_id IN (${placeholders}) AND date(created_at) >= ? AND date(created_at) <= ?
  `).get(...myVideoIds, startDateStr, endDateStr) as any)?.c || 0;

  const subscribersGained = (db.prepare(`
    SELECT COUNT(*) as c FROM sub_events 
    WHERE channel_id = ? AND date(created_at) >= ? AND date(created_at) <= ?
  `).get(userId, startDateStr, endDateStr) as any)?.c || 0;

  const avgProgress = (db.prepare(`
    SELECT AVG(progress) as average FROM watch_history 
    WHERE video_id IN (${placeholders}) AND date(watched_at) >= ? AND date(watched_at) <= ?
  `).get(...myVideoIds, startDateStr, endDateStr) as any)?.average || 0;

  // 7. Top videos ranked by Views Gained in this timeline
  const topVideos = db.prepare(`
    SELECT v.id, v.title, COUNT(ve.id) as views, v.likes 
    FROM videos v
    LEFT JOIN view_events ve ON v.id = ve.video_id AND date(ve.created_at) >= ? AND date(ve.created_at) <= ?
    WHERE v.channel_id = ? AND v.id IN (${placeholders})
    GROUP BY v.id
    ORDER BY views DESC
    LIMIT 10
  `).all(startDateStr, endDateStr, userId, ...myVideoIds);

  res.json({
    views: fillDays(viewsPerDay),
    likes: fillDays(likesPerDay),
    subscribers: fillDays(subsPerDay),
    totals: { 
      views: totalViews, 
      likes: totalLikes, 
      comments: totalComments, 
      videos: myVideoIds.length,
      avgProgress: Math.round(avgProgress * 100), // convert to percent (e.g., 0.65 -> 65)
      subscribers: subscribersGained
    },
    topVideos,
    meta: {
      startDate: startDateStr,
      endDate: endDateStr,
      calculatedDaysDiff: Math.floor((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1
    }
  });
});

// ══════════════════════════════════════════
// IMPORT — scan + import from /videos mount
// ══════════════════════════════════════════
const IMPORT_DIR = process.env.IMPORT_DIR || '/videos';
const VIDEO_EXTS = new Set(['.mp4','.webm','.mkv','.avi','.mov','.wmv','.flv','.m4v','.3gp','.ogv','.ts']);

function resolveImportPath(relativePath = '') {
  const normalized = relativePath.replace(/^\/+/, '');
  const full = path.resolve(path.join(IMPORT_DIR, normalized));
  const root = path.resolve(IMPORT_DIR);
  if (!full.startsWith(root)) throw new Error('Invalid path');
  return { full, root, relative: normalized };
}

function scanImportDir(dir: string, base: string, recursive = true): { path: string; name: string; size: number }[] {
  const results: { path: string; name: string; size: number }[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.join(base, entry.name);
    if (entry.isDirectory()) {
      if (recursive) results.push(...scanImportDir(full, rel, recursive));
    } else if (entry.isFile() && VIDEO_EXTS.has(path.extname(entry.name).toLowerCase())) {
      try { const stat = fs.statSync(full); results.push({ path: rel, name: entry.name, size: stat.size }); } catch {}
    }
  }
  return results;
}

function listImportFolders(relativePath = '') {
  const { full, root, relative } = resolveImportPath(relativePath);
  if (!fs.existsSync(full)) return { current: '', parent: null as string | null, breadcrumbs: [], folders: [] as any[] };
  const folders = fs.readdirSync(full, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      const rel = path.join(relative, e.name).replace(/\\/g, '/');
      return { name: e.name, path: rel };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const parts = relative ? relative.split(/[\\/]+/).filter(Boolean) : [];
  const breadcrumbs = parts.map((name, i) => ({ name, path: parts.slice(0, i + 1).join('/') }));
  const parent = parts.length > 0 ? parts.slice(0, -1).join('/') : null;
  return { current: relative.replace(/\\/g, '/'), parent, breadcrumbs, folders };
}

let hasFFmpeg = false;
let ffmpegBin = 'ffmpeg';
let ffprobeBin = 'ffprobe';
try {
  const candidates = [
    { ffmpeg: 'ffmpeg', ffprobe: 'ffprobe' },
    { ffmpeg: '/usr/bin/ffmpeg', ffprobe: '/usr/bin/ffprobe' },
    { ffmpeg: '/usr/local/bin/ffmpeg', ffprobe: '/usr/local/bin/ffprobe' },
  ];
  for (const c of candidates) {
    try {
      execSync(`${c.ffprobe} -version`, { stdio: 'pipe' });
      execSync(`${c.ffmpeg} -version`, { stdio: 'pipe' });
      ffmpegBin = c.ffmpeg;
      ffprobeBin = c.ffprobe;
      hasFFmpeg = true;
      break;
    } catch {}
  }
} catch {}

function getVideoDuration(filePath: string): number {
  if (!hasFFmpeg) return 0;
  try {
    const r = execSync(`${ffprobeBin} -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`, { timeout: 15000, stdio: 'pipe' }).toString().trim();
    const s = parseFloat(r);
    return isNaN(s) ? 0 : s;
  } catch { return 0; }
}

function generateThumb(videoPath: string, thumbPath: string): boolean {
  if (!hasFFmpeg) return false;
  try {
    execSync(`${ffmpegBin} -y -i "${videoPath}" -ss 00:00:05 -vframes 1 -vf "scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2" "${thumbPath}"`, { timeout: 20000, stdio: 'pipe' });
    return true;
  } catch { return false; }
}

// Browse folders inside the import directory
app.get('/api/import/browse', auth, requireAuth, (req: any, res) => {
  const admin = db.prepare('SELECT role FROM channels WHERE id = ?').get(req.user.id) as any;
  if (admin?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const rel = typeof req.query.path === 'string' ? req.query.path : '';
    res.json({ importDir: IMPORT_DIR, hasFFmpeg, ...listImportFolders(rel) });
  } catch {
    res.status(400).json({ error: 'Invalid path' });
  }
});

// Scan the selected import directory
app.get('/api/import/scan', auth, requireAuth, (req: any, res) => {
  const admin = db.prepare('SELECT role FROM channels WHERE id = ?').get(req.user.id) as any;
  if (admin?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const rel = typeof req.query.path === 'string' ? req.query.path : '';
    const recursive = req.query.recursive !== 'false';
    const { full, relative } = resolveImportPath(rel);
    const files = scanImportDir(full, relative ? '' : '', recursive).map((f) => {
      const relPath = path.join(relative, f.path).replace(/\\/g, '/').replace(/^\//, '');
      const title = path.basename(f.path, path.extname(f.path)).replace(/[_-]/g, ' ').trim();
      const baseName = path.basename(f.path).toLowerCase();
      const existing = db.prepare(`
        SELECT id FROM videos 
        WHERE LOWER(TRIM(title)) = ? 
           OR LOWER(video_path) LIKE ? 
           OR LOWER(video_url) LIKE ?
           OR (file_size = ? AND LOWER(TRIM(title)) = ?)
      `).get(title.toLowerCase(), `%/${baseName}`, `%/${baseName}`, f.size, title.toLowerCase());
      return { 
        ...f, 
        path: relPath,
        alreadyImported: !!existing
      };
    });
    res.json({ importDir: IMPORT_DIR, selectedPath: relative.replace(/\\/g, '/'), files, hasFFmpeg });
  } catch {
    res.status(400).json({ error: 'Invalid path' });
  }
});

// Import selected files
app.post('/api/import/run', auth, requireAuth, checkMuted, (req: any, res) => {
  const admin = db.prepare('SELECT role FROM channels WHERE id = ?').get(req.user.id) as any;
  if (admin?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  const { files, mode, defaultCategory, defaultVisibility, defaultAdditionalCategories } = req.body as {
    files: { path: string; category?: string; primaryCategory?: string; additionalCategories?: string[]; visibility: string }[];
    mode: 'copy' | 'link' | 'move';
    defaultCategory: string;
    defaultVisibility: string;
    defaultAdditionalCategories?: string[];
  };

  if (!files || !Array.isArray(files) || files.length === 0) return res.status(400).json({ error: 'No files selected' });

  const results: { file: string; status: 'ok' | 'skip' | 'error'; title: string; message?: string }[] = [];
  const MIMES: Record<string,string> = { '.mp4':'video/mp4','.webm':'video/webm','.mkv':'video/x-matroska','.avi':'video/x-msvideo','.mov':'video/quicktime','.wmv':'video/x-ms-wmv','.flv':'video/x-flv','.m4v':'video/x-m4v','.3gp':'video/3gpp','.ogv':'video/ogg','.ts':'video/mp2t' };

  const insertVid = db.prepare("INSERT INTO videos (id,title,description,thumbnail_url,video_url,video_path,mime_type,file_size,duration,views,likes,dislikes,upload_date,channel_id,visibility) VALUES (?,?,?,?,?,?,?,?,?,0,0,0,?, ?,?)");
  const insertVC = db.prepare('INSERT OR IGNORE INTO video_categories (video_id,category_name) VALUES (?,?)');

  const txn = db.transaction(() => {
    for (const f of files) {
      const srcPath = path.join(IMPORT_DIR, f.path);
      if (!fs.existsSync(srcPath)) { results.push({ file: f.path, status: 'error', title: '', message: 'File not found' }); continue; }

      const fileName = path.basename(srcPath);
      const title = path.basename(srcPath, path.extname(srcPath)).replace(/[_-]/g, ' ');
      const ext = path.extname(srcPath);
      const videoId = `v-${uuidv4()}`;
      const primaryCategory = f.primaryCategory || f.category || defaultCategory || 'Entertainment';
      const additionalCategories = Array.isArray(f.additionalCategories) ? f.additionalCategories.filter((c) => c && c !== primaryCategory) : (defaultAdditionalCategories || []).filter((c) => c && c !== primaryCategory);
      const allCategories = [primaryCategory, ...additionalCategories];
      const targetDir = ensureCategoryVideoDir(primaryCategory);
      const destFileName = uniqueFileName(fileName, targetDir);
      const destPath = path.join(targetDir, destFileName);
      const videoUrl = `/uploads/videos/${categoryFolderName(primaryCategory)}/${destFileName}`;

      // Skip if already imported (checks title case-insensitively, file size, or video path filename)
      const baseName = fileName.toLowerCase();
      const cleanTitle = title.trim();
      const statSize = fs.statSync(srcPath).size;
      const existing = db.prepare(`
        SELECT id FROM videos 
        WHERE LOWER(TRIM(title)) = ? 
           OR LOWER(video_path) LIKE ? 
           OR LOWER(video_url) LIKE ?
           OR (file_size = ? AND LOWER(TRIM(title)) = ?)
      `).get(cleanTitle.toLowerCase(), `%/${baseName}`, `%/${baseName}`, statSize, cleanTitle.toLowerCase());
      if (existing) { results.push({ file: f.path, status: 'skip', title, message: 'Already imported' }); continue; }

      try {
        if (mode === 'link') fs.symlinkSync(path.resolve(srcPath), destPath);
        else if (mode === 'move') fs.renameSync(srcPath, destPath);
        else fs.copyFileSync(srcPath, destPath);
      } catch (err: any) { results.push({ file: f.path, status: 'error', title, message: err.message }); continue; }

      const dur = getVideoDuration(destPath);
      let thumbUrl = '';
      const thumbBase = `${path.parse(destFileName).name}.jpg`;
      const thumbFile = uniqueFileName(thumbBase, path.join(UPLOAD_DIR, 'thumbnails'));
      const thumbPath = path.join(UPLOAD_DIR, 'thumbnails', thumbFile);
      if (generateThumb(destPath, thumbPath)) thumbUrl = `/uploads/thumbnails/${thumbFile}`;

      const stat = fs.statSync(destPath);
      const mime = MIMES[ext.toLowerCase()] || 'video/mp4';
      const vis = f.visibility || defaultVisibility || 'public';

      insertVid.run(videoId, title, '', thumbUrl, videoUrl, destPath, mime, stat.size, dur, localDateString(), req.user.id, vis);
      allCategories.forEach((c: string) => insertVC.run(videoId, c));

      results.push({ file: f.path, status: 'ok', title });
    }
  });
  txn();

  const importedCount = results.filter((r) => r.status === 'ok').length;
  const skippedCount = results.filter((r) => r.status === 'skip').length;
  const errCount = results.filter((r) => r.status === 'error').length;
  
  if (importedCount > 0) {
    logAdminAction(req, 'IMPORT_VIDEOS', `Imported ${importedCount} videos, skipped ${skippedCount}, with ${errCount} errors.`);
  }

  res.json({ results, imported: importedCount, skipped: skippedCount, errors: errCount });
});

// ══════════════════════════════════════════
// REPORT SYSTEM & MODERATION (MUTE/BAN)
// ══════════════════════════════════════════

// Submit Report (video, comment, ban_request)
app.post('/api/reports', auth, requireAuth, (req: any, res) => {
  const { type, targetId, reason, details } = req.body;
  if (!type || !targetId || !reason) {
    return res.status(400).json({ error: 'Missing type, targetId, or reason' });
  }

  if (!details || typeof details !== 'string' || !details.trim()) {
    return res.status(400).json({ error: 'Please provide Details / Context for this report supporting your claim.' });
  }

  // Validate target exists
  try {
    if (type === 'video') {
      const exists = db.prepare('SELECT 1 FROM videos WHERE id = ?').get(targetId);
      if (!exists) return res.status(404).json({ error: 'Video not found' });
    } else if (type === 'comment') {
      const exists = db.prepare('SELECT 1 FROM comments WHERE id = ?').get(targetId);
      if (!exists) return res.status(404).json({ error: 'Comment not found' });
    } else if (type === 'ban_request') {
      const exists = db.prepare('SELECT role FROM channels WHERE id = ?').get(targetId) as any;
      if (!exists) return res.status(404).json({ error: 'User not found' });
      // Can't request banning of main admin
      if (targetId === 'ch-admin') {
        return res.status(403).json({ error: 'Cannot issue a ban request for the main administrator.' });
      }
    } else {
      return res.status(400).json({ error: 'Invalid report type' });
    }

    const id = `rep-${uuidv4()}`;
    const weight = getRoleWeight(req.user.id, req.user.role);
    db.prepare('INSERT INTO reports (id, type, target_id, reporter_id, reason, details, status, weight, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime(\'now\'))')
      .run(id, type, targetId, req.user.id, reason, details || '', 'pending', weight);

    res.json({ ok: true, id });
  } catch (err: any) {
    console.error('Submit report error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get List of Reports
app.get('/api/reports', auth, requireAuth, requireAdminOrModerator, (req, res) => {
  try {
    const reports = db.prepare('SELECT * FROM reports ORDER BY weight DESC, created_at DESC').all() as any[];
    const result = reports.map(r => {
      const reporter = r.reporter_id ? db.prepare('SELECT name, username FROM channels WHERE id = ?').get(r.reporter_id) as any : null;
      let targetDetails = null;
      try {
        if (r.type === 'video') {
          targetDetails = db.prepare('SELECT v.title, v.channel_id, c.name as channel_name, c.username as channel_username FROM videos v JOIN channels c ON c.id = v.channel_id WHERE v.id = ?').get(r.target_id);
        } else if (r.type === 'comment') {
          targetDetails = db.prepare('SELECT co.text, co.channel_id, c.name as channel_name, c.username as channel_username FROM comments co JOIN channels c ON c.id = co.channel_id WHERE co.id = ?').get(r.target_id);
        } else if (r.type === 'ban_request') {
          targetDetails = db.prepare('SELECT name, username, email, role FROM channels WHERE id = ?').get(r.target_id);
        }
      } catch (err) {
        console.error('Error fetching targetDetails for report:', r.id, err);
      }
      return {
        id: r.id,
        type: r.type,
        targetId: r.target_id,
        reporterId: r.reporter_id,
        reason: r.reason,
        details: r.details,
        status: r.status,
        weight: r.weight,
        createdAt: r.created_at,
        reporterName: reporter?.name || 'Anonymous',
        reporterUsername: reporter?.username || 'anonymous',
        targetDetails
      };
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Report Status
app.post('/api/reports/:id/status', auth, requireAuth, requireAdminOrModerator, (req: any, res) => {
  const { status } = req.body;
  if (status !== 'resolved' && status !== 'dismissed') {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    db.prepare('UPDATE reports SET status = ? WHERE id = ?').run(status, req.params.id);
    logAdminAction(req, 'REPORT_STATUS', `Report ${req.params.id} marked as ${status}`);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Mute User
app.post('/api/admin/users/:userId/mute', auth, requireAuth, requireAdminOrModerator, (req: any, res) => {
  const { durationDays } = req.body;
  const { userId } = req.params;
  if (!durationDays || isNaN(durationDays)) {
    return res.status(400).json({ error: 'Valid durationDays is required.' });
  }

  try {
    const target = db.prepare('SELECT id, name, role FROM channels WHERE id = ?').get(userId) as any;
    if (!target) return res.status(404).json({ error: 'User not found.' });

    // Main Administrator cannot be muted
    if (userId === 'ch-admin') {
      return res.status(403).json({ error: 'The main administrator cannot be muted.' });
    }

    // Weight hierarchy check
    const callerWeight = getRoleWeight(req.user.id, req.user.role);
    const targetWeight = getRoleWeight(userId, target.role);
    if (callerWeight <= targetWeight) {
      return res.status(403).json({ error: 'Forbidden: You do not have sufficient role weight hierarchy to mute this user.' });
    }

    // Compute end date
    const expiry = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    const mutedUntil = localDateTimeString(expiry);

    db.prepare('UPDATE channels SET muted_until = ? WHERE id = ?').run(mutedUntil, userId);
    logAdminAction(req, 'MUTE_USER', `Muted user ${target.name} (ID: ${userId}) for ${durationDays} days. Muted until ${mutedUntil}`);

    // Add notification
    addNotification(userId, {
      type: 'mute',
      from_channel_id: req.user.id,
      from_channel_name: req.user.name,
      comment_text: `You have been muted from posting comments, videos and creating playlists for ${durationDays} days. Expiry: ${mutedUntil}`
    });

    res.json({ ok: true, mutedUntil });
  } catch (err: any) {
    console.error('Mute user error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Unmute User
app.post('/api/admin/users/:userId/unmute', auth, requireAuth, requireAdminOrModerator, (req: any, res) => {
  const { userId } = req.params;
  try {
    const target = db.prepare('SELECT id, name, role FROM channels WHERE id = ?').get(userId) as any;
    if (!target) return res.status(404).json({ error: 'User not found.' });

    // Hierarchy check
    const callerWeight = getRoleWeight(req.user.id, req.user.role);
    const targetWeight = getRoleWeight(userId, target.role);
    if (callerWeight <= targetWeight) {
      return res.status(403).json({ error: 'Forbidden: You do not have sufficient role weight hierarchy to unmute this user.' });
    }

    db.prepare('UPDATE channels SET muted_until = NULL WHERE id = ?').run(userId);
    logAdminAction(req, 'UNMUTE_USER', `Unmuted user ${target.name} (ID: ${userId})`);

    // Add notification
    addNotification(userId, {
      type: 'unmute',
      from_channel_id: req.user.id,
      from_channel_name: req.user.name,
      comment_text: `Your account restriction has been removed. You can now post comments, playlists, and videos again.`
    });

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get User Moderation History and Statistics (Reported, Muted, Banned counts & details)
app.get('/api/admin/users/:userId/moderation-history', auth, requireAuth, requireAdminOrModerator, (req, res) => {
  const { userId } = req.params;
  try {
    const target = db.prepare('SELECT id, name, username, email FROM channels WHERE id = ?').get(userId) as any;
    if (!target) return res.status(404).json({ error: 'User not found.' });

    // Reports of type video belonging to user
    const videoReports = db.prepare(`
      SELECT r.*, v.title as video_title 
      FROM reports r 
      JOIN videos v ON v.id = r.target_id 
      WHERE r.type = 'video' AND v.channel_id = ?
    `).all(userId) as any[];

    // Reports of type comment belonging to user
    const commentReports = db.prepare(`
      SELECT r.*, c.text as comment_text, v.title as video_title
      FROM reports r 
      JOIN comments c ON c.id = r.target_id 
      JOIN videos v ON v.id = c.video_id
      WHERE r.type = 'comment' AND c.channel_id = ?
    `).all(userId) as any[];

    // Reports of type ban_request belonging to user
    const banRequestReports = db.prepare(`
      SELECT r.* 
      FROM reports r 
      WHERE r.type = 'ban_request' AND r.target_id = ?
    `).all(userId) as any[];

    const reportsMapped = [
      ...banRequestReports.map(r => ({
        id: r.id,
        type: r.type,
        reason: r.reason,
        details: r.details,
        status: r.status,
        createdAt: r.created_at,
        targetLabel: 'Account Ban Request'
      })),
      ...videoReports.map(r => ({
        id: r.id,
        type: r.type,
        reason: r.reason,
        details: r.details,
        status: r.status,
        createdAt: r.created_at,
        targetLabel: `Video: "${r.video_title}"`
      })),
      ...commentReports.map(r => ({
        id: r.id,
        type: r.type,
        reason: r.reason,
        details: r.details,
        status: r.status,
        createdAt: r.created_at,
        targetLabel: `Comment: "${r.comment_text?.slice(0, 40)}${r.comment_text?.length > 40 ? '...' : ''}"`
      }))
    ].sort((a,b) => b.createdAt.localeCompare(a.createdAt));

    const namePattern = `%${target.name}%`;
    const idPattern = `%${userId}%`;
    const logs = db.prepare(`
      SELECT l.*, c.name as admin_name, c.username as admin_username
      FROM admin_logs l
      LEFT JOIN channels c ON c.id = l.channel_id
      WHERE (l.action IN ('MUTE_USER', 'UNMUTE_USER', 'BAN_USER', 'UNBAN_USER'))
        AND (l.details LIKE ? OR l.details LIKE ?)
      ORDER BY l.created_at DESC
    `).all(idPattern, namePattern) as any[];

    const mutedMinLogs = db.prepare(`
      SELECT COUNT(*) as c FROM admin_logs 
      WHERE action = 'MUTE_USER' AND (details LIKE ? OR details LIKE ?)
    `).get(idPattern, namePattern) as any;

    const bannedMinLogs = db.prepare(`
      SELECT COUNT(*) as c FROM admin_logs 
      WHERE action = 'BAN_USER' AND (details LIKE ? OR details LIKE ?)
    `).get(idPattern, namePattern) as any;

    res.json({
      userId,
      name: target.name,
      username: target.username,
      email: target.email,
      reportedCount: reportsMapped.length,
      mutedCount: mutedMinLogs?.c || 0,
      bannedCount: bannedMinLogs?.c || 0,
      reports: reportsMapped,
      logs: logs.map((l: any) => ({
        id: l.id,
        action: l.action,
        details: l.details,
        createdAt: l.created_at,
        adminName: l.admin_name || 'System',
        adminUsername: l.admin_username || 'system'
      }))
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Ban User (Admins Only)
app.post('/api/admin/users/:userId/ban', auth, requireAuth, requireAdmin, (req: any, res) => {
  const { userId } = req.params;
  const { durationDays, reason } = req.body;
  try {
    const target = db.prepare('SELECT id, name, username, email, role FROM channels WHERE id = ?').get(userId) as any;
    if (!target) return res.status(404).json({ error: 'User not found.' });

    // Cannot ban main admin
    if (userId === 'ch-admin') {
      return res.status(403).json({ error: 'The main administrator cannot be banned.' });
    }

    // Role Hierarchy constraint
    const callerWeight = getRoleWeight(req.user.id, req.user.role);
    const targetWeight = getRoleWeight(userId, target.role);
    if (callerWeight <= targetWeight) {
      return res.status(403).json({ error: 'Forbidden: You do not have sufficient role weight hierarchy to ban this user.' });
    }

    const bannedUntil = durationDays ? localDateTimeString(new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)) : 'permanent';

    // Blacklist credentials
    db.prepare('INSERT OR REPLACE INTO blacklist (id, username, email, banned_by, reason, banned_until) VALUES (?, ?, ?, ?, ?, ?)')
      .run(userId, target.username, target.email, req.user.id, reason || 'Violation of guidelines', bannedUntil);

    db.prepare('UPDATE channels SET banned = 1 WHERE id = ?').run(userId);

    logAdminAction(req, 'BAN_USER', `Banned user ${target.name} (ID: ${userId}) ${durationDays ? 'for ' + durationDays + ' days' : 'permanently'}. Reason: ${reason || 'Violation of guidelines'}`);

    // Mock Email Delivery (to console/terminal)
    console.log(`\n=============================================================`);
    console.log(`[EMAIL DISPATCH] Mock Email Sent to ${target.email}`);
    console.log(`Subject: Your ViewTube account restriction details`);
    console.log(`Body: Hello ${target.name},`);
    console.log(`Your ViewTube account (@${target.username}) has been banned ${durationDays ? 'for ' + durationDays + ' days' : 'permanently'}.`);
    console.log(`Reason for action: ${reason || 'Violation of security or community rules.'}`);
    console.log(`=============================================================\n`);

    res.json({ ok: true, bannedUntil });
  } catch (err: any) {
    console.error('Ban user error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Unban User (Admins Only)
app.post('/api/admin/users/:userId/unban', auth, requireAuth, requireAdmin, (req: any, res) => {
  const { userId } = req.params;
  try {
    const target = db.prepare('SELECT id, name, username, email, role FROM channels WHERE id = ?').get(userId) as any;
    const blacklistRecord = db.prepare('SELECT * FROM blacklist WHERE id = ?').get(userId) as any;

    const emailAddress = target?.email || blacklistRecord?.email;
    const nameStr = target?.name || blacklistRecord?.username || 'User';

    db.prepare('UPDATE channels SET banned = 0 WHERE id = ?').run(userId);
    db.prepare('DELETE FROM blacklist WHERE id = ?').run(userId);

    logAdminAction(req, 'UNBAN_USER', `Lifting ban restriction for user ID: ${userId}`);

    // Mock Email Delivery (to console/terminal)
    if (emailAddress) {
      console.log(`\n=============================================================`);
      console.log(`[EMAIL DISPATCH] Mock Email Sent to ${emailAddress}`);
      console.log(`Subject: ViewTube account suspension lifted`);
      console.log(`Body: Hello ${nameStr},`);
      console.log(`Your account suspension on ViewTube has been lifted. You can login normally now.`);
      console.log(`=============================================================\n`);
    }

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════
// ADMIN RECOVERY REQUESTS
// ══════════════════════════════════════════
app.get('/api/admin/recovery-requests', auth, requireAuth, requireAdminOrModerator, (_req, res) => {
  const rows = db.prepare(`
    SELECT pr.*, ch.name as channel_name, ch.username as channel_username, ch.email as channel_email
    FROM password_reset_requests pr
    LEFT JOIN channels ch ON ch.id = pr.channel_id
    ORDER BY pr.created_at DESC
  `).all();
  res.json(rows.map((r: any) => ({
    id: r.id,
    channelId: r.channel_id,
    identifier: r.identifier,
    note: r.note,
    status: r.status,
    tempPassword: r.temp_password,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
    channelName: r.channel_name,
    channelUsername: r.channel_username,
    channelEmail: r.channel_email,
  })));
});

app.post('/api/admin/recovery-requests/:id/reset', auth, requireAuth, requireAdminOrModerator, (req: any, res) => {
  const row = db.prepare('SELECT * FROM password_reset_requests WHERE id = ?').get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: 'Request not found' });
  if (!row.channel_id) return res.status(400).json({ error: 'No linked user account found for this request' });

  const tempPassword = Math.random().toString(36).slice(2, 10);
  const hash = bcrypt.hashSync(tempPassword, 10);
  db.prepare('UPDATE channels SET password = ?, must_change_password = 1 WHERE id = ?').run(hash, row.channel_id);
  db.prepare('UPDATE password_reset_requests SET status = ?, temp_password = ?, resolved_at = ? WHERE id = ?').run('resolved', tempPassword, localDateTimeString(), req.params.id);
  
  logAdminAction(req, 'RECOVERY_RESET', `Approved recovery request for ${row.identifier} (ID: ${req.params.id}). Issued temporary password.`);

  res.json({ ok: true, tempPassword });
});

app.post('/api/admin/recovery-requests/:id/dismiss', auth, requireAuth, requireAdminOrModerator, (req: any, res) => {
  const row = db.prepare('SELECT * FROM password_reset_requests WHERE id = ?').get(req.params.id) as any;
  db.prepare('UPDATE password_reset_requests SET status = ?, resolved_at = ? WHERE id = ?').run('dismissed', localDateTimeString(), req.params.id);
  
  logAdminAction(req, 'RECOVERY_DISMISS', `Dismissed recovery request for ${row ? row.identifier : req.params.id} (ID: ${req.params.id}).`);

  res.json({ ok: true });
});

// ══════════════════════════════════════════
// ADMIN BACKUPS
// ══════════════════════════════════════════
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
fs.mkdirSync(BACKUP_DIR, { recursive: true });

function requireAdmin(req: any, res: any, next: any) {
  const admin = db.prepare('SELECT role FROM channels WHERE id = ?').get(req.user?.id) as any;
  if (admin?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
}

function requireAdminOrModerator(req: any, res: any, next: any) {
  const user = db.prepare('SELECT role FROM channels WHERE id = ?').get(req.user?.id) as any;
  if (user?.role !== 'admin' && user?.role !== 'moderator' && user?.role !== 'moderator_vip_plus' && user?.role !== 'moderator_vip_plus_plus') return res.status(403).json({ error: 'Forbidden' });
  next();
}

function getDirSize(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += getDirSize(full);
    else if (entry.isFile()) try { total += fs.statSync(full).size; } catch {}
  }
  return total;
}

// Storage info
app.get('/api/admin/storage', auth, requireAuth, requireAdminOrModerator, (_req, res) => {
  const dbSize = fs.existsSync(path.join(DATA_DIR, 'viewtube.db')) ? fs.statSync(path.join(DATA_DIR, 'viewtube.db')).size : 0;
  const videosSize = getDirSize(path.join(UPLOAD_DIR, 'videos'));
  const thumbsSize = getDirSize(path.join(UPLOAD_DIR, 'thumbnails'));
  const avatarsSize = getDirSize(path.join(UPLOAD_DIR, 'avatars'));
  const bannersSize = getDirSize(path.join(UPLOAD_DIR, 'banners'));
  const backupsSize = getDirSize(BACKUP_DIR);
  const videoCount = (db.prepare('SELECT COUNT(*) as c FROM videos').get() as any).c;
  const userCount = (db.prepare('SELECT COUNT(*) as c FROM channels').get() as any).c;
  res.json({ database: dbSize, videos: videosSize, thumbnails: thumbsSize, avatars: avatarsSize, banners: bannersSize, backups: backupsSize, videoCount, userCount });
});

// List backups
app.get('/api/admin/backups', auth, requireAuth, requireAdmin, (_req, res) => {
  const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.db')).map((f) => {
    const stat = fs.statSync(path.join(BACKUP_DIR, f));
    return { name: f, size: stat.size, date: stat.mtime.toISOString() };
  }).sort((a, b) => b.date.localeCompare(a.date));
  res.json(files);
});

// Create backup snapshot
app.post('/api/admin/backups', auth, requireAuth, requireAdmin, (req: any, res) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupName = `viewtube-${timestamp}.db`;
  const src = path.join(DATA_DIR, 'viewtube.db');
  const dest = path.join(BACKUP_DIR, backupName);
  if (!fs.existsSync(src)) return res.status(404).json({ error: 'Database not found' });
  // Use SQLite backup API for safe copy while DB is in use
  db.backup(dest).then(() => {
    const stat = fs.statSync(dest);
    logAdminAction(req, 'BACKUP_CREATE', `Created manual database backup snapshot: ${backupName} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
    res.json({ name: backupName, size: stat.size, date: stat.mtime.toISOString() });
  }).catch((err: any) => {
    res.status(500).json({ error: err.message || 'Backup failed' });
  });
});

// Download backup
app.get('/api/admin/backups/:name', auth, requireAuth, requireAdmin, (req, res) => {
  const filePath = path.join(BACKUP_DIR, req.params.name);
  if (!fs.existsSync(filePath) || !req.params.name.endsWith('.db')) return res.status(404).json({ error: 'Not found' });
  res.download(filePath, req.params.name);
});

// Download current live database
app.get('/api/admin/download-db', auth, requireAuth, requireAdmin, (req: any, res) => {
  const dbPath = path.join(DATA_DIR, 'viewtube.db');
  if (!fs.existsSync(dbPath)) return res.status(404).json({ error: 'Database not found' });
  // Create a temp safe copy first
  const tempPath = path.join(BACKUP_DIR, `_live-download-${Date.now()}.db`);
  db.backup(tempPath).then(() => {
    logAdminAction(req, 'DB_DOWNLOAD', 'Exported live database structure and contents.');
    res.download(tempPath, 'viewtube.db', () => { try { fs.unlinkSync(tempPath); } catch {} });
  }).catch((err: any) => {
    res.status(500).json({ error: err.message || 'Download failed' });
  });
});

// Delete backup
app.delete('/api/admin/backups/:name', auth, requireAuth, requireAdmin, (req: any, res) => {
  const filePath = path.join(BACKUP_DIR, req.params.name);
  if (!fs.existsSync(filePath) || !req.params.name.endsWith('.db')) return res.status(404).json({ error: 'Not found' });
  fs.unlinkSync(filePath);
  logAdminAction(req, 'BACKUP_DELETE', `Deleted database backup file: ${req.params.name}`);
  res.json({ ok: true });
});

// Restore from uploaded backup
app.post('/api/admin/restore', auth, requireAuth, requireAdmin, upload.single('backup'), (req: any, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  // Create a safety backup of current DB before restoring
  const safetyName = `pre-restore-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.db`;
  const safetyDest = path.join(BACKUP_DIR, safetyName);
  const dbPath = path.join(DATA_DIR, 'viewtube.db');

  try {
    if (fs.existsSync(dbPath)) fs.copyFileSync(dbPath, safetyDest);
    fs.copyFileSync(file.path, dbPath);
    fs.unlinkSync(file.path);
    logAdminAction(req, 'BACKUP_RESTORE', `Restored database from external upload. Saved pre-restore checkpoint: ${safetyName}`);
    res.json({ ok: true, safetyBackup: safetyName, message: 'Database restored. Restart the server for changes to take full effect.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Restore failed' });
  }
});

// ══════════════════════════════════════════
// SYSTEM DIAGNOSTICS & CLEANUP ENDPOINTS
// ══════════════════════════════════════════

// Import OS for CPU cores
import os from 'os';

// Get admin operations logs
app.get('/api/admin/logs', auth, requireAuth, requireAdminOrModerator, (_req, res) => {
  try {
    const rows = db.prepare(`
      SELECT l.*, c.name as admin_name, c.username as admin_username 
      FROM admin_logs l
      LEFT JOIN channels c ON c.id = l.channel_id
      ORDER BY l.created_at DESC
      LIMIT 100
    `).all();
    res.json(rows.map((r: any) => ({
      id: r.id,
      action: r.action,
      adminId: r.channel_id,
      adminName: r.admin_name || 'System / Direct Command',
      adminUsername: r.admin_username || r.channel_id,
      details: r.details,
      createdAt: r.created_at
    })));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch logs: ' + err.message });
  }
});

// Get deep system health metrics
app.get('/api/admin/health', auth, requireAuth, requireAdminOrModerator, (req, res) => {
  try {
    // OS Check
    const uptime = process.uptime();
    const loadAvg = os.loadavg();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const cpus = os.cpus();

    // Check directories write access
    const dirsToCheck = [
      { name: 'Uploads Core', path: UPLOAD_DIR },
      { name: 'Videos Subdir', path: path.join(UPLOAD_DIR, 'videos') },
      { name: 'Thumbnails Subdir', path: path.join(UPLOAD_DIR, 'thumbnails') },
      { name: 'Avatars Subdir', path: path.join(UPLOAD_DIR, 'avatars') },
      { name: 'Banners Subdir', path: path.join(UPLOAD_DIR, 'banners') },
      { name: 'Backups Core', path: BACKUP_DIR },
      { name: 'Import Root', path: IMPORT_DIR }
    ];

    const directoriesHealth = dirsToCheck.map(d => {
      const exists = fs.existsSync(d.path);
      let writable = false;
      if (exists) {
        try {
          const testFile = path.join(d.path, `.health-write-test-${Date.now()}`);
          fs.writeFileSync(testFile, 'test');
          fs.unlinkSync(testFile);
          writable = true;
        } catch {}
      }
      return {
        name: d.name,
        path: d.path,
        exists,
        writable,
        size: exists ? getDirSize(d.path) : 0,
        fileCount: exists ? fs.readdirSync(d.path, { withFileTypes: true }).filter(f => f.isFile()).length : 0
      };
    });

    // Check database integrity
    let dbIntegrity = 'unknown';
    try {
      const resp = db.prepare('PRAGMA integrity_check').get() as any;
      dbIntegrity = resp?.integrity_check || 'ok';
    } catch {
      dbIntegrity = 'failed_command';
    }

    // Records count
    const records = {
      videos: (db.prepare('SELECT COUNT(*) as c FROM videos').get() as any).c,
      channels: (db.prepare('SELECT COUNT(*) as c FROM channels').get() as any).c,
      playlists: (db.prepare('SELECT COUNT(*) as c FROM playlists').get() as any).c,
      comments: (db.prepare('SELECT COUNT(*) as c FROM comments').get() as any).c,
      subscriptions: (db.prepare('SELECT COUNT(*) as c FROM subscriptions').get() as any).c,
      resetRequests: (db.prepare('SELECT COUNT(*) as c FROM password_reset_requests').get() as any).c,
      adminLogs: (db.prepare('SELECT COUNT(*) as c FROM admin_logs').get() as any).c,
    };

    // FFmpeg/FFprobe checks
    let ffmpegInstalled = false;
    let ffprobeInstalled = false;
    try {
      execSync('ffmpeg -version', { stdio: 'ignore' });
      ffmpegInstalled = true;
    } catch {}
    try {
      execSync('ffprobe -version', { stdio: 'ignore' });
      ffprobeInstalled = true;
    } catch {}

    res.json({
      uptime,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      env: process.env.NODE_ENV || 'development',
      timeZone: APP_TZ || 'Europe/Athens',
      os: {
        totalMem,
        freeMem,
        cpus: cpus.length,
        cpuModel: cpus[0]?.model || 'Generic CPU',
        loadAvg
      },
      processMemory: process.memoryUsage(),
      database: {
        integrity: dbIntegrity,
        dbSize: fs.existsSync(path.join(DATA_DIR, 'viewtube.db')) ? fs.statSync(path.join(DATA_DIR, 'viewtube.db')).size : 0,
        records
      },
      directories: directoriesHealth,
      utilities: {
        ffmpegInstalled,
        ffprobeInstalled
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to compile system health metrics: ' + err.message });
  }
});

// Scan for orphaned and broken files
app.get('/api/admin/cleaner/scan', auth, requireAuth, requireAdminOrModerator, (_req, res) => {
  try {
    // 1. Fetch referenced files in Database
    const videos = db.prepare('SELECT id, title, video_path, thumbnail_url, channel_id FROM videos').all() as any[];
    const channels = db.prepare('SELECT id, name, avatar, banner_image FROM channels').all() as any[];
    const playlists = db.prepare('SELECT id, name, cover_thumbnail FROM playlists').all() as any[];

    const dbVideoPaths = new Set(videos.map(v => v.video_path ? path.resolve(v.video_path) : null).filter(Boolean));
    const dbThumbUrls = new Set(videos.map(v => v.thumbnail_url).filter(Boolean));
    const dbAvatarUrls = new Set(channels.map(c => c.avatar).filter(Boolean));
    const dbBannerUrls = new Set(channels.map(c => c.banner_image).filter(Boolean));
    playlists.forEach(p => {
      if (p.cover_thumbnail) dbThumbUrls.add(p.cover_thumbnail);
    });

    // Helper to find all files recursively in a directory
    const getAllFiles = (dir: string): string[] => {
      if (!fs.existsSync(dir)) return [];
      const results: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...getAllFiles(full));
        } else if (entry.isFile()) {
          results.push(full);
        }
      }
      return results;
    };

    const videosDir = path.join(UPLOAD_DIR, 'videos');
    const thumbsDir = path.join(UPLOAD_DIR, 'thumbnails');
    const avatarsDir = path.join(UPLOAD_DIR, 'avatars');
    const bannersDir = path.join(UPLOAD_DIR, 'banners');

    const diskVideoFiles = getAllFiles(videosDir);
    const diskThumbFiles = getAllFiles(thumbsDir);
    const diskAvatarFiles = getAllFiles(avatarsDir);
    const diskBannerFiles = getAllFiles(bannersDir);

    const orphanedFiles: { path: string; size: number; mtime: string; type: string }[] = [];

    // Process orphaned videos
    diskVideoFiles.forEach(f => {
      const resolved = path.resolve(f);
      if (!dbVideoPaths.has(resolved)) {
        const stat = fs.statSync(f);
        orphanedFiles.push({
          path: f,
          size: stat.size,
          mtime: stat.mtime.toISOString(),
          type: 'video'
        });
      }
    });

    // Helper to process orphaned media uploads by URL match
    const processOrphanUrlMatch = (files: string[], dbUrls: Set<string>, type: string) => {
      files.forEach(f => {
        // Find filename part and check if anywhere in dbUrls as a suffix/match
        const base = path.basename(f);
        let found = false;
        for (const url of dbUrls) {
          if (url.includes(base)) {
            found = true;
            break;
          }
        }
        if (!found) {
          try {
            const stat = fs.statSync(f);
            orphanedFiles.push({
              path: f,
              size: stat.size,
              mtime: stat.mtime.toISOString(),
              type
            });
          } catch {}
        }
      });
    };

    processOrphanUrlMatch(diskThumbFiles, dbThumbUrls, 'thumbnail');
    processOrphanUrlMatch(diskAvatarFiles, dbAvatarUrls, 'avatar');
    processOrphanUrlMatch(diskBannerFiles, dbBannerUrls, 'banner');

    // 2. Identify Broken entries: videos in DB that have missing files on disk
    const brokenDbEntries: { id: string; title: string; videoPath: string; channelId: string }[] = [];
    videos.forEach(v => {
      if (v.video_path) {
        if (!fs.existsSync(v.video_path)) {
          brokenDbEntries.push({
            id: v.id,
            title: v.title,
            videoPath: v.video_path,
            channelId: v.channel_id
          });
        }
      } else {
        // Video has no video_path entry or source path at all
        brokenDbEntries.push({
          id: v.id,
          title: v.title,
          videoPath: 'NOT_FOUND/MAPPED',
          channelId: v.channel_id
        });
      }
    });

    res.json({
      orphanedFiles,
      brokenDbEntries,
      orphansTotalSize: orphanedFiles.reduce((acc, f) => acc + f.size, 0)
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Scan cleaner failed: ' + err.message });
  }
});

// Purge specific or all orphaned files
app.post('/api/admin/cleaner/purge', auth, requireAuth, requireAdminOrModerator, (req: any, res) => {
  const { filePaths } = req.body as { filePaths?: string[] };
  try {
    let deletedCount = 0;
    let bytesReclaimed = 0;
    
    // Safety check: only allow files inside DATA_DIR / UPLOAD_DIR
    const resolvedUploads = path.resolve(UPLOAD_DIR);

    if (filePaths && Array.isArray(filePaths)) {
      filePaths.forEach((f: string) => {
        const filePathResolved = path.resolve(f);
        // Security guard: protect system files or other absolute path traversal
        if (!filePathResolved.startsWith(resolvedUploads)) {
          return; // Skip unauthorized file deletions
        }

        if (fs.existsSync(filePathResolved)) {
          try {
            const stat = fs.statSync(filePathResolved);
            bytesReclaimed += stat.size;
            fs.unlinkSync(filePathResolved);
            deletedCount++;
          } catch (err) {
            console.error(`Failed to delete orphaned file: ${filePathResolved}`, err);
          }
        }
      });
    }

    if (deletedCount > 0) {
      logAdminAction(req, 'CLEANUP_ORPHANS', `Purged ${deletedCount} orphaned files. Reclaimed ${(bytesReclaimed/1024/1024).toFixed(2)} MB.`);
    }

    res.json({
      success: true,
      deletedCount,
      bytesReclaimed
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to purge requested orphaned files: ' + err.message });
  }
});

// Repair: delete broken DB videos that have missing files
app.post('/api/admin/cleaner/repair-db', auth, requireAuth, requireAdminOrModerator, (req: any, res) => {
  const { videoIds } = req.body as { videoIds: string[] };
  if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
    return res.status(400).json({ error: 'No video IDs provided for repair' });
  }

  try {
    const dbtxn = db.transaction(() => {
      videoIds.forEach(id => {
        // Cascade manually if needed, db foreign keys will delete comments but to be safe
        db.prepare('DELETE FROM video_categories WHERE video_id = ?').run(id);
        db.prepare('DELETE FROM playlist_videos WHERE video_id = ?').run(id);
        db.prepare('DELETE FROM comments WHERE video_id = ?').run(id);
        db.prepare('DELETE FROM video_likes WHERE video_id = ?').run(id);
        db.prepare('DELETE FROM watch_history WHERE video_id = ?').run(id);
        db.prepare('DELETE FROM videos WHERE id = ?').run(id);
      });
    });

    dbtxn();

    logAdminAction(req, 'REPAIR_BROKEN_DB_ENTRIES', `Pruned ${videoIds.length} broken video database entries with missing physical files.`);

    res.json({
      success: true,
      repairedCount: videoIds.length
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Repair broken DB videos failed: ' + err.message });
  }
});

// ── SPA fallback ──
if (process.env.NODE_ENV === 'production' && fs.existsSync(distPath)) {
  app.get(/(.*)/, (req, res, next) => {
    if (req.url.startsWith('/api/') || req.url.startsWith('/uploads/')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else if (process.env.NODE_ENV !== 'production') {
  // Vite dev middleware is added asynchronously
  import('vite').then(({ createServer: createViteServer }) => {
    createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    }).then(vite => {
      app.use(vite.middlewares);
    });
  }).catch(() => {
    console.warn('Vite not found. Dev frontend unavailable.');
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 ViewTube server running at http://localhost:${PORT}`);
  console.log(`📁 Data directory: ${DATA_DIR}`);
  console.log(`🗄️  Database: ${DATA_DIR}/viewtube.db`);
  console.log(`🔐 Access token: ${ACCESS_TOKEN_EXPIRY} | Refresh token: ${REFRESH_TOKEN_DAYS}d\n`);
});
