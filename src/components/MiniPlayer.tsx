import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Play, Pause, X, Maximize2, SkipBack, SkipForward, Grip, PanelBottomOpen, PictureInPicture, ThumbsUp, Clock3 } from 'lucide-react';
import useStore from '../store/useStore';
import { formatDuration } from '../utils/format';

export default function MiniPlayer({ isMobile }: { isMobile: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const videos = useStore((s) => s.videos);
  const currentUser = useStore((s) => s.currentUser);
  const mini = useStore((s) => s.miniPlayer);
  const updateMiniPlayer = useStore((s) => s.updateMiniPlayer);
  const closeMiniPlayer = useStore((s) => s.closeMiniPlayer);
  
  // Quick Action Zustand stores and functions
  const likedVideos = useStore((s) => s.likedVideos);
  const toggleLike = useStore((s) => s.toggleLike);
  const watchLater = useStore((s) => s.watchLater);
  const addToWatchLater = useStore((s) => s.addToWatchLater);
  const removeFromWatchLater = useStore((s) => s.removeFromWatchLater);

  const videoRef = useRef<HTMLVideoElement>(null);

  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ w: 340, h: 191 });
  const [duration, setDuration] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizing = useRef(false);
  const resizeStart = useRef({ x: 0, y: 0, w: 340, h: 191 });

  const video = videos.find((v) => v.id === mini.videoId);

  useEffect(() => {
    if (video) {
      setDuration(video.duration || 0);
    }
  }, [video?.id]);

  const onWatchPage = !!video && location.pathname === `/watch/${video.id}`;
  const src = video?.videoUrl ? (video.videoUrl.startsWith('blob:') || video.videoUrl.startsWith('data:') ? video.videoUrl : `/api/stream/${video.id}`) : '';

  const currentIndex = mini.videoId ? mini.sequence.findIndex((id) => id === mini.videoId) : -1;
  const prevId = currentIndex > 0 ? mini.sequence[currentIndex - 1] : null;
  const nextId = currentIndex >= 0 && currentIndex < mini.sequence.length - 1 ? mini.sequence[currentIndex + 1] : null;

  const contextLabel = mini.source === 'playlist' ? 'Playlist' : mini.source === 'queue' ? 'Queue' : 'Browsing';

  // Playlist progress vars
  const isPlaylist = mini.source === 'playlist';
  const playlistProgress = isPlaylist && mini.sequence.length > 0 ? `${currentIndex + 1} of ${mini.sequence.length}` : null;

  // Like & WatchLater Status
  const isLiked = video ? likedVideos.includes(video.id) : false;
  const isWatchLater = video ? watchLater.includes(video.id) : false;

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
        const margin = 16;
        const minY = 56; // header height
        const minX = margin;
        const maxX = window.innerWidth - size.w - margin;
        const minYCoord = minY + margin;
        const maxY = window.innerHeight - size.h - margin;

        let targetX = e.clientX - dragOffset.current.x;
        let targetY = e.clientY - dragOffset.current.y;

        // Snapping threshold (pixels)
        const snapThreshold = 30;

        // Snap X
        if (Math.abs(targetX - minX) < snapThreshold) {
          targetX = minX;
        } else if (Math.abs(targetX - maxX) < snapThreshold) {
          targetX = maxX;
        }

        // Snap Y
        if (Math.abs(targetY - minYCoord) < snapThreshold) {
          targetY = minYCoord;
        } else if (Math.abs(targetY - maxY) < snapThreshold) {
          targetY = maxY;
        }

        // Keep inside bounds so at least borders are completely visible
        const boundedX = Math.max(minX, Math.min(maxX, targetX));
        const boundedY = Math.max(minYCoord, Math.min(maxY, targetY));

        setPos({ x: boundedX, y: boundedY });
      }
      if (resizing.current) {
        const dx = e.clientX - resizeStart.current.x;
        // Max width based on pos.x and screen width to prevent overflow
        const maxAllowedW = window.innerWidth - pos.x - 16;
        const newW = Math.max(280, Math.min(Math.min(560, maxAllowedW), resizeStart.current.w + dx));
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
  }, [dragging, size.w, size.h, pos.x]);

  const isVipPlusPlusRestricted = video && video.visibility === 'vip++' && (
    currentUser.role !== 'admin' && currentUser.role !== 'vip++' && currentUser.role !== 'moderator_vip_plus_plus' && currentUser.id !== video.channelId
  );

  if (isMobile || !mini.enabled || !mini.active || !video || onWatchPage || isVipPlusPlusRestricted) return null;

  const gotoVideo = (id: string | null) => {
    if (!id) return;
    updateMiniPlayer({ videoId: id, currentTime: 0, isPlaying: true });
  };

  const handlePiP = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.error("Picture-in-Picture error:", err);
    }
  };

  const expandLink = mini.playlistId ? `/watch/${video.id}?playlist=${mini.playlistId}` : `/watch/${video.id}`;

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const vid = videoRef.current;
    if (!vid) return;
    const dur = duration || vid.duration || video?.duration || 0;
    if (!dur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    vid.currentTime = pct * dur;
    updateMiniPlayer({ currentTime: pct * dur });
  };

  return (
    <div
      className={`fixed z-[120] bg-white dark:bg-dark-card border-2 border-gray-300 dark:border-zinc-700/80 rounded-xl shadow-2xl overflow-hidden hover:scale-105 hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)] origin-bottom-right group ring-1 ring-black/5 ${dragging || resizing.current ? '' : 'transition-all duration-300 ease-in-out'}`}
      style={{ left: pos.x, top: pos.y, width: size.w }}
    >
      {/* Drag handle - only visible on hover */}
      <div
        className="h-7 bg-gray-50 dark:bg-dark-elevated border-b border-gray-200 dark:border-dark-border flex items-center justify-between px-2 cursor-move select-none transition-all duration-200 opacity-0 group-hover:opacity-100"
        onMouseDown={(e) => {
          setDragging(true);
          dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
        }}
      >
        <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-dark-text-muted font-semibold tracking-wider uppercase">
          <Grip size={12} />
          <span>{contextLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Native Picture in Picture Button */}
          <button onClick={handlePiP} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-dark-hover text-gray-600 dark:text-dark-text-muted" title="Picture in Picture (Pop Out)">
            <PictureInPicture size={13} />
          </button>
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
        {/* Playlist helper indicator capsule - visible when hover is active or if playlist */}
        {isPlaylist && playlistProgress && (
          <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 z-10 border border-white/10 shadow-md transition-opacity duration-200 opacity-0 group-hover:opacity-100">
            <span>Playlist</span>
            <span className="text-white/40">•</span>
            <span className="text-red-400">{playlistProgress}</span>
            <div className="flex items-center gap-1 ml-1 pl-1 border-l border-white/20 select-none">
              <button 
                onClick={(e) => { e.stopPropagation(); gotoVideo(prevId); }} 
                disabled={!prevId} 
                className={`p-0.5 rounded hover:bg-white/20 transition ${prevId ? 'text-white' : 'text-white/30 cursor-default'}`}
                title="Previous playlist item"
              >
                <SkipBack size={10} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); gotoVideo(nextId); }} 
                disabled={!nextId} 
                className={`p-0.5 rounded hover:bg-white/20 transition ${nextId ? 'text-white' : 'text-white/30 cursor-default'}`}
                title="Next playlist item"
              >
                <SkipForward size={10} />
              </button>
            </div>
          </div>
        )}

        {src ? (
          <video
            ref={videoRef}
            src={src}
            className="w-full h-full object-contain"
            onTimeUpdate={() => {
              const vid = videoRef.current; if (!vid) return;
              updateMiniPlayer({ currentTime: vid.currentTime, isPlaying: !vid.paused, volume: vid.volume, isMuted: vid.muted, playbackSpeed: vid.playbackRate });
            }}
            onLoadedMetadata={() => {
              if (videoRef.current) {
                setDuration(videoRef.current.duration || 0);
              }
            }}
            onDurationChange={() => {
              if (videoRef.current) {
                setDuration(videoRef.current.duration || 0);
              }
            }}
            onPlay={() => updateMiniPlayer({ isPlaying: true })}
            onPause={() => updateMiniPlayer({ isPlaying: false })}
            controls={false}
            preload="metadata"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white text-sm">No video</div>
        )}

        {/* Smooth unified overlay controls row - fully visible only on hover */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pt-8 pb-2 px-2 transition-opacity duration-200 ease-in-out opacity-0 group-hover:opacity-100 flex flex-col gap-1.5 z-20 pointer-events-auto">
          
          {/* Progress Seek bar */}
          <div 
            className="group/seek relative w-full h-1 bg-white/30 rounded-full cursor-pointer hover:h-1.5 transition-all"
            onClick={handleProgressClick}
          >
            <div 
              className="absolute top-0 left-0 h-full bg-red-600 rounded-full pointer-events-none" 
              style={{ width: `${(mini.currentTime / (duration || 1)) * 100}%` }}
            />
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-red-600 rounded-full opacity-0 group-hover/seek:opacity-100 transition pointer-events-none" 
              style={{ left: `calc(${(mini.currentTime / (duration || 1)) * 100}% - 5px)` }}
            />
          </div>

          {/* Controls button row and action card overlay */}
          <div className="flex items-center gap-1.5">
            {/* Playback action items */}
            <button onClick={() => gotoVideo(prevId)} disabled={!prevId} className={`p-1.5 rounded-full ${prevId ? 'text-white hover:bg-white/10' : 'text-white/35 cursor-default'}`} title="Previous video">
              <SkipBack size={13} fill={prevId ? "currentColor" : "none"} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); const vid = videoRef.current; if (!vid) return; if (vid.paused) vid.play().catch(() => {}); else vid.pause(); }}
              className="p-1.5 rounded-full text-white hover:bg-white/10"
              title={mini.isPlaying ? "Pause" : "Play"}
            >
              {mini.isPlaying ? <Pause size={13} /> : <Play size={13} fill="currentColor" />}
            </button>
            <button onClick={() => gotoVideo(nextId)} disabled={!nextId} className={`p-1.5 rounded-full ${nextId ? 'text-white hover:bg-white/10' : 'text-white/35 cursor-default'}`} title="Next video">
              <SkipForward size={13} fill={nextId ? "currentColor" : "none"} />
            </button>

            {/* Quick action details card with metadata */}
            <div className="flex-1 min-w-0 bg-black/50 rounded-md px-2 py-0.5 text-white text-[10px] flex items-center justify-between gap-1 overflow-hidden">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{video.title}</p>
                <p className="truncate text-white/60 text-[9px]">{video.channelName} • {formatDuration(mini.currentTime)} / {formatDuration(duration)}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                <button 
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleLike(video.id); }} 
                  className={`p-0.5 rounded hover:bg-white/20 transition ${isLiked ? 'text-blue-400' : 'text-white/80'}`}
                  title={isLiked ? "Unlike" : "Like"}
                >
                  <ThumbsUp size={11} fill={isLiked ? "currentColor" : "none"} />
                </button>
                <button 
                  onClick={(e) => { 
                    e.preventDefault(); 
                    e.stopPropagation(); 
                    if (isWatchLater) {
                      removeFromWatchLater(video.id);
                    } else {
                      addToWatchLater(video.id);
                    }
                  }} 
                  className={`p-0.5 rounded hover:bg-white/20 transition ${isWatchLater ? 'text-blue-400' : 'text-white/80'}`}
                  title={isWatchLater ? "Remove from Watch Later" : "Save to Watch Later"}
                >
                  <Clock3 size={11} fill={isWatchLater ? "currentColor" : "none"} />
                </button>
              </div>
            </div>

            {/* Fullscreen control */}
            <button 
              onClick={(e) => { e.stopPropagation(); if (videoRef.current) { if (document.fullscreenElement) { document.exitFullscreen(); } else { videoRef.current.requestFullscreen().catch(() => {}); } } }} 
              className="p-1.5 rounded-full text-white hover:bg-white/10 flex-shrink-0"
              title="Fullscreen"
            >
              <Maximize2 size={13} />
            </button>
          </div>
        </div>

        {/* Resize handle */}
        <button
          className="absolute bottom-0 right-0 w-6 h-6 flex items-end justify-end p-1 text-white/70 hover:text-white cursor-se-resize z-30 transition-opacity duration-200 opacity-0 group-hover:opacity-100"
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

      <Link to={expandLink} className="block px-3 py-2 text-xs text-gray-600 dark:text-dark-text-secondary hover:bg-gray-50 dark:hover:bg-dark-hover font-semibold">
        Return to video page
      </Link>
    </div>
  );
}
