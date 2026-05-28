import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

const _dirname = path.resolve();
const DATA_DIR = process.env.DATA_DIR || path.join(_dirname, 'server', 'data');
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
    role TEXT DEFAULT 'user' CHECK(role IN ('user','vip','vip+','vip++','moderator','moderator_vip_plus','moderator_vip_plus_plus','admin')),
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
    visibility TEXT DEFAULT 'public' CHECK(visibility IN ('public','unlisted','private','user','vip','vip+','vip++')),
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
    parent_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
    FOREIGN KEY (channel_id) REFERENCES channels(id),
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
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

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('comment','reply','subscribe','like','role_upgrade')),
    target_channel_id TEXT NOT NULL,
    from_channel_id TEXT,
    from_channel_name TEXT,
    from_channel_avatar TEXT,
    video_id TEXT,
    video_title TEXT,
    comment_text TEXT,
    new_role TEXT,
    read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (target_channel_id) REFERENCES channels(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS admin_logs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    details TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS blacklist (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    banned_by TEXT,
    reason TEXT,
    banned_until TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('video','comment','ban_request')),
    target_id TEXT NOT NULL,
    reporter_id TEXT,
    reason TEXT NOT NULL,
    details TEXT DEFAULT '',
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','resolved','dismissed')),
    weight REAL DEFAULT 1.0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (reporter_id) REFERENCES channels(id) ON DELETE SET NULL
  );
