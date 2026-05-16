# ViewTube

A self-hosted video platform focused on **personal media libraries, creator workflows, and Raspberry Pi friendly deployment**.

ViewTube is designed for people who already have:
- a structured HDD/NAS media library
- a home server or Raspberry Pi
- a need for private/public video publishing
- an admin workflow for importing, organizing, and operating a real long-term site

---

## Project Vision

ViewTube is not meant to be just a YouTube clone in appearance.
It is being shaped as a **practical self-hosted video system** with:

- browser uploads
- HDD/library imports
- playlists
- channel pages
- creator settings
- analytics
- watch history
- admin operations
- long-term data ownership

The core idea is:
> **Use your existing file structure and hosting environment, but give it a clean modern video platform UI.**

---

## What the project currently includes

### Public / visitor experience
- Home page with category chips
- Search
- Explore
- Channel pages
- Watch page with custom video player
- Share options
- Related videos
- Read comments

### Logged-in user features
- Sign in / create account
- Username + email login support
- Upload videos
- Queue
- Watch Later
- Playlists
- Watch history
- Profile editing
- Password change
- Notifications
- Mini player toggle

### Admin features
- Unified **Admin Panel**
- User management
- VIP / admin role assignment
- Recovery requests with temporary password generation
- Category management
- HDD import UI
- Backups & restore
- Storage information

### Technical features
- SQLite database
- Express backend
- JWT access + refresh tokens
- Rate limiting
- Real upload progress
- Server-side watch history persistence
- Analytics timeline data
- HDD import support with ffmpeg
- Category-based video storage folders
- Portainer / Docker deployment support

---

## Architecture at a glance

### Frontend
- React + Vite
- Zustand for client state
- Tailwind CSS
- React Router

### Backend
- Express
- SQLite via `better-sqlite3`
- JWT auth
- Multer for uploads
- ffmpeg / ffprobe for media processing

### Storage model
- **Database / metadata** on one mount
- **Uploaded videos** on another mount
- **Import source root** mounted read-only from `/mnt`

This keeps the system practical for home-server usage.

---

## Storage concept

### 1. Main app data
Contains:
- users
- playlists
- comments
- analytics
- history
- notifications
- thumbnails / avatars / banners
- database

### 2. Uploaded video storage
Contains:
- browser-uploaded videos
- stored in category-based folders using the **main/primary category**

### 3. Import source root
Mounted read-only from host `/mnt` so the import UI can browse all drives/folders under that root.

---

## Authentication / recovery model

### Login
Users can log in with:
- email
- username

### Recovery
For now there is **no email system**.
Instead, users submit a recovery request and the admin can:
- verify the account
- issue a temporary password
- force password change on next login

This keeps the platform operational without introducing mail infrastructure yet.

---

## Current design philosophy

This project tries to balance **three different workflows**:

### 1. Visitor workflow
Simple browsing and watching.

### 2. Creator workflow
Simple uploads and profile management.

### 3. Admin workflow
Advanced control over:
- imports
- categories
- storage
- users
- backups
- recovery

The admin tools are intentionally more powerful than the normal user tools.

---

## Current strong points

- Good fit for Raspberry Pi + Portainer
- Works with real HDD-mounted media libraries
- Has an operational admin panel already
- Supports long-term self-hosted growth better than a pure demo app
- Import workflow is becoming tailored to real file structures

---

## Known limitations / still evolving

- No email sending yet
- No full transcoding/HLS pipeline yet
- Mini player still needs more real-world testing
- Some admin workflows can be refined further
- Import/category logic is powerful but still evolving
- Existing historical timestamps may need cleanup if old data was created before timezone fixes

---

## Recommended next priorities

### High priority
- Full HLS / adaptive streaming pipeline
- Email system for account recovery and notifications
- Better admin auditing / job history for imports and backups
- Public/private/unlisted moderation and visibility tools

### Medium priority
- Improved analytics dashboards
- Server-side pagination / filtering APIs
- Better playlist playback controls
- More advanced mini player behavior
- Multi-source import root selector UI polish

### Low priority / polish
- Better drag-and-drop UX
- More advanced search suggestions
- Additional moderation/reporting tools
- More theming / visual refinement

---

## To-Do / Roadmap

## Core platform
- [ ] Add HLS / segmented streaming for better large-video playback
- [ ] Add resumable uploads for very large files
- [ ] Add stronger server-side pagination/filtering APIs
- [ ] Add duplicate video detection beyond title matching

## Accounts / auth
- [x] Username login
- [x] Temporary password recovery via admin
- [ ] Email system for reset links and notifications
- [ ] Session management UI (view active sessions / revoke sessions)
- [ ] Optional 2FA later

## Import workflow
- [x] Import UI
- [x] Browse mounted drives under `/mnt`
- [x] Scan selected folder only
- [x] Optional recursive scan
- [x] Main + additional categories in admin import
- [ ] Better folder-structure mapping preview before import
- [ ] Bulk override for selected files
- [ ] Import job history / logs

## Content organization
- [x] Main + additional category concept in import workflow
- [ ] Consider explicit DB fields:
  - `primaryCategory`
  - `secondaryCategories`
- [ ] Better category/folder migration tools
- [ ] Optional channel-based or date-based storage mode

## Playback
- [x] Queue
- [x] Playlist playback
- [x] Suggested autoplay countdown
- [x] Watch history progress bars
- [ ] More robust autoplay behavior across browsers
- [ ] HLS-aware next/previous handling
- [ ] Better keyboard shortcut help UI

## Mini player
- [x] Desktop mini player shell
- [x] Drag / resize
- [x] Prev / next controls
- [ ] Remember size/position in localStorage
- [ ] Snap to screen edges
- [ ] Progress bar in mini player
- [ ] Better playlist/queue labels in mini player

## Admin operations
- [x] Unified Admin Panel
- [x] Recovery requests
- [x] Backups page
- [x] Import page
- [ ] System health page
- [ ] Import activity / recent admin actions
- [ ] Storage cleanup tools
- [ ] Broken/orphaned file detector

## Analytics
- [x] Timeline charts foundation
- [ ] More detailed creator analytics
- [ ] Filter by video / category / date range
- [ ] Export analytics data

## Deployment / ops
- [x] Portainer-friendly Docker setup
- [x] Split mounts for data/videos/import root
- [x] Timezone support in container
- [ ] Automatic scheduled backups from UI
- [ ] Health/status diagnostics page
- [ ] Restore verification tools

---

## Deployment docs

This repository now includes **two deployment-related documents**:

- `DEPLOYMENT.md` → detailed deployment guide for your Raspberry Pi / Portainer stack
- `HOSTING_AND_TROUBLESHOOTING.md` → clean host/deploy/troubleshooting reference

Use whichever one is easier for you operationally.

---

## Final note

This project is already beyond the “demo” stage in architecture.
The next big step is making the import, playback, and admin systems feel even more **production-stable** for long-term self-hosting.
