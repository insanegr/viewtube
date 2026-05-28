import { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ThumbsUp, ThumbsDown, Share2, Download, ListPlus, Play, Pause, Volume2, VolumeX, Maximize, SkipForward, SkipBack, MessageSquare, ChevronDown, ChevronUp, RectangleHorizontal, Minimize2, Lock, Settings as SettingsIcon, ChevronRight, PictureInPicture, Flag } from 'lucide-react';
import useStore, { Comment as CommentType, Video } from '../store/useStore';
import { formatViews, formatCount, timeAgo, formatDuration } from '../utils/format';
import Avatar from '../components/Avatar';
import InfiniteVideoGrid from '../components/InfiniteVideoGrid';
import { useLanguage } from '../i18n/LanguageContext';
import { useToast } from '../components/Toast';
import { api } from '../api/client';

// ── YouTube-style Comment Component ──
function CommentItem({ 
  comment, 
  replies, 
  videoId, 
  onReportComment, 
  isReply = false 
}: { 
  comment: CommentType; 
  replies: CommentType[]; 
  videoId: string; 
  onReportComment: (id: string) => void;
  isReply?: boolean;
}) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReplies, setShowReplies] = useState(false);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const currentUser = useStore((s) => s.currentUser);
  const addComment = useStore((s) => s.addComment);
  const editComment = useStore((s) => s.editComment);
  const deleteComment = useStore((s) => s.deleteComment);
  const channels = useStore((s) => s.channels);
  const { showToast } = useToast();
  const { t } = useLanguage();

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);

  useEffect(() => {
    setEditText(comment.text);
  }, [comment.text]);

  const authorChannel = channels.find((c) => c.id === comment.channelId);
  const authorRole = authorChannel?.role || 'user';

  const ROLE_WEIGHTS: Record<string, number> = {
    'guest': -1,
    'user': 1,
    'vip': 2,
    'vip+': 3,
    'vip++': 4,
    'moderator': 10,
    'moderator_vip_plus': 11,
    'moderator_vip_plus_plus': 12,
    'admin': 99
  };

  const getWeight = (id: string, role: string) => {
    if (id === 'ch-admin') return 100;
    return ROLE_WEIGHTS[role] || 1;
  };

  const isOwner = comment.channelId === currentUser.id;
  const isModOrAdmin = ['admin', 'moderator', 'moderator_vip_plus', 'moderator_vip_plus_plus'].includes(currentUser.role);

  let canEditOrDelete = isOwner;
  if (!canEditOrDelete && isModOrAdmin) {
    const callerWeight = getWeight(currentUser.id, currentUser.role);
    const targetWeight = getWeight(comment.channelId, authorRole);
    if (callerWeight > targetWeight) {
      canEditOrDelete = true;
    }
  }

  const handleReply = () => {
    if (replyText.trim()) {
      addComment(videoId, replyText.trim(), comment.id);
      setReplyText('');
      setShowReplyInput(false);
      setShowReplies(true);
    }
  };

  const handleEdit = async () => {
    if (!editText.trim()) return;
    try {
      await editComment(comment.id, editText.trim());
      setIsEditing(false);
      showToast('Comment updated successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to edit comment', 'error');
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this comment?')) {
      try {
        await deleteComment(comment.id);
        showToast('Comment deleted successfully', 'success');
      } catch (err: any) {
        showToast(err.message || 'Failed to delete comment', 'error');
      }
    }
  };

  return (
    <div className={`flex gap-3 ${isReply ? 'ml-2' : ''}`}>
      <Avatar name={comment.channelName} src={comment.channelAvatar} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-medium dark:text-dark-text ${isReply ? 'text-xs' : 'text-[13px]'}`}>
            {comment.channelName}
          </span>
          <span className="text-xs text-gray-500 dark:text-dark-text-muted">{timeAgo(comment.date)}</span>
        </div>

        {isEditing ? (
          <div className="mt-1">
            <input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full border-b border-gray-300 dark:border-dark-border-light bg-transparent pb-1 text-sm focus:outline-none focus:border-blue-500 dark:text-dark-text"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => { setIsEditing(false); setEditText(comment.text); }}
                className="px-2.5 py-1 text-xs rounded-full hover:bg-gray-100 dark:hover:bg-dark-hover dark:text-dark-text-secondary"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleEdit}
                disabled={!editText.trim()}
                className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm mt-0.5 dark:text-dark-text whitespace-pre-wrap">{comment.text}</p>
        )}

        {!isEditing && (
          <div className="flex items-center gap-1 mt-1 -ml-2">
            <button onClick={() => { setLiked(!liked); if (disliked) setDisliked(false); }} className={`flex items-center gap-1 px-2 py-1.5 rounded-full text-xs hover:bg-gray-100 dark:hover:bg-dark-hover ${liked ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-dark-text-muted'}`}>
              <ThumbsUp size={14} fill={liked ? 'currentColor' : 'none'} />
              {comment.likes + (liked ? 1 : 0) > 0 && <span>{formatCount(comment.likes + (liked ? 1 : 0))}</span>}
            </button>
            <button onClick={() => { setDisliked(!disliked); if (liked) setLiked(false); }} className={`p-1.5 rounded-full text-xs hover:bg-gray-100 dark:hover:bg-dark-hover ${disliked ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-dark-text-muted'}`}>
              <ThumbsDown size={14} fill={disliked ? 'currentColor' : 'none'} />
            </button>
            
            {!isReply && (
              <button onClick={() => setShowReplyInput(!showReplyInput)} className="px-3 py-1.5 rounded-full text-xs font-medium text-gray-600 dark:text-dark-text-muted hover:bg-gray-100 dark:hover:bg-dark-hover">
                Reply
              </button>
            )}

            {canEditOrDelete && (
              <>
                <button onClick={() => setIsEditing(true)} className="px-3 py-1.5 rounded-full text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/20">
                  Edit
                </button>
                <button onClick={handleDelete} className="px-3 py-1.5 rounded-full text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20">
                  Delete
                </button>
              </>
            )}

            {currentUser.id !== '' && !isOwner && (
              <button onClick={() => onReportComment(comment.id)} className="px-3 py-1.5 rounded-full text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20">
                Report
              </button>
            )}
          </div>
        )}

        {showReplyInput && !isReply && (
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

        {replies.length > 0 && !isReply && (
          <div className="mt-1">
            <button onClick={() => setShowReplies(!showReplies)} className="flex items-center gap-1 px-2 py-1.5 -ml-2 rounded-full text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20">
              {showReplies ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
            </button>
            {showReplies && (
              <div className="mt-2 space-y-4 pl-1 border-l border-gray-100 dark:border-dark-border">
                {replies.map((reply) => (
                  <CommentItem 
                    key={reply.id} 
                    comment={reply} 
                    replies={[]} 
                    videoId={videoId} 
                    onReportComment={onReportComment} 
                    isReply={true}
                  />
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
  const queue = useStore((s) => s.queue);
  const watchLater = useStore((s) => s.watchLater);
  const playlistQueue = useStore((s) => s.playlistQueue);
  const playlistLoop = useStore((s) => s.playlistLoop);
  const playlistShuffle = useStore((s) => s.playlistShuffle);
  const setPlaylistLoop = useStore((s) => s.setPlaylistLoop);
  const setPlaylistShuffle = useStore((s) => s.setPlaylistShuffle);
  const removeFromQueue = useStore((s) => s.removeFromQueue);
  const clearQueue = useStore((s) => s.clearQueue);
  const removeFromWatchLater = useStore((s) => s.removeFromWatchLater);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [relatedVideos, setRelatedVideos] = useState<Video[]>([]);
  const [reportModal, setReportModal] = useState<{ active: boolean; type: 'video' | 'comment'; targetId: string }>({
    active: false,
    type: 'video',
    targetId: ''
  });
  const [reportReason, setReportReason] = useState('Inappropriate content');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  const video = videos.find((v) => v.id === id);

  useEffect(() => {
    if (video?.id) {
      api.getVideos({
        excludeId: video.id,
        sortBy: 'random',
        limit: 10
      }).then((res) => {
        setRelatedVideos(res.videos || []);
      }).catch(() => {});

      // Fetch comments for this video from the server to prevent them disappearing on refresh
      api.getComments(video.id).then((serverComments) => {
        if (serverComments && Array.isArray(serverComments)) {
          useStore.setState((state) => {
            const otherComments = state.comments.filter((c) => c.videoId !== video.id);
            return { comments: [...otherComments, ...serverComments] };
          });
        }
      }).catch(() => {});
    }
  }, [video?.id]);

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
  const [speedMenuLevel, setSpeedMenuLevel] = useState<'main' | 'speed'>('main');
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

  const isVipPlusPlusRestricted = video && video.visibility === 'vip++' && (
    currentUser.role !== 'admin' && currentUser.role !== 'vip++' && currentUser.role !== 'moderator_vip_plus_plus' && currentUser.id !== video.channelId
  );

  if (!video || isVipPlusPlusRestricted) return <div className="flex items-center justify-center h-96 text-gray-500 dark:text-dark-text-muted"><p className="text-lg">{t('videoNotFound')}</p></div>;

  const ROLE_LEVELS: Record<string, number> = { 
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
  const VIS_LEVELS: Record<string, number> = { 'public': -1, 'unlisted': -1, 'user': 0, 'vip': 1, 'vip+': 2, 'vip++': 3, 'private': 100 };

  const userRole = currentUser.id ? currentUser.role : 'guest';
  const userLevel = ROLE_LEVELS[userRole] ?? -1;
  const videoLevel = VIS_LEVELS[video.visibility] ?? -1;

  const isRestricted = ['user', 'vip', 'vip+', 'vip++'].includes(video.visibility);
  const hasAccess = userLevel >= videoLevel || currentUser.id === video.channelId || currentUser.role === 'admin';
  const isDenied = isRestricted && !hasAccess;

  const videoComments = comments.filter((c) => c.videoId === video.id && c.parentId === null);
  const allVideoComments = comments.filter((c) => c.videoId === video.id);
  const getReplies = (parentId: string) => comments.filter((c) => c.videoId === video.id && c.parentId === parentId);
  
  // Show all discoverable videos in related, distinguishing restricted ones via VideoCard
  const relatedFetchParams = useMemo(() => ({
    excludeVideoId: video.id,
    sortBy: 'random',
    limit: 10
  }), [video.id]);
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
  const handlePiP = async () => {
    if (!videoRef.current || !id) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.warn("Native Picture-in-Picture failed, falling back to ViewTube MiniPlayer:", err);
      // Fallback: Open our in-app MiniPlayer so they can continue watching while navigating!
      const vid = videoRef.current;
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
      openMiniPlayer({ 
        videoId: id, 
        currentTime: vid.currentTime, 
        isPlaying: !vid.paused, 
        volume: vid.volume, 
        isMuted: vid.muted, 
        playbackSpeed: vid.playbackRate, 
        source, 
        sequence, 
        playlistId: activePlaylist?.id || null 
      });
      // Navigate to homepage so they see the miniplayer in action!
      navigate('/');
    }
  };
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

  // Build active list sequence for context-aware prev/next navigation
  const listParam = searchParams.get('list');
  const activePlaylistId = searchParams.get('playlist');
  const activePlaylist = activePlaylistId ? playlists.find((p) => p.id === activePlaylistId) : null;

  let activeListVideos: Video[] = [];
  let activeListType: 'playlist' | 'watch-later' | 'queue' | 'related' = 'related';

  if (activePlaylist) {
    activeListType = 'playlist';
    activeListVideos = activePlaylist.videoIds.map((qid) => videos.find((v) => v.id === qid)).filter((v): v is Video => !!v);
  } else if (listParam === 'watch-later') {
    activeListType = 'watch-later';
    activeListVideos = watchLater.map((qid) => videos.find((v) => v.id === qid)).filter((v): v is Video => !!v);
  } else if (listParam === 'queue' || (queue.length > 0 && !listParam)) {
    activeListType = 'queue';
    const uniqueQueueIds = Array.from(new Set([video.id, ...queue]));
    activeListVideos = uniqueQueueIds.map((qid) => videos.find((v) => v.id === qid)).filter((v): v is Video => !!v);
  } else {
    activeListType = 'related';
    activeListVideos = relatedVideos;
  }

  let prevVideo: Video | null = null;
  let nextVideo: Video | null = null;

  if (activeListType === 'related') {
    prevVideo = null;
    nextVideo = relatedVideos.length > 0 ? relatedVideos[0] : null;
  } else if (activeListVideos.length > 0) {
    const idx = activeListVideos.findIndex((v) => v.id === video.id);
    if (idx >= 0) {
      prevVideo = idx > 0 ? activeListVideos[idx - 1] : null;
      if (activeListType === 'playlist' && playlistShuffle) {
        const otherIds = activeListVideos.filter((v) => v.id !== video.id);
        if (otherIds.length > 0) {
          nextVideo = otherIds[Math.floor(Math.random() * otherIds.length)];
        } else if (playlistLoop) {
          nextVideo = video;
        }
      } else {
        if (idx < activeListVideos.length - 1) {
          nextVideo = activeListVideos[idx + 1];
        } else if (playlistLoop) {
          nextVideo = activeListVideos[0];
        }
      }
    } else {
      nextVideo = activeListVideos[0];
    }
  }

  const getWatchURL = (targetVideo: Video) => {
    if (activeListType === 'playlist' && activePlaylistId) {
      return `/watch/${targetVideo.id}?playlist=${activePlaylistId}`;
    }
    if (activeListType === 'watch-later') {
      return `/watch/${targetVideo.id}?list=watch-later`;
    }
    if (activeListType === 'queue') {
      return `/watch/${targetVideo.id}?list=queue`;
    }
    return `/watch/${targetVideo.id}`;
  };

  const clearUpNext = () => {
    if (upNextIntervalRef.current) clearInterval(upNextIntervalRef.current);
    upNextIntervalRef.current = null;
    setUpNextVideo(null);
    setUpNextCountdown(null);
  };

  const goToPrev = () => { clearUpNext(); if (prevVideo) navigate(getWatchURL(prevVideo)); };
  const goToNext = () => { 
    clearUpNext(); 
    if (nextVideo) {
      if (activeListType === 'queue') {
        removeFromQueue(video.id);
      }
      navigate(getWatchURL(nextVideo)); 
    } 
  };

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
    <div ref={containerRef} className={`relative bg-black overflow-hidden aspect-video group cursor-pointer ${theaterMode ? 'max-h-[85vh] w-full max-w-[151.11vh] mx-auto' : 'rounded-xl'}`} onMouseMove={handleMouseMove} onMouseLeave={() => isPlaying && setShowControls(false)} onClick={handlePlayPause}>
      {isDenied ? (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-dark-card to-dark-bg text-center px-6">
          <div className="max-w-xs">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock size={32} className="text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">{video.visibility.toUpperCase()} Content</h2>
            <p className="text-sm text-gray-400">
              This content requires a <strong>{video.visibility.toUpperCase()}</strong> tier or higher. 
              {currentUser.id === '' ? ' Please log in to view.' : ` Your current role is ${userRole.toUpperCase()}.`}
            </p>
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
              <button onClick={() => { setShowSpeedMenu(!showSpeedMenu); setSpeedMenuLevel('main'); }} className="text-white hover:text-gray-300 flex items-center gap-0.5" title="Settings">
                <SettingsIcon size={20} className={showSpeedMenu ? 'rotate-90 transition-transform' : 'transition-transform'} />
              </button>
              {showSpeedMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSpeedMenu(false)} />
                  <div className="absolute bottom-full right-0 mb-2 w-56 bg-black/95 backdrop-blur-md rounded-xl shadow-2xl z-50 py-2 border border-white/10 overflow-hidden">
                    {speedMenuLevel === 'main' ? (
                      <div className="animate-in slide-in-from-right-2 duration-200">
                        <div className="px-3 py-2 flex items-center justify-between text-sm text-white">
                          <span className="flex items-center gap-2 text-gray-400"><Minimize2 size={16} /> Mini player</span>
                          <button onClick={() => setMiniPlayerEnabled(!miniPlayer.enabled)} className="relative w-8 h-4 rounded-full transition-colors" style={{ backgroundColor: miniPlayer.enabled ? '#3b82f6' : 'rgba(255,255,255,0.2)' }}>
                            <div className="absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all shadow-sm" style={{ left: miniPlayer.enabled ? '17px' : '2px' }} />
                          </button>
                        </div>
                        <div className="w-full h-px bg-white/10 my-1" />
                        <button onClick={() => setSpeedMenuLevel('speed')} className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-white hover:bg-white/10 transition">
                          <span className="flex items-center gap-2"><Play size={16} /> Playback speed</span>
                          <span className="flex items-center gap-1 text-gray-400">
                            {playbackSpeed === 1 ? 'Normal' : `${playbackSpeed}x`}
                            <ChevronRight size={16} />
                          </span>
                        </button>
                      </div>
                    ) : (
                      <div className="animate-in slide-in-from-left-2 duration-200">
                        <button onClick={() => setSpeedMenuLevel('main')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white/10 border-b border-white/10 mb-1">
                          <SkipBack size={14} /> Back
                        </button>
                        {SPEEDS.map((s) => (
                          <button key={s} onClick={() => changeSpeed(s)} className={`w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center justify-between ${playbackSpeed === s ? 'text-blue-400 font-medium' : 'text-white'}`}>
                            {s === 1 ? 'Normal' : `${s}x`}
                            {playbackSpeed === s && <span>✓</span>}
                          </button>
                        ))}
                      </div>
                    )}
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
            <button onClick={handlePiP} className="text-white hover:text-gray-300" title="Picture-in-Picture"><PictureInPicture size={20} /></button>
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
            <button onClick={() => { if (requireLogin()) return; toggleSubscribe(video.channelId); }} className={`ml-2 px-4 py-2 rounded-full text-sm font-medium transition ${isSubscribed ? 'bg-gray-200 dark:bg-dark-card text-gray-700 dark:text-dark-text-secondary hover:bg-gray-300 dark:hover:bg-dark-hover' : 'bg-white dark:bg-dark-text text-gray-900 dark:text-dark-bg hover:opacity-90'}`}>{isSubscribed ? t('unsubscribe') : t('subscribe')}</button>
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
          {isLoggedIn && (
            <button 
              onClick={() => setReportModal({ active: true, type: 'video', targetId: video.id })} 
              className={`${actionBtnCls} text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium`}
              title="Report this video"
            >
              <Flag size={18} />
              <span className="hidden sm:inline">Report</span>
            </button>
          )}
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
        <div className="space-y-5">
          {videoComments.map((c) => (
            <CommentItem 
              key={c.id} 
              comment={c} 
              replies={getReplies(c.id)} 
              videoId={video.id} 
              onReportComment={(cid) => setReportModal({ active: true, type: 'comment', targetId: cid })}
            />
          ))}
        </div>
      </div>
    </div>
  );

  // ── Queue, Watch Later, & Playlist sidebar calculations ──
  const queueVideos = queue.map((qid) => videos.find((v) => v.id === qid)).filter((v): v is Video => !!v && v.id !== video.id);
  const watchLaterVideos = watchLater.map((qid) => videos.find((v) => v.id === qid)).filter((v): v is Video => !!v);

  const playlistSessionVideoIds = activePlaylist?.videoIds || playlistQueue;
  const playlistSessionActive = !!activePlaylist && playlistSessionVideoIds.includes(video.id);
  const playlistSessionVideos = playlistSessionVideoIds.map((qid) => videos.find((v) => v.id === qid)).filter((v): v is Video => !!v);

  const handleEnded = () => {
    if (!autoplay) return;
    if (activeListType === 'related') {
      if (nextVideo) {
        startUpNextCountdown(nextVideo);
      }
    } else {
      goToNext();
    }
  };

  const sidebarBlock = (
    <div className="space-y-4">
      {/* Watch Later playback panel */}
      {activeListType === 'watch-later' && watchLaterVideos.length > 0 && (
        <div className="bg-gray-100 dark:bg-dark-card rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-dark-border">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-dark-border">
            <h3 className="font-medium text-sm dark:text-dark-text">Watch Later</h3>
            <p className="text-xs text-gray-500 dark:text-dark-text-muted">{watchLaterVideos.length} videos</p>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-dark-border max-h-[400px] overflow-y-auto">
            {watchLaterVideos.map((qv, i) => {
              const isCurrent = qv.id === video.id;
              return (
                <div key={qv.id} className={`flex items-center gap-2 px-2 py-1.5 group/q ${isCurrent ? 'bg-blue-50 dark:bg-blue-900/15' : 'hover:bg-gray-200 dark:hover:bg-dark-hover'}`}>
                  <span className={`text-xs w-5 text-center flex-shrink-0 ${isCurrent ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-400 dark:text-dark-text-muted'}`}>
                    {isCurrent ? '▶' : i + 1}
                  </span>
                  <Link to={`/watch/${qv.id}?list=watch-later`} className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-16 aspect-video bg-gray-300 dark:bg-dark-elevated rounded overflow-hidden flex-shrink-0 relative">
                      {qv.thumbnailUrl ? <img src={qv.thumbnailUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Play size={10} className="text-gray-500" /></div>}
                      {isCurrent && <div className="absolute inset-0 ring-2 ring-blue-500 rounded" />}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-medium line-clamp-1 ${isCurrent ? 'text-blue-700 dark:text-blue-400' : 'dark:text-dark-text'}`}>{qv.title}</p>
                      <p className="text-[10px] text-gray-500 dark:text-dark-text-muted">{qv.channelName}</p>
                    </div>
                  </Link>
                  <button onClick={() => removeFromWatchLater(qv.id)} className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover/q:opacity-100 transition-opacity flex-shrink-0" title="Remove from Watch Later">✕</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
        <InfiniteVideoGrid
          fetchParams={relatedFetchParams}
          layout="list"
          pageSize={10}
          maxItems={30}
          compact
          emptyState={
            <div className="text-center py-6 text-gray-500 dark:text-dark-text-muted">
              <p className="text-sm">{t('noResultsFound')}</p>
            </div>
          }
        />
      </div>
    </div>
  );

  // ══════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════
  const reportModalJSX = reportModal.active && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-card w-full max-w-md rounded-2xl p-6 border border-gray-100 dark:border-dark-border shadow-2xl animate-in scale-in duration-200">
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wider flex items-center gap-2">
          <Flag className="text-red-500" size={18} /> Report {reportModal.type}
        </h3>
        <p className="text-xs text-gray-500 mb-4 font-sans">Please select the most appropriate reason why this {reportModal.type} violates standard community guidelines.</p>
        
        <label className="block text-xs font-bold text-gray-700 dark:text-dark-text uppercase tracking-wide mb-2">Category Reason</label>
        <select 
          value={reportReason} 
          onChange={(e) => setReportReason(e.target.value)}
          className="w-full mb-4 px-3 py-2 bg-gray-50 dark:bg-dark-elevated rounded-lg text-sm border-none ring-1 ring-gray-200 focus:ring-red-500 text-gray-800 dark:text-dark-text dark:ring-dark-border"
        >
          <option value="Inappropriate content">Inappropriate / Adult Content</option>
          <option value="Hate speech">Hate Speech or Bullying</option>
          <option value="Spam or scams">Spam, Misleading or Scams</option>
          <option value="Harassment">Harassment or Abuse</option>
          <option value="Violence">Violence or Incitement</option>
          <option value="Copyright infringement">Copyright Infringement</option>
        </select>

        <div className="flex justify-between items-center mb-2">
          <label className="block text-xs font-bold text-gray-700 dark:text-dark-text uppercase tracking-wide">
            Details / Context
          </label>
          <span className="text-red-500 font-bold text-[10px] uppercase animate-pulse">* Required Field</span>
        </div>
        <textarea
          placeholder="Please write details or timestamps supporting your claim (minimum of 5 characters needed)..."
          value={reportDetails}
          onChange={(e) => setReportDetails(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 bg-gray-50 dark:bg-dark-elevated rounded-lg text-sm border-none ring-1 ring-gray-200 focus:ring-red-500 text-gray-800 dark:text-dark-text dark:ring-dark-border font-sans"
        />
        {!reportDetails.trim() && (
          <p className="text-[11px] text-red-500 font-medium mt-1.5 flex items-center gap-1">
            <span className="font-bold">⚠️ Warning:</span> Details or context supporting this claim must be written before submission.
          </p>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button 
            type="button"
            onClick={() => {
              setReportModal({ active: false, type: 'video', targetId: '' });
              setReportDetails('');
            }}
            className="px-4 py-2 text-sm rounded-full bg-gray-100 dark:bg-dark-hover dark:text-dark-text hover:bg-gray-200 transition font-medium"
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={async () => {
              if (!reportDetails.trim()) {
                showToast('Submission Blocked! You must write some details or context with your report to explain the violation.', 'error');
                return;
              }
              if (reportDetails.trim().length < 5) {
                showToast('Please write a slightly longer, more helpful explanation supporting your claim (at least 5 characters).', 'error');
                return;
              }
              setSubmittingReport(true);
              try {
                await api.submitReport(reportModal.type, reportModal.targetId, reportReason, reportDetails.trim());
                showToast(`Your report has been submitted for review.`, 'success');
                setReportModal({ active: false, type: 'video', targetId: '' });
                setReportDetails('');
              } catch (err: any) {
                showToast(err.message || 'Failed to submit report', 'error');
              } finally {
                setSubmittingReport(false);
              }
            }}
            disabled={submittingReport}
            className="px-4 py-2 text-sm rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition font-medium flex items-center gap-2"
          >
            {submittingReport ? 'Submitting...' : 'Submit Report'}
          </button>
        </div>
      </div>
    </div>
  );

  if (theaterMode) {
    return (
      <>
        <div>
          <div className="-mx-3 sm:-mx-4 lg:-mx-6 bg-black flex justify-center items-center">{videoPlayer}</div>
          <div className="flex flex-col lg:flex-row gap-6 mt-4">
            <div className="flex-1 min-w-0">{videoInfo}</div>
            <div className="w-full lg:w-96 flex-shrink-0">{sidebarBlock}</div>
          </div>
        </div>
        {reportModalJSX}
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0">
          <div className="pt-1 pb-3">
            {videoPlayer}
          </div>
          {videoInfo}
        </div>
        <div className="w-full lg:w-96 flex-shrink-0 lg:sticky lg:top-14 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto pr-1">
          {sidebarBlock}
        </div>
      </div>
      {reportModalJSX}
    </>
  );
}
