# ══════════════════════════════════════════════
# Stage 1: Install ALL deps + build frontend
# ══════════════════════════════════════════════
FROM node:20-alpine AS builder
WORKDIR /app

# Native build tools for better-sqlite3
RUN apk add --no-cache python3 make g++

# Install deps first (cached layer — only re-runs when package.json changes)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build frontend
COPY . .
RUN npm run build

# ══════════════════════════════════════════════
# Stage 2: Production image (lean)
# ══════════════════════════════════════════════
FROM node:20-alpine
WORKDIR /app

# Runtime deps only: native build tools for better-sqlite3 + ffmpeg for import script
# tzdata is needed so TZ=Europe/Athens works correctly inside Alpine
RUN apk add --no-cache python3 make g++ ffmpeg tzdata

# Install production deps only (no vite, react, tailwind, etc.)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm rebuild better-sqlite3 && \
    # Clean up build tools after native compilation
    apk del python3 make g++ && \
    rm -rf /root/.npm /tmp/*

# Copy server code (not the entire source tree)
COPY server ./server
COPY scripts ./scripts

# Copy built frontend from stage 1
COPY --from=builder /app/dist ./dist

# Create data directories
RUN mkdir -p /app/server/data/uploads/videos \
             /app/server/data/uploads/thumbnails \
             /app/server/data/uploads/avatars \
             /app/server/data/uploads/banners

# Persist database + uploads across container restarts
VOLUME /app/server/data

# Non-secret runtime defaults
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0
ENV DATA_DIR=/app/server/data
# Silence npm notifier noise if npm is ever invoked manually in the container
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

EXPOSE 3001

# Start server directly without npx so container logs stay clean
CMD ["./node_modules/.bin/tsx", "server/index.ts"]
