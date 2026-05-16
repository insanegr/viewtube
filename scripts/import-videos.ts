#!/usr/bin/env npx tsx
/**
 * ViewTube — Bulk Video Importer
 *
 * Import videos from a local folder directly into the database
 * without uploading through the browser.
 *
 * Usage:
 *   npx tsx scripts/import-videos.ts /videos
 *   npx tsx scripts/import-videos.ts /videos --category "Gaming"
 *   npx tsx scripts/import-videos.ts /videos --category "Music" --channel "ch-admin"
 *   npx tsx scripts/import-videos.ts /videos --link
 *   npx tsx scripts/import-videos.ts /videos --move
 *   npx tsx scripts/import-videos.ts /videos --dry-run
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Parse arguments ──
const args = process.argv.slice(2);
const sourceDir = args.find((a) => !a.startsWith('--'));

if (!sourceDir) {
  console.log(`
  ViewTube — Bulk Video Importer

  Usage:
    npx tsx scripts/import-videos.ts /videos [options]

  Options:
    --category "Name"     Category for all videos (default: Entertainment)
    --channel "id"        Channel ID to assign videos to
    --visibility "mode"   public | private | unlisted (default: public)
    --link                 Symlink files instead of copying
    --move                 Move files instead of copying
    --dry-run              Preview without importing

  Notes:
    • In your Docker/Portainer setup, /videos is the read-only HDD library mount.
    • Use --link if you want to keep files on the HDD without copying them.
    • Admin login credentials come from your stack.env on first run.

  Examples:
    npx tsx scripts/import-videos.ts /videos
    npx tsx scripts/import-videos.ts /videos --category "Gaming" --link
    npx tsx scripts/import-videos.ts /videos/music --category "Music"
    npx tsx scripts/import-videos.ts /videos --dry-run
  `);
  process.exit(0);
}

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

const category = getArg('--category') || 'Entertainment';
const channelId = getArg('--channel');
const visibility = getArg('--visibility') || 'public';
const useSymlink = args.includes('--link');
const useMove = args.includes('--move');
const dryRun = args.includes('--dry-run');

// ── Paths ──
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'server', 'data');
const DB_PATH = path.join(DATA_DIR, 'viewtube.db');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const VIDEO_DIR = path.join(UPLOAD_DIR, 'videos');
const THUMB_DIR = path.join(UPLOAD_DIR, 'thumbnails');

fs.mkdirSync(VIDEO_DIR, { recursive: true });
fs.mkdirSync(THUMB_DIR, { recursive: true });

if (!fs.existsSync(DB_PATH)) {
  console.error(`❌ Database not found at ${DB_PATH}`);
  console.error('   Start the server first: npx tsx server/index.ts');
  process.exit(1);
}
if (!fs.existsSync(sourceDir)) {
  console.error(`❌ Source directory not found: ${sourceDir}`);
  process.exit(1);
}

// ── Open database ──
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

let targetChannelId = channelId;
if (!targetChannelId) {
  const first = db.prepare('SELECT id FROM channels LIMIT 1').get() as any;
  if (!first) { console.error('❌ No channels. Start server first.'); process.exit(1); }
  targetChannelId = first.id;
}

const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(targetChannelId) as any;
if (!channel) {
  console.error(`❌ Channel not found: ${targetChannelId}`);
  const all = db.prepare('SELECT id, name FROM channels').all() as any[];
  all.forEach((c) => console.error(`     ${c.id} — ${c.name}`));
  process.exit(1);
}

// ── Scan ──
const EXTS = new Set(['.mp4','.webm','.mkv','.avi','.mov','.wmv','.flv','.m4v','.3gp','.ogv','.ts']);
function scanDir(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...scanDir(p));
    else if (entry.isFile() && EXTS.has(path.extname(entry.name).toLowerCase())) files.push(p);
  }
  return files;
}

const videoFiles = scanDir(sourceDir);
if (videoFiles.length === 0) { console.log('⚠️  No video files found in', sourceDir); process.exit(0); }

console.log(`\n📂 Source:      ${sourceDir}`);
console.log(`🎬 Found:       ${videoFiles.length} video files`);
console.log(`📁 Channel:     ${channel.name} (${targetChannelId})`);
console.log(`🏷️  Category:    ${category}`);
console.log(`👁️  Visibility:  ${visibility}`);
console.log(`📋 Mode:        ${useSymlink ? 'symlink' : useMove ? 'move' : 'copy'}`);
if (dryRun) console.log('🔍 DRY RUN\n'); else console.log();

// ── ffmpeg helpers ──
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
if (!hasFFmpeg) console.log('ℹ️  ffmpeg/ffprobe not found — durations=0 and thumbnails skipped\n');

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

function getDuration(filePath: string): number {
  if (!hasFFmpeg) return 0;
  try {
    const r = execSync(`${ffprobeBin} -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`, { timeout: 15000, stdio: 'pipe' }).toString().trim();
    const s = parseFloat(r);
    return isNaN(s) ? 0 : s;
  } catch { return 0; }
}

function genThumb(videoPath: string, thumbPath: string): boolean {
  if (!hasFFmpeg) return false;
  try {
    execSync(`${ffmpegBin} -y -i "${videoPath}" -ss 00:00:05 -vframes 1 -vf "scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2" "${thumbPath}"`, { timeout: 20000, stdio: 'pipe' });
    return true;
  } catch { return false; }
}

// ── Import ──
const insertVideo = db.prepare("INSERT INTO videos (id,title,description,thumbnail_url,video_url,video_path,mime_type,file_size,duration,views,likes,dislikes,upload_date,channel_id,visibility) VALUES (?,?,?,?,?,?,?,?,?,0,0,0,?, ?,?)");

function localDateString(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: process.env.TZ || 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = Object.fromEntries(fmt.formatToParts(date).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value])) as Record<string,string>;
  return `${parts.year}-${parts.month}-${parts.day}`;
}
const insertVC = db.prepare('INSERT OR IGNORE INTO video_categories (video_id,category_name) VALUES (?,?)');

let imported = 0, skipped = 0;

const MIMES: Record<string,string> = { '.mp4':'video/mp4','.webm':'video/webm','.mkv':'video/x-matroska','.avi':'video/x-msvideo','.mov':'video/quicktime','.wmv':'video/x-ms-wmv','.flv':'video/x-flv','.m4v':'video/x-m4v','.3gp':'video/3gpp','.ogv':'video/ogg','.ts':'video/mp2t' };

const txn = db.transaction(() => {
  for (const srcPath of videoFiles) {
    const fileName = path.basename(srcPath);
    const title = path.basename(srcPath, path.extname(srcPath)).replace(/[_-]/g, ' ');
    const ext = path.extname(srcPath);
    const videoId = `v-${uuidv4()}`;
    const categoryDir = sanitizeBaseName(category || 'Uncategorized');
    const targetDir = path.join(VIDEO_DIR, categoryDir);
    fs.mkdirSync(targetDir, { recursive: true });
    const destFileName = uniqueFileName(fileName, targetDir);
    const destPath = path.join(targetDir, destFileName);
    const videoUrl = `/uploads/videos/${categoryDir}/${destFileName}`;

    const existing = db.prepare('SELECT id FROM videos WHERE title = ? AND channel_id = ?').get(title, targetChannelId);
    if (existing) { console.log(`  ⏭️  Skip (exists): ${fileName}`); skipped++; continue; }
    if (dryRun) { console.log(`  📄 Would import: ${fileName} → "${title}"`); imported++; continue; }

    try {
      if (useSymlink) fs.symlinkSync(path.resolve(srcPath), destPath);
      else if (useMove) fs.renameSync(srcPath, destPath);
      else fs.copyFileSync(srcPath, destPath);
    } catch (err: any) { console.error(`  ❌ Failed: ${fileName} — ${err.message}`); skipped++; continue; }

    const duration = getDuration(destPath);
    let thumbUrl = '';
    const thumbBaseName = `${path.parse(destFileName).name}.jpg`;
    const thumbFile = uniqueFileName(thumbBaseName, THUMB_DIR);
    const thumbPath = path.join(THUMB_DIR, thumbFile);
    if (genThumb(destPath, thumbPath)) thumbUrl = `/uploads/thumbnails/${thumbFile}`;

    const stat = fs.statSync(destPath);
    const mime = MIMES[ext.toLowerCase()] || 'video/mp4';

    insertVideo.run(videoId, title, '', thumbUrl, videoUrl, destPath, mime, stat.size, duration, localDateString(), targetChannelId, visibility);
    insertVC.run(videoId, category);

    const durStr = duration > 0 ? `${Math.floor(duration/60)}:${String(Math.floor(duration%60)).padStart(2,'0')}` : '0:00';
    console.log(`  ✅ ${fileName} → "${title}" (${durStr}, ${(stat.size/1048576).toFixed(1)} MB)`);
    imported++;
  }
});
txn();

console.log(`\n${dryRun ? '🔍 DRY RUN — ' : ''}Done!`);
console.log(`  ✅ Imported: ${imported}`);
console.log(`  ⏭️  Skipped:  ${skipped}`);
console.log(`  📊 Total videos in DB: ${(db.prepare('SELECT COUNT(*) as c FROM videos').get() as any).c}`);
if (!dryRun && imported > 0) console.log('\n🎉 Refresh the page to see imported videos.');
db.close();
