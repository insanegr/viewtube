import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ThumbsUp, ThumbsDown, Share2, Download, ListPlus, Play, Pause, Volume2, VolumeX, Maximize, SkipForward, SkipBack, MessageSquare, ChevronDown, ChevronUp, RectangleHorizontal, Minimize2, Lock, Settings as SettingsIcon } from 'lucide-react';
import useStore, { Comment as CommentType, Video } from '../store/useStore';
import { formatViews, formatCount, timeAgo, formatDuration } from '../utils/format';
import Avatar from '../components/Avatar';
import VideoCard from '../components/VideoCard';
import { useLanguage } from '../i18n/LanguageContext';
import { useToast } from '../components/Toast';

// ── YouTube-style Comment Component ──
function CommentItem({ comment, replies, videoId }: { comment: CommentType; replies: CommentType[]; videoId: string }) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReplies, setShowReplies] = useState(false);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const currentUser = useStore((s) => s.currentUser);
  const addComment = useStore((s) => s.addComment);
  const { t } = useLanguage();

  const handleReply = () => {
    if (replyText.trim()) {
      addComment(videoId, replyText.trim(), comment.id);
      setReplyText('');
      setShowReplyInput(false);
      setShowReplies(true);
    }
  };

  return (
    <div className="flex gap-3">
      <Avatar name={comment.channelName} src={comment.channelAvatar} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium dark:text-dark-text">{comment.channelName}</span>
          <span className="text-xs text-gray-500 dark:text-dark-text-muted">{timeAgo(comment.date)}</span>
        </div>
        <p className="text-sm mt-0.5 dark:text-dark-text whitespace-pre-wrap">{comment.text}</p>
        <div className="flex items-center gap-1 mt-1 -ml-2">
          <button onClick={() => { setLiked(!liked); if (disliked) setDisliked(false); }} className={`flex items-center gap-1 px-2 py-1.5 rounded-full text-xs hover:bg-gray-100 dark:hover:bg-dark-hover ${liked ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-dark-text-muted'}`}>
            <ThumbsUp size={14} fill={liked ? 'currentColor' : 'none'} />
            {comment.likes + (liked ? 1 : 0) > 0 && <span>{formatCount(comment.likes + (liked ? 1 : 0))}</span>}
          </button>
          <button onClick={() => { setDisliked(!disliked); if (liked) setLiked(false); }} className={`p-1.5 rounded-full text-xs hover:bg-gray-100 dark:hover:bg-dark-hover ${disliked ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-dark-text-muted'}`}>
            <ThumbsDown size={14} fill={disliked ? 'currentColor' : 'none'} />
          </button>
          <button onClick={() => setShowReplyInput(!showReplyInput)} className="px-3 py-1.5 rounded-full text-xs font-medium text-gray-600 dark:text-dark-text-muted hover:bg-gray-100 dark:hover:bg-dark-hover">
            Reply
          </button>
        </div>
        {showReplyInput && (
          <div className="flex gap-3 mt-2">
            <Avatar name={currentUser.name} src={currentUser.avatar} size="sm" />
            <div className="flex-1">
              <input type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder={`Reply to @${comment.channelName}...`} autoFocus onKeyDown={(e) => e.key === 'Enter' && handleReply()}
                className="w-full border-b border-gray-300 dark:border-dark-border-light bg-transparent pb-1 text-sm focus:outline-none focus:border-blue-500 dark:text-dark-text dark:placeholder:text-dark-text-muted" />
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={() => { setShowReplyInput(false); setReplyText(''); }} className="px-3 py-1.5 text-sm rounded-full hover:bg-gray-100 dark:hover:bg-dark-hover dark:text-dark-text-secondary">{t('cancel')}</button>
                <button onClick={handleReply} disabled={!replyText.trim()} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">Reply</button>
              </div>
            </div>
          </div>
        )}
        {replies.length > 0 && (
          <div className="mt-1">
            <button onClick={() => setShowReplies(!showReplies)} className="flex items-center gap-1 px-2 py-1.5 -ml-2 rounded-full text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20">
              {showReplies ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
            </button>
            {showReplies && (
              <div className="mt-2 space-y-4 pl-1">
                {replies.map((reply) => (
                  <div key={reply.id} className="flex gap-3">
                    <Avatar name={reply.channelName} src={reply.channelAvatar} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium dark:text-dark-text">{reply.channelName}</span>
                        <span className="text-xs text-gray-500 dark:text-dark-text-muted">{timeAgo(reply.date)}</span>
                      </div>
                      <p className="text-sm mt-0.5 dark:text-dark-text whitespace-pre-wrap">{reply.text}</p>
                      <div className="flex items-center gap-1 mt-1 -ml-2">
                        <button className="flex items-center gap-1 px-2 py-1.5 rounded-full text-xs text-gray-600 dark:text-dark-text-muted hover:bg-gray-100 dark:hover:bg-dark-hover"><ThumbsUp size={14} /> {reply.likes > 0 && reply.likes}</button>
                        <button className="p-1.5 rounded-full text-xs text-gray-600 dark:text-dark-text-muted hover:bg-gray-100 dark:hover:bg-dark-hover"><ThumbsDown size={14} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Volume Slider Component ──
function VolumeSlider({ volume, isMuted, onChange }: { volume: number; isMuted: boolean; onChange: (v: number) => void }) {
  const val = isMuted ? 0 : volume;
  const pct = val * 100;
  return (
    <div className="relative w-20 h-4 flex items-center group/vol">
      {/* Track background */}
      <div className="absolute inset-y-0 left-0 right-0 flex items-center">
        <div className="w-full h-1 bg-white/30 rounded-full overflow-hidden">
          {/* Fill */}
          <div className="h-full bg-white rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {/* Thumb dot */}
      <div className="absolute h-3 w-3 bg-white rounded-full shadow-sm transition-all pointer-events-none" style={{ left: `calc(${pct}% - 6px)` }} />
      {/* Invisible range input on top */}
      <input
        type="range" min={0} max={1} step={0.02} value={val}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="absolute inset-0 w-full opacity-0 cursor-pointer"
      />
    </div>
  );
}

// ── Main WatchPage ──
export default function WatchPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const videos = useStore((s) => s.videos);
  const comments = useStore((s) => s.comments);
  const currentUser = useStore((s) => s.currentUser);
  const isLoggedIn = currentUser.id !== '';
  const likedVideos = useStore((s) => s.likedVideos);
  const dislikedVideos = useStore((s) => s.dislikedVideos);
  const subscribedChannels = useStore((s) => s.subscribedChannels);
  const playlists = useStore((s) => s.playlists);
  const incrementViews = useStore((s) => s.incrementViews);
  const toggleLike = useStore((s) => s.toggleLike);
  const toggleDislike = useStore((s) => s.toggleDislike);
  const toggleSubscribe = useStore((s) => s.toggleSubscribe);
  const addComment = useStore((s) => s.addComment);
  const addVideoToPlaylist = useStore((s) => s.addVideoToPlaylist);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const video = videos.find((v) => v.id === id);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [commentFocused, setCommentFocused] = useState(false);
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [theaterMode, setTheaterMode] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [autoplay, setAutoplay] = useState(() => localStorage.getItem('viewtube-autoplay') !== 'false');
  const [upNextVideo, setUpNextVideo] = useState<Video | null>(null);
  const [upNextCountdown, setUpNextCountdown] = useState<number | null>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const upNextIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasIncrementedView = useRef(false);
  const watchedSecondsRef = useRef(0);
  const lastPlaybackTimeRef = useRef(0);

  const addToHistory = useStore((s) => s.addToHistory);
  const updateWatchProgress = useStore((s) => s.updateWatchProgress);
  const miniPlayer = useStore((s) => s.miniPlayer);
  const setMiniPlayerEnabled = useStore((s) => s.setMiniPlayerEnabled);
  const openMiniPlayer = useStore((s) => s.openMiniPlayer);
  const updateMiniPlayer = useStore((s) => s.updateMiniPlayer);
  const closeMiniPlayer = useStore((s) => s.closeMiniPlayer);

  // Add to history when opening the watch page, but DO NOT count a view yet.
  useEffect(() => {
    if (id) addToHistory(id);
    hasIncrementedView.current = false;
    watchedSecondsRef.current = 0;
    lastPlaybackTimeRef.current = 0;
    setCurrentTime(0);
    setDuration(0);
    // clear any pending autoplay countdown when video changes
    if (upNextIntervalRef.current) clearInterval(upNextIntervalRef.current);
    upNextIntervalRef.current = null;
    setUpNextVideo(null);
    setUpNextCountdown(null);
    return () => { hasIncrementedView.current = false; };
  }, [id, addToHistory]);

  // A view counts only after 75% of ACTUAL watched playback time.
  // Seeking/scrubbing forward does not count toward this threshold.

  // Save watch progress periodically
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !id) return;
    const saveProgress = () => {
      if (vid.duration > 0) updateWatchProgress(id, vid.currentTime / vid.duration);
    };
    const interval = setInterval(saveProgress, 5000);
    return () => clearInterval(interval);
  }, [id, updateWatchProgress]);

  // On leaving the watch page while the video is playing, open mini player if enabled.
  // Context is derived later in the component but available in cleanup via latest store state.
  useEffect(() => {
    return () => {
      const vid = videoRef.current;
      if (!vid || !id) return;
      if (miniPlayer.enabled && !vid.paused && !vid.ended) {
        const state = useStore.getState();
        const playlistId = new URLSearchParams(window.location.search).get('playlist');
        const activePlaylist = playlistId ? state.playlists.find((p) => p.id === playlistId) : null;
        let source: 'playlist' | 'queue' | 'suggested' = 'suggested';
        let sequence: string[] = state.videos.filter((v) => v.visibility === 'public').map((v) => v.id);
        if (activePlaylist && activePlaylist.videoIds.includes(id)) {
          source = 'playlist';
          sequence = activePlaylist.videoIds;
        } else if (state.queue.length > 0) {
          source = 'queue';
          sequence = [id, ...state.queue.filter((qid) => qid !== id)];
        }
        openMiniPlayer({ videoId: id, currentTime: vid.currentTime, isPlaying: true, volume: vid.volume, isMuted: vid.muted, playbackSpeed: vid.playbackRate, source, sequence, playlistId: activePlaylist?.id || null });
      }
    };
  }, [id, miniPlayer.enabled, openMiniPlayer]);

  // If autoplay is enabled and a video page opens, try to start playback automatically.
  // Note: browsers may block unmuted autoplay without prior user interaction.
  useEffect(() => {
    if (!autoplay || !video?.videoUrl || !videoRef.current) return;
    const vid = videoRef.current;
    const tryPlay = () => {
      if (vid.currentTime > 0 || !vid.paused) return;
      const p = vid.play();
      if (p && typeof (p as any).catch === 'function') {
        (p as Promise<void>).catch(() => {
          // Browser blocked autoplay; ignore silently.
        });
      }
    };
    const timer = setTimeout(tryPlay, 150);
    return () => clearTimeout(timer);
  }, [video?.id, autoplay, video?.videoUrl]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const vid = videoRef.current;
      if (!vid) return;

      switch (e.key.toLowerCase()) {
        case ' ': case 'k': e.preventDefault(); vid.paused ? vid.play() : vid.pause(); break;
        case 'f': e.preventDefault(); containerRef.current && (document.fullscreenElement ? document.exitFullscreen() : containerRef.current.requestFullscreen()); break;
        case 'm': e.preventDefault(); vid.muted = !vid.muted; setIsMuted(vid.muted); break;
        case 'arrowleft': case 'j': e.preventDefault(); vid.currentTime = Math.max(0, vid.currentTime - 5); break;
        case 'arrowright': case 'l': e.preventDefault(); vid.currentTime = Math.min(vid.duration || 0, vid.currentTime + 5); break;
        case 'arrowup': e.preventDefault(); vid.volume = Math.min(1, vid.volume + 0.1); setVolume(vid.volume); setIsMuted(false); break;
        case 'arrowdown': e.preventDefault(); vid.volume = Math.max(0, vid.volume - 0.1); setVolume(vid.volume); setIsMuted(vid.volume === 0); break;
        case 't': e.preventDefault(); setTheaterMode((p) => !p); break;
        case '>': if (e.shiftKey) { e.preventDefault(); const s = Math.min(2, playbackSpeed + 0.25); setPlaybackSpeed(s); vid.playbackRate = s; } break;
        case '<': if (e.shiftKey) { e.preventDefault(); const s = Math.max(0.25, playbackSpeed - 0.25); setPlaybackSpeed(s); vid.playbackRate = s; } break;
        case '0': case 'home': e.preventDefault(); vid.currentTime = 0; break;
        case 'end': e.preventDefault(); vid.currentTime = vid.duration || 0; break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [playbackSpeed]);

  const changeSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) videoRef.current.playbackRate = speed;
    setShowSpeedMenu(false);
  };

  const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  if (!video) return <div className="flex items-center justify-center h-96 text-gray-500 dark:text-dark-text-muted"><p className="text-lg">{t('videoNotFound')}</p></div>;

  const hasVipAccess = currentUser.role === 'vip' || currentUser.role === 'admin' || currentUser.id === video.channelId;
  const isRestrictedVip = video.visibility === 'vip' && !hasVipAccess;

  const videoComments = comments.filter((c) => c.videoId === video.id && c.parentId === null);
  const allVideoComments = comments.filter((c) => c.videoId === video.id);
  const getReplies = (parentId: string) => comments.filter((c) => c.videoId === video.id && c.parentId === parentId);
  const relatedVideos = videos.filter((v) => v.id !== video.id && v.visibility === 'public').slice(0, 10);
  const isLiked = likedVideos.includes(video.id);
  const isDisliked = dislikedVideos.includes(video.id);
  const isSubscribed = subscribedChannels.includes(video.channelId);
  const isOwnVideo = video.channelId === currentUser.id;

  // Use backend streaming endpoint for persisted videos so the browser requests ranges/chunks.
  // Keep blob/data URLs for local fallback/demo uploads and previews.
  const playbackSrc = video.videoUrl
    ? (video.videoUrl.startsWith('blob:') || video.videoUrl.startsWith('data:')
        ? video.videoUrl
        : `/api/stream/${video.id}`)
    : '';
  const downloadSrc = video.videoUrl
    ? (video.videoUrl.startsWith('blob:') || video.videoUrl.startsWith('data:')
        ? video.videoUrl
        : `/api/stream/${video.id}`)
    : '';

  const requireLogin = () => { if (!isLoggedIn) { navigate('/login'); return true; } return false; };

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (upNextIntervalRef.current) clearUpNext();
    const p = videoRef.current.paused ? videoRef.current.play() : (videoRef.current.pause(), Promise.resolve());
    if (p && typeof (p as any).catch === 'function') (p as Promise<void>).catch(() => {});
  };
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const vid = videoRef.current;
    const nowTime = vid.currentTime;
    // Only count small forward playback deltas as watched time.
    const delta = nowTime - lastPlaybackTimeRef.current;
    if (!vid.paused && delta > 0 && delta < 2.5) {
      watchedSecondsRef.current += delta;
      const threshold = (vid.duration || duration || 0) * 0.75;
      if (!hasIncrementedView.current && threshold > 0 && watchedSecondsRef.current >= threshold) {
        incrementViews(video.id);
        hasIncrementedView.current = true;
      }
    }
    lastPlaybackTimeRef.current = nowTime;
    setCurrentTime(nowTime);
    updateMiniPlayer({ currentTime: nowTime, isPlaying: !vid.paused, volume: vid.volume, isMuted: vid.muted, playbackSpeed: vid.playbackRate, videoId: video.id, active: false });
  };
  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
    // If coming back from mini player for same video, resume state.
    if (miniPlayer.videoId === video.id && miniPlayer.currentTime > 0) {
      try { videoRef.current.currentTime = miniPlayer.currentTime; } catch {}
      videoRef.current.volume = miniPlayer.volume;
      videoRef.current.muted = miniPlayer.isMuted;
      videoRef.current.playbackRate = miniPlayer.playbackSpeed || 1;
      setPlaybackSpeed(videoRef.current.playbackRate);
      if (miniPlayer.isPlaying) videoRef.current.play().catch(() => {});
      closeMiniPlayer();
    }
  };
  // handleSeek removed — progress bar uses direct click
  const handleVolumeChange = (v: number) => { setVolume(v); if (videoRef.current) { videoRef.current.volume = v; setIsMuted(v === 0); updateMiniPlayer({ volume: v, isMuted: v === 0 }); } };
  const toggleMute = () => { if (videoRef.current) { videoRef.current.muted = !isMuted; setIsMuted(!isMuted); updateMiniPlayer({ isMuted: !isMuted }); } };
  const handleFullscreen = () => { if (containerRef.current) { document.fullscreenElement ? document.exitFullscreen() : containerRef.current.requestFullscreen(); } };
  const handleMouseMove = () => { setShowControls(true); if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current); hideControlsTimer.current = setTimeout(() => { if (isPlaying) setShowControls(false); }, 3000); };
  const handleDownload = () => {
    if (!isLoggedIn) {
      navigate('/login');
      return;
    }
    if (downloadSrc) {
      const a = document.createElement('a');
      a.href = downloadSrc;
      a.download = `${video.title}.mp4`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };
  const handleShare = () => setShowShareMenu((v) => !v);
  const fallbackCopy = (text: string, successMessage = t('linkCopied')) => {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); showToast(successMessage, 'success'); } catch { showToast('Copy failed', 'error'); }
    document.body.removeChild(ta);
  };
  const copyLink = () => {
    const url = window.location.href;
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(() => showToast(t('linkCopied'), 'success')).catch(() => fallbackCopy(url));
    else fallbackCopy(url);
    setShowShareMenu(false);
  };
  const copyEmbed = () => {
    const url = window.location.href;
    const code = `<iframe width="560" height="315" src="${url}" title="${video.title.replace(/"/g, '&quot;')}" frameborder="0" allowfullscreen></iframe>`;
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(code).then(() => showToast('Embed code copied', 'success')).catch(() => fallbackCopy(code, 'Embed code copied'));
    else fallbackCopy(code, 'Embed code copied');
    setShowShareMenu(false);
  };
  const handleSubmitComment = (e: React.FormEvent) => { e.preventDefault(); if (commentText.trim()) { addComment(video.id, commentText.trim()); setCommentText(''); setCommentFocused(false); } };
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Build ordered video list for prev/next navigation
  const allPublic = videos.filter((v) => v.visibility === 'public');
  const currentIdx = allPublic.findIndex((v) => v.id === video.id);
  const prevVideo = currentIdx > 0 ? allPublic[currentIdx - 1] : null;
  const nextVideo = currentIdx < allPublic.length - 1 ? allPublic[currentIdx + 1] : null;

  const clearUpNext = () => {
    if (upNextIntervalRef.current) clearInterval(upNextIntervalRef.current);
    upNextIntervalRef.current = null;
    setUpNextVideo(null);
    setUpNextCountdown(null);
  };

  const goToPrev = () => { clearUpNext(); if (prevVideo) navigate(`/watch/${prevVideo.id}`); };
  const goToNext = () => { clearUpNext(); if (nextVideo) navigate(`/watch/${nextVideo.id}`); };

  const toggleAutoplay = () => {
    const next = !autoplay;
    setAutoplay(next);
    localStorage.setItem('viewtube-autoplay', String(next));
    if (!next) clearUpNext();
  };

  const startUpNextCountdown = (videoToPlay: Video) => {
    clearUpNext();
    setUpNextVideo(videoToPlay);
    setUpNextCountdown(5);
    upNextIntervalRef.current = setInterval(() => {
      setUpNextCountdown((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          if (upNextIntervalRef.current) clearInterval(upNextIntervalRef.current);
          upNextIntervalRef.current = null;
          navigate(`/watch/${videoToPlay.id}`);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const actionBtnCls = "flex items-center gap-2 bg-gray-100 dark:bg-dark-card hover:bg-gray-200 dark:hover:bg-dark-hover text-gray-800 dark:text-dark-text rounded-full px-4 py-2 text-sm font-medium transition";

  // ── Shared: video player JSX ──
  const videoPlayer = (
    <div ref={containerRef} className={`relative bg-black overflow-hidden aspect-video group cursor-pointer ${theaterMode ? 'max-h-[85vh]' : 'rounded-xl'}`} onMouseMove={handleMouseMove} onMouseLeave={() => isPlaying && setShowControls(false)} onClick={handlePlayPause}>
      {isRestrictedVip ? (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-dark-card to-dark-bg text-center px-6">
          <div className="max-w-xs">
            <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock size={32} className="text-yellow-500" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">VIP Exclusive Content</h2>
            <p className="text-sm text-gray-400">This video is only available for VIP members. Please contact an admin if you believe this is an error.</p>
          </div>
        </div>
      ) : playbackSrc ? (
        <video ref={videoRef} src={playbackSrc} className="w-full h-full object-contain" autoPlay={autoplay} onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMetadata} onPlay={() => { setIsPlaying(true); updateMiniPlayer({ isPlaying: true, videoId: video.id }); }} onPause={() => { setIsPlaying(false); updateMiniPlayer({ isPlaying: false, videoId: video.id }); }} onEnded={() => { setIsPlaying(false); updateMiniPlayer({ isPlaying: false, videoId: video.id }); handleEnded(); }} preload="metadata" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900"><div className="text-center text-gray-400"><Play size={64} className="mx-auto mb-2" /><p>{t('sampleVideo')}</p></div></div>
      )}
      {!isPlaying && playbackSrc && (<div className="absolute inset-0 flex items-center justify-center bg-black/20"><div className="w-16 h-16 bg-black/60 rounded-full flex items-center justify-center"><Play size={32} className="text-white ml-1" fill="white" /></div></div>)}

      {/* Up next overlay — only for suggested autoplay */}
      {upNextVideo && upNextCountdown !== null && (
        <div className="absolute inset-x-0 bottom-20 flex justify-end px-4 z-30 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-sm bg-black/85 backdrop-blur rounded-xl border border-white/10 shadow-xl overflow-hidden">
            <div className="p-4">
              <p className="text-xs uppercase tracking-wide text-gray-300 mb-1">Up next in {upNextCountdown}…</p>
              <div className="flex gap-3 items-start">
                <Link to={`/watch/${upNextVideo.id}`} className="w-32 aspect-video bg-gray-800 rounded-lg overflow-hidden flex-shrink-0" onClick={() => clearUpNext()}>
                  {upNextVideo.thumbnailUrl ? <img src={upNextVideo.thumbnailUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Play size={18} className="text-gray-400" /></div>}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link to={`/watch/${upNextVideo.id}`} onClick={() => clearUpNext()} className="text-sm font-medium text-white line-clamp-2 hover:text-blue-300">{upNextVideo.title}</Link>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-1">{upNextVideo.channelName}</p>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => { clearUpNext(); navigate(`/watch/${upNextVideo.id}`); }} className="px-3 py-1.5 bg-white text-gray-900 rounded-full text-xs font-semibold hover:bg-gray-100">Play now</button>
                    <button onClick={clearUpNext} className="px-3 py-1.5 bg-white/10 text-white rounded-full text-xs font-medium hover:bg-white/20">Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {playbackSrc && (
        <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-4 pb-3 pt-10 transition-opacity ${showControls ? 'opacity-100' : 'opacity-0'}`} onClick={(e) => e.stopPropagation()}>
          {/* Progress bar — clicking seeks directly */}
          <div
            className="relative w-full h-1.5 bg-white/30 rounded-full mb-3 cursor-pointer group/prog hover:h-2.5 transition-all"
            onClick={(e) => {
              e.stopPropagation();
              if (!videoRef.current || !duration) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              videoRef.current.currentTime = pct * duration;
              setCurrentTime(pct * duration);
            }}
          >
            <div className="absolute top-0 left-0 h-full bg-red-600 rounded-full pointer-events-none" style={{ width: `${progressPercent}%` }} />
            <div className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-red-600 rounded-full opacity-0 group-hover/prog:opacity-100 transition pointer-events-none" style={{ left: `calc(${progressPercent}% - 7px)` }} />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={goToPrev} disabled={!prevVideo} className={`text-white hidden sm:block ${prevVideo ? 'hover:text-gray-300' : 'opacity-30 cursor-default'}`}><SkipBack size={20} /></button>
            <button onClick={handlePlayPause} className="text-white hover:text-gray-300">{isPlaying ? <Pause size={24} /> : <Play size={24} fill="white" />}</button>
            <button onClick={goToNext} disabled={!nextVideo} className={`text-white hidden sm:block ${nextVideo ? 'hover:text-gray-300' : 'opacity-30 cursor-default'}`}><SkipForward size={20} /></button>
            <div className="flex items-center gap-1 group/volume ml-1">
              <button onClick={toggleMute} className="text-white hover:text-gray-300">{isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}</button>
              <div className="w-0 group-hover/volume:w-20 overflow-hidden transition-all duration-200"><VolumeSlider volume={volume} isMuted={isMuted} onChange={handleVolumeChange} /></div>
            </div>
            <span className="text-white text-xs ml-1 tabular-nums">{formatDuration(currentTime)} / {formatDuration(duration)}</span>
            <div className="flex-1" />
            {/* Speed control */}
            <div className="relative">
              <button onClick={() => setShowSpeedMenu(!showSpeedMenu)} className="text-white hover:text-gray-300 flex items-center gap-0.5" title="Playback speed">
                {playbackSpeed !== 1 ? <span className="text-xs font-bold">{playbackSpeed}x</span> : <SettingsIcon size={20} />}
              </button>
              {showSpeedMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSpeedMenu(false)} />
                  <div className="absolute bottom-full right-0 mb-2 w-52 bg-black/90 backdrop-blur rounded-lg shadow-xl z-50 py-1 max-h-72 overflow-y-auto">
                    <p className="px-3 py-1.5 text-[11px] text-gray-400 font-medium">Player settings</p>
                    <div className="px-3 py-2 flex items-center justify-between text-sm text-white border-b border-white/10">
                      <span>Mini player while browsing</span>
                      <button onClick={() => setMiniPlayerEnabled(!miniPlayer.enabled)} className="relative w-8 h-4 rounded-full transition-colors" style={{ backgroundColor: miniPlayer.enabled ? '#3b82f6' : 'rgba(255,255,255,0.25)' }}>
                        <div className="absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all shadow-sm" style={{ left: miniPlayer.enabled ? '17px' : '2px' }} />
                      </button>
                    </div>
                    <p className="px-3 py-1.5 text-[11px] text-gray-400 font-medium">Playback speed</p>
                    {SPEEDS.map((s) => (
                      <button key={s} onClick={() => changeSpeed(s)} className={`w-full text-left px-3 py-1.5 text-sm hover:bg-white/10 flex items-center justify-between ${playbackSpeed === s ? 'text-blue-400 font-medium' : 'text-white'}`}>
                        {s === 1 ? 'Normal' : `${s}x`}
                        {playbackSpeed === s && <span>✓</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            {/* Autoplay toggle — YouTube-style switch */}
            <div className="flex items-center gap-1.5 group/ap relative" title={autoplay ? 'Autoplay is on' : 'Autoplay is off'}>
              <button onClick={toggleAutoplay} className="relative w-8 h-4 rounded-full transition-colors flex-shrink-0" style={{ backgroundColor: autoplay ? '#3b82f6' : 'rgba(255,255,255,0.25)' }}>
                <div className="absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all shadow-sm" style={{ left: autoplay ? '17px' : '2px' }} />
              </button>
              {/* Tooltip */}
              <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded shadow-lg whitespace-nowrap opacity-0 group-hover/ap:opacity-100 pointer-events-none transition-opacity">
                {autoplay ? 'Autoplay is on — next video plays automatically' : 'Autoplay is off — video stops at the end'}
              </div>
            </div>
            <button onClick={() => setTheaterMode(!theaterMode)} className="text-white hover:text-gray-300" title={theaterMode ? 'Default view' : 'Theater mode'}>{theaterMode ? <Minimize2 size={20} /> : <RectangleHorizontal size={20} />}</button>
            <button onClick={handleFullscreen} className="text-white hover:text-gray-300"><Maximize size={20} /></button>
          </div>
        </div>
      )}
    </div>
  );

  // ── Shared: video info + comments JSX ──
  const videoInfo = (
    <div className="mt-3">
      <h1 className="text-xl font-semibold dark:text-dark-text">{video.title}</h1>
      <div className="flex flex-wrap items-center justify-between gap-4 mt-3">
        <div className="flex items-center gap-3">
          <Link to={isOwnVideo ? '/profile' : `/channel/${video.channelId}`}><Avatar name={video.channelName} src={video.channelAvatar} size="md" /></Link>
          <div>
            <Link to={isOwnVideo ? '/profile' : `/channel/${video.channelId}`} className="font-medium text-sm hover:text-blue-600 dark:text-dark-text dark:hover:text-blue-400">{video.channelName}</Link>
            <p className="text-xs text-gray-500 dark:text-dark-text-muted">{formatViews(video.views)} • {timeAgo(video.uploadDate)}</p>
          </div>
          {!isOwnVideo && (
            <button onClick={() => { if (requireLogin()) return; toggleSubscribe(video.channelId); }} className={`ml-2 px-4 py-2 rounded-full text-sm font-medium transition ${isSubscribed ? 'bg-gray-200 dark:bg-dark-card text-gray-700 dark:text-dark-text-secondary hover:bg-gray-300 dark:hover:bg-dark-hover' : 'bg-white dark:bg-dark-text text-gray-900 dark:text-dark-bg hover:opacity-90'}`}>{isSubscribed ? t('subscribed') : t('subscribe')}</button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-gray-100 dark:bg-dark-card rounded-full">
            <button onClick={() => { if (requireLogin()) return; toggleLike(video.id); }} className={`flex items-center gap-1.5 px-4 py-2 rounded-l-full text-sm font-medium hover:bg-gray-200 dark:hover:bg-dark-hover transition ${isLiked ? 'text-blue-600 dark:text-blue-400' : 'text-gray-800 dark:text-dark-text'}`}><ThumbsUp size={18} fill={isLiked ? 'currentColor' : 'none'} /> {formatCount(video.likes)}</button>
            <div className="w-px h-7 bg-gray-300 dark:bg-dark-border-light" />
            <button onClick={() => { if (requireLogin()) return; toggleDislike(video.id); }} className={`px-4 py-2 rounded-r-full text-sm hover:bg-gray-200 dark:hover:bg-dark-hover transition ${isDisliked ? 'text-blue-600 dark:text-blue-400' : 'text-gray-800 dark:text-dark-text'}`}><ThumbsDown size={18} fill={isDisliked ? 'currentColor' : 'none'} /></button>
          </div>
          <div className="relative">
            <button onClick={handleShare} className={actionBtnCls}><Share2 size={18} /><span className="hidden sm:inline">{t('share')}</span></button>
            {showShareMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowShareMenu(false)} />
                <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                  <button onClick={copyLink} className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-dark-hover text-left dark:text-dark-text">
                    <Share2 size={16} className="text-gray-500 dark:text-dark-text-muted" /> Copy link
                  </button>
                  <button onClick={copyEmbed} className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-dark-hover text-left dark:text-dark-text">
                    <Play size={16} className="text-gray-500 dark:text-dark-text-muted" /> Embed code
                  </button>
                </div>
              </>
            )}
          </div>
          {isLoggedIn && downloadSrc && <button onClick={handleDownload} className={actionBtnCls}><Download size={18} /><span className="hidden sm:inline">{t('download')}</span></button>}
          {isLoggedIn && <div className="relative">
            <button onClick={() => setShowPlaylistMenu(!showPlaylistMenu)} className={actionBtnCls}><ListPlus size={18} /><span className="hidden sm:inline">{t('save')}</span></button>
            {showPlaylistMenu && (<><div className="fixed inset-0 z-40" onClick={() => setShowPlaylistMenu(false)} /><div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl shadow-lg z-50 py-2"><p className="px-4 py-1.5 text-sm font-medium border-b border-gray-100 dark:border-dark-border dark:text-dark-text">{t('saveToPlaylist')}</p>{playlists.length === 0 ? <p className="px-4 py-3 text-sm text-gray-500 dark:text-dark-text-muted">{t('noPlaylistsYet')}</p> : playlists.map((pl) => (<button key={pl.id} onClick={() => { addVideoToPlaylist(pl.id, video.id); setShowPlaylistMenu(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-dark-hover dark:text-dark-text flex items-center justify-between">{pl.name}{pl.videoIds.includes(video.id) && <span className="text-green-600 dark:text-green-400 text-xs">✓</span>}</button>))}</div></>)}
          </div>}
        </div>
      </div>
      {/* Description */}
      <div className="mt-4 bg-gray-100 dark:bg-dark-card rounded-xl p-4">
        <p className="text-sm whitespace-pre-wrap dark:text-dark-text">{video.description}</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {video.categories.map((cat) => (<span key={cat} className="text-xs bg-gray-200 dark:bg-dark-elevated px-2 py-1 rounded dark:text-dark-text-secondary">{cat}</span>))}
        </div>
      </div>
      {/* Comments */}
      <div className="mt-6">
        <h3 className="text-base font-medium mb-6 dark:text-dark-text flex items-center gap-2"><MessageSquare size={20} /> {allVideoComments.length} {t('comments')}</h3>
        {isLoggedIn ? (
          <div className="flex gap-3 mb-8">
            <Avatar name={currentUser.name} src={currentUser.avatar} size="md" />
            <div className="flex-1">
              <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)} onFocus={() => setCommentFocused(true)} onKeyDown={(e) => e.key === 'Enter' && handleSubmitComment(e)} placeholder={t('addComment')} className="w-full border-b border-gray-300 dark:border-dark-border-light bg-transparent pb-1.5 text-sm focus:outline-none focus:border-gray-900 dark:focus:border-dark-text dark:text-dark-text dark:placeholder:text-dark-text-muted" />
              {commentFocused && (<div className="flex justify-end gap-2 mt-3"><button type="button" onClick={() => { setCommentText(''); setCommentFocused(false); }} className="px-3 py-2 text-sm rounded-full hover:bg-gray-100 dark:hover:bg-dark-hover dark:text-dark-text-secondary">{t('cancel')}</button><button onClick={handleSubmitComment} disabled={!commentText.trim()} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-500 disabled:dark:bg-dark-elevated disabled:dark:text-dark-text-muted disabled:cursor-not-allowed font-medium">{t('comment')}</button></div>)}
            </div>
          </div>
        ) : (
          <button onClick={() => navigate('/login')} className="w-full text-center py-3 mb-6 text-sm text-blue-600 dark:text-blue-400 border border-gray-200 dark:border-dark-border-light rounded-xl hover:bg-gray-50 dark:hover:bg-dark-hover">{t('signIn')} to comment</button>
        )}
        <div className="space-y-5">{videoComments.map((c) => (<CommentItem key={c.id} comment={c} replies={getReplies(c.id)} videoId={video.id} />))}</div>
      </div>
    </div>
  );

  // ── Queue + related sidebar ──
  const queue = useStore((s) => s.queue);
  const playlistQueue = useStore((s) => s.playlistQueue);
  const playlistLoop = useStore((s) => s.playlistLoop);
  const playlistShuffle = useStore((s) => s.playlistShuffle);
  const setPlaylistLoop = useStore((s) => s.setPlaylistLoop);
  const setPlaylistShuffle = useStore((s) => s.setPlaylistShuffle);
  const removeFromQueue = useStore((s) => s.removeFromQueue);
  const clearQueue = useStore((s) => s.clearQueue);
  const clearPlaylistQueue = useStore((s) => s.clearPlaylistQueue);

  const queueVideos = queue.map((qid) => videos.find((v) => v.id === qid)).filter((v): v is Video => !!v && v.id !== video.id);

  // Playlist session is determined by an explicit query param, not by generic playlist membership.
  const activePlaylistId = searchParams.get('playlist');
  const activePlaylist = activePlaylistId ? playlists.find((p) => p.id === activePlaylistId) : null;
  const playlistSessionVideoIds = activePlaylist?.videoIds || playlistQueue;
  const playlistSessionActive = !!activePlaylist && playlistSessionVideoIds.includes(video.id);
  const playlistCurrentIndex = playlistSessionActive ? playlistSessionVideoIds.findIndex((qid) => qid === video.id) : -1;
  const playlistSessionVideos = playlistSessionVideoIds.map((qid) => videos.find((v) => v.id === qid)).filter((v): v is Video => !!v);

  // Autoplay / next behavior handled directly by the video element's onEnded callback.
  const handleEnded = () => {
    const { queue, playNext } = useStore.getState();

    // If autoplay is OFF, do nothing at all.
    if (!autoplay) return;

    // 1) Playlist session — immediate next, while keeping full playlist visible
    if (playlistSessionActive) {
      const withPlaylist = (vid: string) => `/watch/${vid}${activePlaylistId ? `?playlist=${activePlaylistId}` : ''}`;
      if (playlistShuffle) {
        const others = playlistSessionVideoIds.filter((id) => id !== video.id);
        if (others.length > 0) {
          const randomId = others[Math.floor(Math.random() * others.length)];
          navigate(withPlaylist(randomId));
        } else if (playlistLoop) {
          navigate(withPlaylist(video.id));
        } else {
          clearPlaylistQueue();
        }
      } else if (playlistCurrentIndex >= 0 && playlistCurrentIndex < playlistSessionVideoIds.length - 1) {
        navigate(withPlaylist(playlistSessionVideoIds[playlistCurrentIndex + 1]));
      } else if (playlistLoop && playlistSessionVideoIds.length > 0) {
        navigate(withPlaylist(playlistSessionVideoIds[0]));
      } else {
        clearPlaylistQueue();
      }
      return;
    }

    // 2) Manual queue — immediate
    if (queue.length > 0) {
      const nextId = playNext();
      if (nextId) navigate(`/watch/${nextId}`);
      return;
    }

    // 3) Suggested autoplay — countdown overlay
    const allPub = videos.filter((v) => v.visibility === 'public');
    const idx = allPub.findIndex((v) => v.id === video.id);
    if (idx >= 0 && idx < allPub.length - 1) {
      startUpNextCountdown(allPub[idx + 1]);
    }
  };

  const sidebarBlock = (
    <div className="space-y-4">
      {/* Playlist playback panel — only visible when this video is being played through a playlist session */}
      {playlistSessionActive && playlistSessionVideos.length > 0 && (
        <div className="bg-gray-100 dark:bg-dark-card rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-dark-border">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-medium text-sm dark:text-dark-text">Playlist</h3>
                <p className="text-xs text-gray-500 dark:text-dark-text-muted">{playlistSessionVideos.length} videos</p>
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                <label className="flex items-center gap-1 cursor-pointer select-none text-gray-500 dark:text-dark-text-muted">
                  <input type="checkbox" checked={playlistLoop} onChange={(e) => setPlaylistLoop(e.target.checked)} className="w-3 h-3" />
                  Loop
                </label>
                <label className="flex items-center gap-1 cursor-pointer select-none text-gray-500 dark:text-dark-text-muted">
                  <input type="checkbox" checked={playlistShuffle} onChange={(e) => setPlaylistShuffle(e.target.checked)} className="w-3 h-3" />
                  Shuffle
                </label>
              </div>
            </div>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-dark-border">
            {playlistSessionVideos.map((qv, i) => {
              const isCurrent = qv.id === video.id;
              return (
                <Link key={qv.id} to={`/watch/${qv.id}${activePlaylistId ? `?playlist=${activePlaylistId}` : ''}`} className={`flex items-center gap-2 px-2 py-1.5 group/q ${isCurrent ? 'bg-blue-50 dark:bg-blue-900/15' : 'hover:bg-gray-200 dark:hover:bg-dark-hover'}`}>
                  <span className={`text-xs w-5 text-center flex-shrink-0 ${isCurrent ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-400 dark:text-dark-text-muted'}`}>
                    {isCurrent ? '▶' : i + 1}
                  </span>
                  <div className="w-16 aspect-video bg-gray-300 dark:bg-dark-elevated rounded overflow-hidden flex-shrink-0 relative">
                    {qv.thumbnailUrl ? <img src={qv.thumbnailUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Play size={10} className="text-gray-500" /></div>}
                    {isCurrent && <div className="absolute inset-0 ring-2 ring-blue-500 rounded" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-medium line-clamp-1 ${isCurrent ? 'text-blue-700 dark:text-blue-400' : 'dark:text-dark-text'}`}>{qv.title}</p>
                    <p className="text-[10px] text-gray-500 dark:text-dark-text-muted">{qv.channelName}</p>
                    {isCurrent && <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium mt-0.5">Now playing</p>}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Queue panel */}
      {queueVideos.length > 0 && (
        <div className="bg-gray-100 dark:bg-dark-card rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-dark-border">
            <div>
              <h3 className="font-medium text-sm dark:text-dark-text">{t('queue')}</h3>
              <p className="text-xs text-gray-500 dark:text-dark-text-muted">{queueVideos.length} videos</p>
            </div>
            <button onClick={clearQueue} className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">{t('clearQueue')}</button>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-dark-border">
            {queueVideos.map((qv, i) => (
              <div key={qv.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-200 dark:hover:bg-dark-hover group/q">
                <span className="text-xs text-gray-400 dark:text-dark-text-muted w-5 text-center flex-shrink-0">{i + 1}</span>
                <Link to={`/watch/${qv.id}`} className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-16 aspect-video bg-gray-300 dark:bg-dark-elevated rounded overflow-hidden flex-shrink-0">
                    {qv.thumbnailUrl ? <img src={qv.thumbnailUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Play size={10} className="text-gray-500" /></div>}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium line-clamp-1 dark:text-dark-text">{qv.title}</p>
                    <p className="text-[10px] text-gray-500 dark:text-dark-text-muted">{qv.channelName}</p>
                  </div>
                </Link>
                <button onClick={() => removeFromQueue(qv.id)} className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover/q:opacity-100 transition-opacity flex-shrink-0" title={t('removeFromQueue')}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Related videos */}
      <div className="space-y-3">
        <h3 className="font-medium text-sm dark:text-dark-text">{t('relatedVideos')}</h3>
        {relatedVideos.map((v) => (<VideoCard key={v.id} video={v} layout="list" />))}
      </div>
    </div>
  );

  // ══════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════
  if (theaterMode) {
    return (
      <div>
        <div className="-mx-3 sm:-mx-4 lg:-mx-6 bg-black">{videoPlayer}</div>
        <div className="flex flex-col lg:flex-row gap-6 mt-4">
          <div className="flex-1 min-w-0">{videoInfo}</div>
          <div className="w-full lg:w-96 flex-shrink-0">{sidebarBlock}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0">
        {videoPlayer}
        {videoInfo}
      </div>
      <div className="w-full lg:w-96 flex-shrink-0">{sidebarBlock}</div>
    </div>
  );
}
