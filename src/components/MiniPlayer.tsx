import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Play, Pause, X, Maximize2, SkipBack, SkipForward, Grip, PanelBottomOpen } from 'lucide-react';
import useStore from '../store/useStore';
import { formatDuration } from '../utils/format';

export default function MiniPlayer({ isMobile }: { isMobile: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const videos = useStore((s) => s.videos);
  const mini = useStore((s) => s.miniPlayer);
  const updateMiniPlayer = useStore((s) => s.updateMiniPlayer);
  const closeMiniPlayer = useStore((s) => s.closeMiniPlayer);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ w: 340, h: 191 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizing = useRef(false);
  const resizeStart = useRef({ x: 0, y: 0, w: 340, h: 191 });

  const video = videos.find((v) => v.id === mini.videoId);
  const onWatchPage = !!video && location.pathname === `/watch/${video.id}`;
  const src = video?.videoUrl ? (video.videoUrl.startsWith('blob:') || video.videoUrl.startsWith('data:') ? video.videoUrl : `/api/stream/${video.id}`) : '';

  const currentIndex = mini.videoId ? mini.sequence.findIndex((id) => id === mini.videoId) : -1;
  const prevId = currentIndex > 0 ? mini.sequence[currentIndex - 1] : null;
  const nextId = currentIndex >= 0 && currentIndex < mini.sequence.length - 1 ? mini.sequence[currentIndex + 1] : null;

  const contextLabel = mini.source === 'playlist' ? 'Playlist' : mini.source === 'queue' ? 'Queue' : 'Browsing';

  useEffect(() => {
    if (!mini.active) return;
    // initial position bottom-right
    const margin = 16;
    const x = Math.max(margin, window.innerWidth - size.w - margin);
    const y = Math.max(72, window.innerHeight - size.h - margin);
    setPos((p) => (p.x === 0 && p.y === 0 ? { x, y } : p));
  }, [mini.active, size.w, size.h]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !mini.active || !src) return;
    const apply = () => {
      try { vid.currentTime = mini.currentTime || 0; } catch {}
      vid.volume = mini.volume;
      vid.muted = mini.isMuted;
      vid.playbackRate = mini.playbackSpeed || 1;
      if (mini.isPlaying) {
        const p = vid.play();
        if (p && typeof (p as any).catch === 'function') (p as Promise<void>).catch(() => {});
      }
    };
    const timer = setTimeout(apply, 120);
    return () => clearTimeout(timer);
  }, [mini.active, mini.videoId, src]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragging) {
        setPos({ x: Math.max(8, e.clientX - dragOffset.current.x), y: Math.max(56, e.clientY - dragOffset.current.y) });
      }
      if (resizing.current) {
        const dx = e.clientX - resizeStart.current.x;
        const newW = Math.max(280, Math.min(560, resizeStart.current.w + dx));
        const newH = Math.round((newW / 16) * 9);
        setSize({ w: newW, h: newH });
      }
    };
    const onUp = () => { setDragging(false); resizing.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  if (isMobile || !mini.enabled || !mini.active || !video || onWatchPage) return null;

  const gotoVideo = (id: string | null) => {
    if (!id) return;
    updateMiniPlayer({ videoId: id, currentTime: 0, isPlaying: true });
  };

  const expandLink = mini.playlistId ? `/watch/${video.id}?playlist=${mini.playlistId}` : `/watch/${video.id}`;

  return (
    <div
      className="fixed z-[120] bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl shadow-2xl overflow-hidden"
      style={{ left: pos.x, top: pos.y, width: size.w }}
    >
      {/* Drag handle */}
      <div
        className="h-7 bg-gray-50 dark:bg-dark-elevated border-b border-gray-200 dark:border-dark-border flex items-center justify-between px-2 cursor-move select-none"
        onMouseDown={(e) => {
          setDragging(true);
          dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
        }}
      >
        <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-dark-text-muted">
          <Grip size={12} />
          <span>{contextLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => navigate(expandLink)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-dark-hover" title="Return to watch page">
            <PanelBottomOpen size={13} />
          </button>
          <button onClick={() => navigate(expandLink)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-dark-hover" title="Expand">
            <Maximize2 size={13} />
          </button>
          <button onClick={closeMiniPlayer} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-dark-hover" title="Close">
            <X size={13} />
          </button>
        </div>
      </div>

      <div className="relative bg-black" style={{ height: size.h }}>
        {src ? (
          <video
            ref={videoRef}
            src={src}
            className="w-full h-full object-contain"
            onTimeUpdate={() => {
              const vid = videoRef.current; if (!vid) return;
              updateMiniPlayer({ currentTime: vid.currentTime, isPlaying: !vid.paused, volume: vid.volume, isMuted: vid.muted, playbackSpeed: vid.playbackRate });
            }}
            onPlay={() => updateMiniPlayer({ isPlaying: true })}
            onPause={() => updateMiniPlayer({ isPlaying: false })}
            controls={false}
            preload="metadata"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white text-sm">No video</div>
        )}

        <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2">
          <button onClick={() => gotoVideo(prevId)} disabled={!prevId} className={`p-2 rounded-full ${prevId ? 'bg-black/60 text-white hover:bg-black/80' : 'bg-black/30 text-white/40 cursor-default'}`}>
            <SkipBack size={15} />
          </button>
          <button
            onClick={() => { const vid = videoRef.current; if (!vid) return; if (vid.paused) vid.play().catch(() => {}); else vid.pause(); }}
            className="p-2 rounded-full bg-black/60 text-white hover:bg-black/80"
          >
            {mini.isPlaying ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
          </button>
          <button onClick={() => gotoVideo(nextId)} disabled={!nextId} className={`p-2 rounded-full ${nextId ? 'bg-black/60 text-white hover:bg-black/80' : 'bg-black/30 text-white/40 cursor-default'}`}>
            <SkipForward size={15} />
          </button>
          <div className="flex-1 min-w-0 bg-black/50 rounded-lg px-2 py-1 text-white text-xs">
            <p className="truncate font-medium">{video.title}</p>
            <p className="truncate text-white/70">{video.channelName} • {formatDuration(video.duration)}</p>
          </div>
        </div>

        {/* Resize handle */}
        <button
          className="absolute bottom-0 right-0 w-6 h-6 flex items-end justify-end p-1 text-white/70 hover:text-white cursor-se-resize"
          onMouseDown={(e) => {
            e.preventDefault();
            resizing.current = true;
            resizeStart.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
          }}
          title="Resize"
        >
          <div className="w-3 h-3 border-r-2 border-b-2 border-current opacity-70" />
        </button>
      </div>

      <Link to={expandLink} className="block px-3 py-2 text-xs text-gray-600 dark:text-dark-text-secondary hover:bg-gray-50 dark:hover:bg-dark-hover">
        Return to video page
      </Link>
    </div>
  );
}