`);

  // Create indexes for optimization
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at);
    CREATE INDEX IF NOT EXISTS idx_videos_channel_id ON videos(channel_id);
    CREATE INDEX IF NOT EXISTS idx_videos_visibility ON videos(visibility);
    CREATE INDEX IF NOT EXISTS idx_video_categories_category_name ON video_categories(category_name);
  `);

  // Ensure notifications table supports new mute/unmute/ban/unban types
  const notifTableSql = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='notifications'").get() as any)?.sql || '';
  if (!notifTableSql.includes("'mute'") || !notifTableSql.includes("'ban'")) {
    try {
      db.pragma('foreign_keys = OFF');
      db.exec(`
        CREATE TABLE notifications_new (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL CHECK(type IN ('comment','reply','subscribe','like','role_upgrade','mute','unmute','ban','unban')),
          target_channel_id TEXT NOT NULL,
          from_channel_id TEXT,
          from_channel_name TEXT,
          from_channel_avatar TEXT,
          video_id TEXT,
          video_title TEXT,
          comment_text TEXT,
          new_role TEXT,
          read INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (target_channel_id) REFERENCES channels(id) ON DELETE CASCADE
        );
        INSERT INTO notifications_new (id, type, target_channel_id, from_channel_id, from_channel_name, from_channel_avatar, video_id, video_title, comment_text, new_role, read, created_at)
        SELECT id, type, target_channel_id, from_channel_id, from_channel_name, from_channel_avatar, video_id, video_title, comment_text, new_role, read, created_at FROM notifications;
        DROP TABLE notifications;
        ALTER TABLE notifications_new RENAME TO notifications;
      `);
      db.pragma('foreign_keys = ON');
    } catch (e) {
      console.error('Failed to migrate notifications table:', e);
      db.pragma('foreign_keys = ON');
    }
  }

  // Ensure columns exist before larger migrations
  const channelCols = (db.prepare(`PRAGMA table_info(channels)`).all() as any[]).map((c) => c.name);
  if (!channelCols.includes('username')) db.exec(`ALTER TABLE channels ADD COLUMN username TEXT`);
  if (!channelCols.includes('must_change_password')) db.exec(`ALTER TABLE channels ADD COLUMN must_change_password INTEGER DEFAULT 0`);
  if (!channelCols.includes('country')) db.exec(`ALTER TABLE channels ADD COLUMN country TEXT DEFAULT 'US'`);
  if (!channelCols.includes('bell_enabled')) db.exec(`ALTER TABLE channels ADD COLUMN bell_enabled INTEGER DEFAULT 1`);
  if (!channelCols.includes('audio_chime_enabled')) db.exec(`ALTER TABLE channels ADD COLUMN audio_chime_enabled INTEGER DEFAULT 1`);
  if (!channelCols.includes('site_notifications_enabled')) db.exec(`ALTER TABLE channels ADD COLUMN site_notifications_enabled INTEGER DEFAULT 1`);
  if (!channelCols.includes('muted_until')) db.exec(`ALTER TABLE channels ADD COLUMN muted_until TEXT`);
  if (!channelCols.includes('banned')) db.exec(`ALTER TABLE channels ADD COLUMN banned INTEGER DEFAULT 0`);

  // Ensure comments columns exist
  const commentCols = (db.prepare(`PRAGMA table_info(comments)`).all() as any[]).map((c) => c.name);
  if (!commentCols.includes('parent_id')) db.exec(`ALTER TABLE comments ADD COLUMN parent_id TEXT`);

  // Ensure playlists columns exist
  const playlistCols = (db.prepare(`PRAGMA table_info(playlists)`).all() as any[]).map((c) => c.name);
  if (!playlistCols.includes('visibility')) db.exec(`ALTER TABLE playlists ADD COLUMN visibility TEXT DEFAULT 'public'`);

  // ── Migrate tables for hierarchical roles and visibility ──
  db.pragma('foreign_keys = OFF');
  
  const channelTableSql = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='channels'").get() as any)?.sql || '';
  if (!channelTableSql.includes("'moderator_vip_plus'") || !channelTableSql.includes("'vip+'") || !channelTableSql.includes("'moderator'")) {
    try {
      db.exec(`
        CREATE TABLE channels_new (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          username TEXT UNIQUE,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          avatar TEXT DEFAULT '',
          banner_image TEXT DEFAULT '',
          description TEXT DEFAULT '',
          subscriber_count INTEGER DEFAULT 0,
          role TEXT DEFAULT 'user' CHECK(role IN ('user','vip','vip+','vip++','moderator','moderator_vip_plus','moderator_vip_plus_plus','admin')),
          notifications_enabled INTEGER DEFAULT 1,
          must_change_password INTEGER DEFAULT 0,
          country TEXT DEFAULT 'US',
          created_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO channels_new (id, name, username, email, password, avatar, banner_image, description, subscriber_count, role, notifications_enabled, must_change_password, country, created_at)
        SELECT id, name, username, email, password, avatar, banner_image, description, subscriber_count, role, notifications_enabled, must_change_password, country, created_at FROM channels;
        DROP TABLE channels;
        ALTER TABLE channels_new RENAME TO channels;
      `);
    } catch (e) {
      console.error('Channel migration failed (likely fresh install or already migrated):', e);
    }
  }

  const videoTableSql = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='videos'").get() as any)?.sql || '';
  if (!videoTableSql.includes("'vip++'")) {
    try {
      db.exec(`
        CREATE TABLE videos_new (
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
          visibility TEXT DEFAULT 'public' CHECK(visibility IN ('public','unlisted','private','user','vip','vip+','vip++')),
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (channel_id) REFERENCES channels(id)
        );
        INSERT INTO videos_new (id, title, description, thumbnail_url, video_url, video_path, mime_type, file_size, duration, views, likes, dislikes, upload_date, channel_id, visibility, created_at)
        SELECT id, title, description, thumbnail_url, video_url, video_path, mime_type, file_size, duration, views, likes, dislikes, upload_date, channel_id, visibility, created_at FROM videos;
        DROP TABLE videos;
        ALTER TABLE videos_new RENAME TO videos;
      `);
    } catch (e) {
      console.error('Video migration failed (likely fresh install or already migrated):', e);
    }
  }
  
  db.pragma('foreign_keys = ON');

  // Backfill usernames for existing rows if missing
  try {
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
  } catch (e) {
    console.error('Username backfill failed:', e);
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
