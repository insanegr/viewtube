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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3001');
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

// Serve frontend in production
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
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
  // Authenticated admin via access token
  if (getRoleFromAccessToken(req) === 'admin') return true;

  // Admin login attempt by email
  if (req.path.includes('/auth/login')) {
    const email = (req.body as any)?.email;
    if (!email) return false;
    const user = db.prepare('SELECT role FROM channels WHERE email = ?').get(email) as any;
    return user?.role === 'admin';
  }

  // Admin refresh attempt by refresh token
  if (req.path.includes('/auth/refresh')) {
    const refreshToken = (req.body as any)?.refreshToken;
    if (!refreshToken) return false;
    const row = db.prepare('SELECT c.role FROM refresh_tokens rt JOIN channels c ON c.id = rt.channel_id WHERE rt.token = ?').get(refreshToken) as any;
    return row?.role === 'admin';
  }

  return false;
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
// user: 20/hour, vip: 50/hour, admin: unlimited
const uploadAttempts = new Map<string, number[]>();
function uploadLimiter(req: any, res: any, next: any) {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (user.role === 'admin') return next();

  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const limit = user.role === 'vip' ? 50 : 20;
  const key = user.id;
  const timestamps = (uploadAttempts.get(key) || []).filter((ts) => now - ts < windowMs);

  if (timestamps.length >= limit) {
    return res.status(429).json({
      error: user.role === 'vip'
        ? 'VIP upload limit reached (50/hour). Please try again later.'
        : 'Upload limit reached (20/hour). Please try again later.',
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

// ── Helper: get video with categories + channel info ──
function getVideoFull(row: any) {
  if (!row) return null;
  const cats = db.prepare('SELECT category_name FROM video_categories WHERE video_id = ?').all(row.id) as any[];
  const ch = db.prepare('SELECT name, avatar FROM channels WHERE id = ?').get(row.channel_id) as any;
  return {
    id: row.id, title: row.title, description: row.description,
    thumbnailUrl: row.thumbnail_url, videoUrl: row.video_url || row.video_path,
    duration: row.duration, views: row.views, likes: row.likes, dislikes: row.dislikes,
    uploadDate: row.upload_date, channelId: row.channel_id,
    channelName: ch?.name || '', channelAvatar: ch?.avatar || '',
    visibility: row.visibility, categories: cats.map((c: any) => c.category_name),
  };
}

// ══════════════════════════════════════════
// AUTH ROUTES
// ══════════════════════════════════════════
app.post('/api/auth/login', authLimiter, (req, res) => {
  const { identifier, password } = req.body;
  const user = db.prepare('SELECT * FROM channels WHERE email = ? OR username = ?').get(identifier, identifier) as any;
  if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid credentials' });
  res.json(issueTokens(user));
});

app.post('/api/auth/register', authLimiter, (req, res) => {
  const { name, username, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  if (password.length < 4) return res.status(400).json({ error: 'Password too short' });
  const existing = db.prepare('SELECT id FROM channels WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already in use' });

  const base = (username || name || email.split('@')[0]).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'user';
  let finalUsername = base;
  let n = 2;
  while (db.prepare('SELECT 1 FROM channels WHERE username = ?').get(finalUsername)) {
    finalUsername = `${base}-${n++}`;
  }

  const id = `ch-${uuidv4()}`;
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO channels (id,name,username,email,password) VALUES (?,?,?,?,?)').run(id, name, finalUsername, email, hash);
  const user = db.prepare('SELECT * FROM channels WHERE id = ?').get(id) as any;
  res.json(issueTokens(user));
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
  // Include VIP videos for everyone so they show up as "locked/blurred" in the UI.
  // Private and Unlisted stay hidden unless owner/admin.
  let rows: any[] = [];
  if (role === 'admin') {
    rows = db.prepare("SELECT * FROM videos ORDER BY created_at DESC").all();
  } else if (req.user) {
    rows = db.prepare("SELECT * FROM videos WHERE visibility IN ('public', 'unlisted', 'vip') OR channel_id = ? ORDER BY created_at DESC").all(req.user.id);
  } else {
    rows = db.prepare("SELECT * FROM videos WHERE visibility IN ('public', 'vip') ORDER BY created_at DESC").all();
  }
  res.json(rows.map(getVideoFull));
});

app.get('/api/videos/:id', auth, (req: any, res) => {
  const row = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: 'Not found' });
  const role = req.user?.role || 'guest';
  if (row.visibility === 'private' && row.channel_id !== req.user?.id && role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  if (row.visibility === 'vip' && role !== 'vip' && role !== 'admin' && row.channel_id !== req.user?.id) return res.status(403).json({ error: 'Forbidden' });
  if (row.visibility === 'unlisted' && row.channel_id !== req.user?.id && role === 'guest') {
    // allowed if direct link? keep existing behavior: direct access okay
  }
  res.json(getVideoFull(row));
});

app.post('/api/videos/:id/view', auth, (req: any, res) => {
  db.prepare('UPDATE videos SET views = views + 1 WHERE id = ?').run(req.params.id);
  db.prepare('INSERT INTO view_events (video_id, channel_id, created_at) VALUES (?, ?, ?)').run(req.params.id, req.user?.id || null, localDateTimeString());
  res.json({ ok: true });
});

app.post('/api/videos', auth, requireAuth, uploadLimiter, upload.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]), (req: any, res) => {
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
  const video = db.prepare('SELECT * FROM videos WHERE id = ? AND channel_id = ?').get(req.params.id, req.user.id) as any;
  if (!video) return res.status(404).json({ error: 'Not found' });

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
  db.prepare('DELETE FROM videos WHERE id = ? AND channel_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// ── Likes ──
app.post('/api/videos/:id/like', auth, requireAuth, (req: any, res) => {
  const existing = db.prepare('SELECT type FROM video_likes WHERE channel_id = ? AND video_id = ?').get(req.user.id, req.params.id) as any;
  if (existing?.type === 'like') {
    db.prepare('DELETE FROM video_likes WHERE channel_id = ? AND video_id = ?').run(req.user.id, req.params.id);
    db.prepare('UPDATE videos SET likes = likes - 1 WHERE id = ?').run(req.params.id);
  } else {
    if (existing?.type === 'dislike') db.prepare('UPDATE videos SET dislikes = dislikes - 1 WHERE id = ?').run(req.params.id);
    db.prepare('INSERT OR REPLACE INTO video_likes (channel_id,video_id,type) VALUES (?,?,?)').run(req.user.id, req.params.id, 'like');
    db.prepare('UPDATE videos SET likes = likes + 1 WHERE id = ?').run(req.params.id);
    // Log event for analytics timeline
    db.prepare('INSERT INTO like_events (video_id, channel_id, created_at) VALUES (?, ?, ?)').run(req.params.id, req.user.id, localDateTimeString());
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
app.get('/api/channels', (_req, res) => {
  const rows = db.prepare('SELECT id,name,avatar,banner_image,description,subscriber_count,role,country FROM channels').all();
  res.json(rows.map((r: any) => ({ id: r.id, name: r.name, avatar: r.avatar, bannerImage: r.banner_image, description: r.description, subscriberCount: r.subscriber_count, role: r.role, country: r.country })));
});

app.put('/api/channels/me', auth, requireAuth, upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), (req: any, res) => {
  const { name, username, description, email, country, notificationsEnabled, password } = req.body;
  if (name) db.prepare('UPDATE channels SET name = ? WHERE id = ?').run(name, req.user.id);
  if (username) {
    const exists = db.prepare('SELECT id FROM channels WHERE username = ? AND id != ?').get(username, req.user.id);
    if (exists) return res.status(409).json({ error: 'Username already in use' });
    db.prepare('UPDATE channels SET username = ? WHERE id = ?').run(username, req.user.id);
  }
  if (description !== undefined) db.prepare('UPDATE channels SET description = ? WHERE id = ?').run(description, req.user.id);
  if (email) db.prepare('UPDATE channels SET email = ? WHERE id = ?').run(email, req.user.id);
  if (country) db.prepare('UPDATE channels SET country = ? WHERE id = ?').run(country, req.user.id);
  if (notificationsEnabled !== undefined) db.prepare('UPDATE channels SET notifications_enabled = ? WHERE id = ?').run(notificationsEnabled === 'true' || notificationsEnabled === true ? 1 : 0, req.user.id);
  if (password) db.prepare('UPDATE channels SET password = ?, must_change_password = 0 WHERE id = ?').run(bcrypt.hashSync(password, 10), req.user.id);
  if (req.files?.avatar?.[0]) db.prepare('UPDATE channels SET avatar = ? WHERE id = ?').run(`/uploads/avatars/${req.files.avatar[0].filename}`, req.user.id);
  if (req.files?.banner?.[0]) db.prepare('UPDATE channels SET banner_image = ? WHERE id = ?').run(`/uploads/banners/${req.files.banner[0].filename}`, req.user.id);
  const user = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.user.id) as any;
  res.json(formatUser(user));
});

app.put('/api/channels/:id/role', auth, requireAuth, (req: any, res) => {
  const admin = db.prepare('SELECT role FROM channels WHERE id = ?').get(req.user.id) as any;
  if (admin?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  db.prepare('UPDATE channels SET role = ? WHERE id = ?').run(req.body.role, req.params.id);
  res.json({ ok: true });
});

// ── Subscriptions ──
app.post('/api/subscribe/:channelId', auth, requireAuth, (req: any, res) => {
  const existing = db.prepare('SELECT 1 FROM subscriptions WHERE subscriber_id = ? AND channel_id = ?').get(req.user.id, req.params.channelId);
  if (existing) {
    db.prepare('DELETE FROM subscriptions WHERE subscriber_id = ? AND channel_id = ?').run(req.user.id, req.params.channelId);
    db.prepare('UPDATE channels SET subscriber_count = subscriber_count - 1 WHERE id = ?').run(req.params.channelId);
  } else {
    db.prepare('INSERT INTO subscriptions (subscriber_id,channel_id) VALUES (?,?)').run(req.user.id, req.params.channelId);
    db.prepare('UPDATE channels SET subscriber_count = subscriber_count + 1 WHERE id = ?').run(req.params.channelId);
    // Log event for analytics timeline
    db.prepare('INSERT INTO sub_events (channel_id, subscriber_id, created_at) VALUES (?, ?, ?)').run(req.params.channelId, req.user.id, localDateTimeString());
  }
  res.json({ subscribed: !existing });
});

app.get('/api/subscriptions', auth, requireAuth, (req: any, res) => {
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
  res.json(rows.map((r: any) => ({ id: r.id, videoId: r.video_id, channelId: r.channel_id, channelName: r.channel_name, channelAvatar: r.channel_avatar, text: r.text, date: r.created_at, likes: r.likes })));
});

app.post('/api/videos/:id/comments', auth, requireAuth, (req: any, res) => {
  const id = `c-${uuidv4()}`;
  const createdAt = localDateTimeString();
  db.prepare('INSERT INTO comments (id,video_id,channel_id,text,created_at) VALUES (?,?,?,?,?)').run(id, req.params.id, req.user.id, req.body.text, createdAt);
  const ch = db.prepare('SELECT name, avatar FROM channels WHERE id = ?').get(req.user.id) as any;
  res.json({ id, videoId: req.params.id, channelId: req.user.id, channelName: ch?.name, channelAvatar: ch?.avatar, text: req.body.text, date: createdAt, likes: 0 });
});

// ══════════════════════════════════════════
// PLAYLISTS
// ══════════════════════════════════════════
app.get('/api/playlists', auth, requireAuth, (req: any, res) => {
  const rows = db.prepare('SELECT * FROM playlists WHERE channel_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(rows.map((r: any) => {
    const vids = db.prepare('SELECT video_id FROM playlist_videos WHERE playlist_id = ? ORDER BY position').all(r.id) as any[];
    return { id: r.id, name: r.name, description: r.description, coverThumbnail: r.cover_thumbnail, videoIds: vids.map((v: any) => v.video_id), channelId: r.channel_id, createdAt: r.created_at };
  }));
});

app.post('/api/playlists', auth, requireAuth, (req: any, res) => {
  const id = `pl-${uuidv4()}`;
  const createdAt = localDateTimeString();
  db.prepare('INSERT INTO playlists (id,name,description,channel_id,created_at) VALUES (?,?,?,?,?)').run(id, req.body.name, req.body.description || '', req.user.id, createdAt);
  res.json({ id, name: req.body.name, description: req.body.description || '', coverThumbnail: '', videoIds: [], channelId: req.user.id, createdAt });
});

app.delete('/api/playlists/:id', auth, requireAuth, (req: any, res) => {
  db.prepare('DELETE FROM playlists WHERE id = ? AND channel_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

app.post('/api/playlists/:id/videos', auth, requireAuth, (req: any, res) => {
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
  const days = parseInt(req.query.days as string) || 30;
  const userId = req.user.id;

  // Get user's video IDs
  const myVideoIds = (db.prepare('SELECT id FROM videos WHERE channel_id = ?').all(userId) as any[]).map((r: any) => r.id);
  if (myVideoIds.length === 0) return res.json({ views: [], likes: [], subscribers: [], totals: { views: 0, likes: 0, comments: 0, videos: 0 } });

  const placeholders = myVideoIds.map(() => '?').join(',');

  // Views per day (last N days)
  const viewsPerDay = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as count
    FROM view_events
    WHERE video_id IN (${placeholders})
      AND created_at >= datetime('now', '-${days} days')
    GROUP BY day ORDER BY day
  `).all(...myVideoIds) as any[];

  // Likes per day
  const likesPerDay = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as count
    FROM like_events
    WHERE video_id IN (${placeholders})
      AND created_at >= datetime('now', '-${days} days')
    GROUP BY day ORDER BY day
  `).all(...myVideoIds) as any[];

  // Subscribers per day
  const subsPerDay = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as count
    FROM sub_events
    WHERE channel_id = ?
      AND created_at >= datetime('now', '-${days} days')
    GROUP BY day ORDER BY day
  `).all(userId) as any[];

  // Fill in missing days with 0
  const fillDays = (data: any[]) => {
    const map = new Map(data.map((d: any) => [d.day, d.count]));
    const result: { day: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      result.push({ day: key, count: map.get(key) || 0 });
    }
    return result;
  };

  // Totals
  const totalViews = myVideoIds.length > 0 ? (db.prepare(`SELECT SUM(views) as s FROM videos WHERE channel_id = ?`).get(userId) as any)?.s || 0 : 0;
  const totalLikes = myVideoIds.length > 0 ? (db.prepare(`SELECT SUM(likes) as s FROM videos WHERE channel_id = ?`).get(userId) as any)?.s || 0 : 0;
  const totalComments = myVideoIds.length > 0 ? (db.prepare(`SELECT COUNT(*) as c FROM comments WHERE video_id IN (${placeholders})`).get(...myVideoIds) as any)?.c || 0 : 0;

  // Top videos
  const topVideos = db.prepare(`SELECT id, title, views, likes FROM videos WHERE channel_id = ? ORDER BY views DESC LIMIT 10`).all(userId);

  res.json({
    views: fillDays(viewsPerDay),
    likes: fillDays(likesPerDay),
    subscribers: fillDays(subsPerDay),
    totals: { views: totalViews, likes: totalLikes, comments: totalComments, videos: myVideoIds.length },
    topVideos,
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
    const files = scanImportDir(full, relative ? '' : '', recursive).map((f) => ({ ...f, path: path.join(relative, f.path).replace(/\\/g, '/').replace(/^\//, '') }));
    res.json({ importDir: IMPORT_DIR, selectedPath: relative.replace(/\\/g, '/'), files, hasFFmpeg });
  } catch {
    res.status(400).json({ error: 'Invalid path' });
  }
});

// Import selected files
app.post('/api/import/run', auth, requireAuth, (req: any, res) => {
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

      // Skip if already imported by same title+channel
      const existing = db.prepare('SELECT id FROM videos WHERE title = ? AND channel_id = ?').get(title, req.user.id);
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

  res.json({ results, imported: results.filter((r) => r.status === 'ok').length, skipped: results.filter((r) => r.status === 'skip').length, errors: results.filter((r) => r.status === 'error').length });
});

// ══════════════════════════════════════════
// ADMIN RECOVERY REQUESTS
// ══════════════════════════════════════════
app.get('/api/admin/recovery-requests', auth, requireAuth, requireAdmin, (_req, res) => {
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

app.post('/api/admin/recovery-requests/:id/reset', auth, requireAuth, requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM password_reset_requests WHERE id = ?').get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: 'Request not found' });
  if (!row.channel_id) return res.status(400).json({ error: 'No linked user account found for this request' });

  const tempPassword = Math.random().toString(36).slice(2, 10);
  const hash = bcrypt.hashSync(tempPassword, 10);
  db.prepare('UPDATE channels SET password = ?, must_change_password = 1 WHERE id = ?').run(hash, row.channel_id);
  db.prepare('UPDATE password_reset_requests SET status = ?, temp_password = ?, resolved_at = ? WHERE id = ?').run('resolved', tempPassword, localDateTimeString(), req.params.id);
  res.json({ ok: true, tempPassword });
});

app.post('/api/admin/recovery-requests/:id/dismiss', auth, requireAuth, requireAdmin, (req, res) => {
  db.prepare('UPDATE password_reset_requests SET status = ?, resolved_at = ? WHERE id = ?').run('dismissed', localDateTimeString(), req.params.id);
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
app.get('/api/admin/storage', auth, requireAuth, requireAdmin, (_req, res) => {
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
app.post('/api/admin/backups', auth, requireAuth, requireAdmin, (_req, res) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupName = `viewtube-${timestamp}.db`;
  const src = path.join(DATA_DIR, 'viewtube.db');
  const dest = path.join(BACKUP_DIR, backupName);
  if (!fs.existsSync(src)) return res.status(404).json({ error: 'Database not found' });
  // Use SQLite backup API for safe copy while DB is in use
  db.backup(dest).then(() => {
    const stat = fs.statSync(dest);
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
app.get('/api/admin/download-db', auth, requireAuth, requireAdmin, (_req, res) => {
  const dbPath = path.join(DATA_DIR, 'viewtube.db');
  if (!fs.existsSync(dbPath)) return res.status(404).json({ error: 'Database not found' });
  // Create a temp safe copy first
  const tempPath = path.join(BACKUP_DIR, `_live-download-${Date.now()}.db`);
  db.backup(tempPath).then(() => {
    res.download(tempPath, 'viewtube.db', () => { try { fs.unlinkSync(tempPath); } catch {} });
  }).catch((err: any) => {
    res.status(500).json({ error: err.message || 'Download failed' });
  });
});

// Delete backup
app.delete('/api/admin/backups/:name', auth, requireAuth, requireAdmin, (req, res) => {
  const filePath = path.join(BACKUP_DIR, req.params.name);
  if (!fs.existsSync(filePath) || !req.params.name.endsWith('.db')) return res.status(404).json({ error: 'Not found' });
  fs.unlinkSync(filePath);
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
    res.json({ ok: true, safetyBackup: safetyName, message: 'Database restored. Restart the server for changes to take full effect.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Restore failed' });
  }
});

// ── SPA fallback ──
if (fs.existsSync(distPath)) {
  app.get('{*path}', (_req, res) => { res.sendFile(path.join(distPath, 'index.html')); });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 ViewTube server running at http://localhost:${PORT}`);
  console.log(`📁 Data directory: ${DATA_DIR}`);
  console.log(`🗄️  Database: ${DATA_DIR}/viewtube.db`);
  console.log(`🔐 Access token: ${ACCESS_TOKEN_EXPIRY} | Refresh token: ${REFRESH_TOKEN_DAYS}d\n`);
});
