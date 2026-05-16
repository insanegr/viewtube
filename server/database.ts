import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'uploads', 'videos'), { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'uploads', 'thumbnails'), { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'uploads', 'avatars'), { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'uploads', 'banners'), { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'viewtube.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Create tables ──
db.exec(`
  CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT UNIQUE,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    avatar TEXT DEFAULT '',
    banner_image TEXT DEFAULT '',
    description TEXT DEFAULT '',
    subscriber_count INTEGER DEFAULT 0,
    role TEXT DEFAULT 'user' CHECK(role IN ('user','vip','admin')),
    notifications_enabled INTEGER DEFAULT 1,
    must_change_password INTEGER DEFAULT 0,
    country TEXT DEFAULT 'US',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    thumbnail_url TEXT DEFAULT '',
    video_url TEXT DEFAULT '',
    video_path TEXT DEFAULT '',
    mime_type TEXT DEFAULT 'video/mp4',
    file_size INTEGER DEFAULT 0,
    duration REAL DEFAULT 0,
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    dislikes INTEGER DEFAULT 0,
    upload_date TEXT DEFAULT (date('now')),
    channel_id TEXT NOT NULL,
    visibility TEXT DEFAULT 'public' CHECK(visibility IN ('public','unlisted','private','vip')),
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (channel_id) REFERENCES channels(id)
  );

  CREATE TABLE IF NOT EXISTS video_categories (
    video_id TEXT NOT NULL,
    category_name TEXT NOT NULL,
    PRIMARY KEY (video_id, category_name),
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    name_el TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    cover_thumbnail TEXT DEFAULT '',
    channel_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (channel_id) REFERENCES channels(id)
  );

  CREATE TABLE IF NOT EXISTS playlist_videos (
    playlist_id TEXT NOT NULL,
    video_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    PRIMARY KEY (playlist_id, video_id),
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    video_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    text TEXT NOT NULL,
    likes INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
    FOREIGN KEY (channel_id) REFERENCES channels(id)
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    subscriber_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    PRIMARY KEY (subscriber_id, channel_id),
    FOREIGN KEY (subscriber_id) REFERENCES channels(id),
    FOREIGN KEY (channel_id) REFERENCES channels(id)
  );

  CREATE TABLE IF NOT EXISTS video_likes (
    channel_id TEXT NOT NULL,
    video_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('like','dislike')),
    PRIMARY KEY (channel_id, video_id),
    FOREIGN KEY (channel_id) REFERENCES channels(id),
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS password_reset_requests (
    id TEXT PRIMARY KEY,
    channel_id TEXT,
    identifier TEXT NOT NULL,
    note TEXT DEFAULT '',
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','resolved','dismissed')),
    temp_password TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    resolved_at TEXT DEFAULT '',
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS watch_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT NOT NULL,
    video_id TEXT NOT NULL,
    progress REAL DEFAULT 0,
    watched_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS view_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id TEXT NOT NULL,
    channel_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS like_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sub_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT NOT NULL,
    subscriber_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ── Lightweight migrations for existing installs ──
const channelCols = (db.prepare(`PRAGMA table_info(channels)`).all() as any[]).map((c) => c.name);
if (!channelCols.includes('username')) db.exec(`ALTER TABLE channels ADD COLUMN username TEXT`);
if (!channelCols.includes('must_change_password')) db.exec(`ALTER TABLE channels ADD COLUMN must_change_password INTEGER DEFAULT 0`);

// Backfill usernames for existing rows if missing
const rowsNoUsername = db.prepare(`SELECT id, name, email FROM channels WHERE username IS NULL OR username = ''`).all() as any[];
for (const row of rowsNoUsername) {
  const base = (row.name || row.email?.split('@')[0] || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'user';
  let username = base;
  let n = 2;
  while (db.prepare('SELECT 1 FROM channels WHERE username = ? AND id != ?').get(username, row.id)) {
    username = `${base}-${n++}`;
  }
  db.prepare('UPDATE channels SET username = ? WHERE id = ?').run(username, row.id);
}

// Migrate videos table to support VIP-only visibility if needed
const videoTableSql = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='videos'").get() as any)?.sql || '';
if (!videoTableSql.includes("'vip'")) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS videos_new (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      thumbnail_url TEXT DEFAULT '',
      video_url TEXT DEFAULT '',
      video_path TEXT DEFAULT '',
      mime_type TEXT DEFAULT 'video/mp4',
      file_size INTEGER DEFAULT 0,
      duration REAL DEFAULT 0,
      views INTEGER DEFAULT 0,
      likes INTEGER DEFAULT 0,
      dislikes INTEGER DEFAULT 0,
      upload_date TEXT DEFAULT (date('now')),
      channel_id TEXT NOT NULL,
      visibility TEXT DEFAULT 'public' CHECK(visibility IN ('public','unlisted','private','vip')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (channel_id) REFERENCES channels(id)
    );
    INSERT INTO videos_new SELECT * FROM videos;
    DROP TABLE videos;
    ALTER TABLE videos_new RENAME TO videos;
  `);
}

// ── Seed: only create admin account + default categories if DB is empty ──
const channelCount = (db.prepare('SELECT COUNT(*) as c FROM channels').get() as any).c;
if (channelCount === 0) {
  // Read admin credentials from environment or use defaults
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@viewtube.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'changeme';
  const adminName = process.env.ADMIN_NAME || 'Admin';
  const hash = bcrypt.hashSync(adminPassword, 10);

  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  db.prepare('INSERT INTO channels (id,name,username,email,password,description,role) VALUES (?,?,?,?,?,?,?)')
    .run('ch-admin', adminName, adminUsername, adminEmail, hash, '', 'admin');

  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║  Admin account created                   ║`);
  console.log(`║  Email:    ${adminEmail.padEnd(28)}║`);
  console.log(`║  Password: ${adminPassword.padEnd(28)}║`);
  console.log(`║                                          ║`);
  console.log(`║  ⚠  Change this password immediately!    ║`);
  console.log(`╚══════════════════════════════════════════╝\n`);
}

// Seed default categories if empty
const catCount = (db.prepare('SELECT COUNT(*) as c FROM categories').get() as any).c;
if (catCount === 0) {
  const insertCat = db.prepare('INSERT INTO categories (id,name,name_el) VALUES (?,?,?)');
  const cats = [
    ['Entertainment','Ψυχαγωγία'],['Music','Μουσική'],['Gaming','Παιχνίδια'],['Education','Εκπαίδευση'],
    ['Sports','Αθλητικά'],['News','Ειδήσεις'],['Technology','Τεχνολογία'],['Comedy','Κωμωδία'],
    ['Film','Ταινίες'],['Science','Επιστήμη'],
  ];
  cats.forEach(([n, el]) => insertCat.run(`cat-${n.toLowerCase()}`, n, el));
  console.log('Default categories created.');
}

export default db;
export { DATA_DIR, DB_PATH };
