import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Play, MoreVertical, ListPlus, Share2, Download, ListEnd, Lock, Star } from 'lucide-react';
import { Video } from '../store/useStore';
import useStore from '../store/useStore';
import { formatDuration, formatViews, timeAgo } from '../utils/format';
import Avatar from './Avatar';
import { useLanguage } from '../i18n/LanguageContext';

interface VideoCardProps {
  video: Video;
  layout?: 'grid' | 'list';
  compact?: boolean;
}

function VideoMenu({ video, onClose }: { video: Video; onClose: () => void }) {
  const { t } = useLanguage();
  const addToQueue = useStore((s) => s.addToQueue);
  const watchLater = useStore((s) => s.watchLater);
  const addToWatchLater = useStore((s) => s.addToWatchLater);
  const removeFromWatchLater = useStore((s) => s.removeFromWatchLater);
  const playlists = useStore((s) => s.playlists);
  const addVideoToPlaylist = useStore((s) => s.addVideoToPlaylist);
  const [showPlaylists, setShowPlaylists] = useState(false);

  const handleShare = () => {
    navigator.clipboard.writeText(`${window.location.origin}/watch/${video.id}`);
    onClose();
  };

  const handleDownload = () => {
    if (video.videoUrl) {
      const a = document.createElement('a');
      a.href = video.videoUrl;
      a.download = `${video.title}.mp4`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    onClose();
  };

  const itemCls = "w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-dark-hover text-gray-700 dark:text-dark-text text-left";

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl shadow-xl z-50 py-1 overflow-hidden">
      <button onClick={() => { addToQueue(video.id); onClose(); }} className={itemCls}>
        <ListEnd size={18} className="text-gray-500 dark:text-dark-text-muted flex-shrink-0" />
        {t('addToQueue')}
      </button>

      <button onClick={() => { if (watchLater.includes(video.id)) removeFromWatchLater(video.id); else addToWatchLater(video.id); onClose(); }} className={itemCls}>
        <Play size={18} className="text-gray-500 dark:text-dark-text-muted flex-shrink-0" />
        {watchLater.includes(video.id) ? 'Remove from Watch Later' : 'Save to Watch Later'}
      </button>

      {/* Save to playlist */}
      <div className="relative">
        <button onClick={() => setShowPlaylists(!showPlaylists)} className={itemCls}>
          <ListPlus size={18} className="text-gray-500 dark:text-dark-text-muted flex-shrink-0" />
          {t('saveToPlaylist')}
        </button>
        {showPlaylists && (
          <div className="border-t border-gray-100 dark:border-dark-border">
            {playlists.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-500 dark:text-dark-text-muted">{t('noPlaylistsYet')}</p>
            ) : (
              playlists.map((pl) => (
                <button key={pl.id} onClick={() => { addVideoToPlaylist(pl.id, video.id); onClose(); }} className="w-full flex items-center justify-between px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-dark-hover dark:text-dark-text-secondary text-left">
                  <span className="truncate">{pl.name}</span>
                  {pl.videoIds.includes(video.id) && <span className="text-green-600 dark:text-green-400 text-[10px]">✓</span>}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {video.videoUrl && (
        <button onClick={handleDownload} className={itemCls}>
          <Download size={18} className="text-gray-500 dark:text-dark-text-muted flex-shrink-0" />
          {t('download')}
        </button>
      )}

      <button onClick={handleShare} className={itemCls}>
        <Share2 size={18} className="text-gray-500 dark:text-dark-text-muted flex-shrink-0" />
        {t('share')}
      </button>
    </div>
    </>
  );
}

export default function VideoCard({ video, layout = 'grid', compact = false }: VideoCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const currentUser = useStore((s) => s.currentUser);
  const location = useLocation();
  const isWatchLaterPage = location.pathname === '/watch-later';
  const watchUrl = isWatchLaterPage ? `/watch/${video.id}?list=watch-later` : `/watch/${video.id}`;

  // Completely hide VIP++ videos from other groups (only admins, vip++ members, vip++ mods, or the video uploader can see them at all)
  if (video.visibility === 'vip++') {
    const isAllowed = currentUser.role === 'admin' || currentUser.role === 'vip++' || currentUser.role === 'moderator_vip_plus_plus' || currentUser.id === video.channelId;
    if (!isAllowed) return null;
  }

  const isLoggedIn = currentUser.id !== '';
  const watchHistory = useStore((s) => s.watchHistory);
  const historyEntry = watchHistory.find((h) => h.videoId === video.id);
  const watchProgress = historyEntry?.progress || 0;
  
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
  const shouldBlur = isRestricted && !hasAccess;

  const getVisibilityBadge = () => {
    if (!isRestricted) return null;
    const labels: Record<string, string> = { 'user': 'USER', 'vip': 'VIP', 'vip+': 'VIP+', 'vip++': 'VIP++' };
    const colors: Record<string, string> = { 
      'user': 'bg-gray-500', 
      'vip': 'bg-yellow-500', 
      'vip+': 'bg-orange-500', 
      'vip++': 'bg-purple-500' 
    };
    return (
      <div className={`absolute top-2 left-2 ${colors[video.visibility]} text-white px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 shadow-md z-10`}>
        {video.visibility === 'user' ? <Lock size={10} /> : <Star size={10} fill="currentColor" />} {labels[video.visibility]}
      </div>
    );
  };

  if (layout === 'list') {
    return (
      <div className={`flex group relative ${compact ? 'gap-2.5' : 'gap-4'}`}>
        <Link to={watchUrl} className={`relative aspect-video bg-gray-200 dark:bg-dark-elevated rounded-xl overflow-hidden flex-shrink-0 ${compact ? 'w-28 sm:w-36' : 'w-40 sm:w-64'}`}>
          {video.thumbnailUrl ? (
            <img src={video.thumbnailUrl} alt={video.title} className={`w-full h-full object-cover transition-all ${shouldBlur ? 'blur-lg scale-110 grayscale' : ''}`} />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br from-gray-300 to-gray-400 dark:from-dark-elevated dark:to-dark-card flex items-center justify-center ${shouldBlur ? 'blur-md' : ''}`}>
              <Play size={compact ? 20 : 32} className="text-gray-500 dark:text-dark-text-muted" />
            </div>
          )}
          {getVisibilityBadge()}
          {shouldBlur && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-10">
              <div className="bg-black/60 p-1.5 rounded-full text-white backdrop-blur-sm">
                <Lock size={compact ? 14 : 20} />
              </div>
            </div>
          )}
          <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] sm:text-xs px-1.5 py-0.5 rounded">
            {formatDuration(video.duration)}
          </span>
          {watchProgress > 0.02 && <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30"><div className="h-full bg-red-600" style={{ width: `${watchProgress * 100}%` }} /></div>}
        </Link>
        <div className="flex-1 min-w-0 py-0.5">
          <div className="flex items-start justify-between gap-1">
            <Link to={watchUrl} className="flex-1 min-w-0" title={video.title}>
              <h3 className={`${compact ? 'text-xs sm:text-sm font-medium leading-snug' : 'text-sm sm:text-base font-medium'} line-clamp-2 hover:text-blue-600 dark:text-dark-text dark:hover:text-blue-400`}>{video.title}</h3>
            </Link>
            {isLoggedIn && <div className="relative flex-shrink-0">
              <button onClick={(e) => { e.preventDefault(); setShowMenu(!showMenu); }} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-dark-hover">
                <MoreVertical size={compact ? 14 : 18} className="text-gray-600 dark:text-dark-text-muted" />
              </button>
              {showMenu && <VideoMenu video={video} onClose={() => setShowMenu(false)} />}
            </div>}
          </div>
          <Link to={`/channel/${video.channelId}`} className={`${compact ? 'text-[11px]' : 'text-sm'} text-gray-600 dark:text-dark-text-secondary mt-0.5 sm:mt-1 hover:text-gray-900 dark:hover:text-white block truncate`}>{video.channelName}</Link>
          <p className={`${compact ? 'text-[10px]' : 'text-xs sm:text-sm'} text-gray-500 dark:text-dark-text-muted mt-0.5`}>
            {formatViews(video.views)} • {timeAgo(video.uploadDate)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link to={watchUrl}>
        <div className="relative aspect-video bg-gray-200 dark:bg-dark-elevated rounded-xl overflow-hidden">
          {video.thumbnailUrl ? (
            <img src={video.thumbnailUrl} alt={video.title} className={`w-full h-full object-cover transition-all ${shouldBlur ? 'blur-lg scale-110 grayscale' : ''}`} />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br from-gray-300 to-gray-400 dark:from-dark-elevated dark:to-dark-card flex items-center justify-center ${shouldBlur ? 'blur-md' : ''}`}>
              <Play size={32} className="text-gray-500 dark:text-dark-text-muted" />
            </div>
          )}
          {getVisibilityBadge()}
          {shouldBlur && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-10">
              <div className="bg-black/60 p-2 rounded-full text-white backdrop-blur-sm">
                <Lock size={24} />
              </div>
            </div>
          )}
          <span className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
            {formatDuration(video.duration)}
          </span>
          {watchProgress > 0.02 && <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30"><div className="h-full bg-red-600" style={{ width: `${watchProgress * 100}%` }} /></div>}
        </div>
      </Link>
      <div className="flex gap-3 mt-3">
        <Link to={`/channel/${video.channelId}`}><Avatar name={video.channelName} src={video.channelAvatar} size="sm" /></Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <Link to={watchUrl} className="flex-1 min-w-0" title={video.title}>
              <h3 className="text-sm font-medium line-clamp-2 hover:text-blue-600 dark:text-dark-text dark:hover:text-blue-400">{video.title}</h3>
            </Link>
            {isLoggedIn && <div className="relative flex-shrink-0">
              <button onClick={(e) => { e.preventDefault(); setShowMenu(!showMenu); }} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-dark-hover">
                <MoreVertical size={18} className="text-gray-600 dark:text-dark-text-muted" />
              </button>
              {showMenu && <VideoMenu video={video} onClose={() => setShowMenu(false)} />}
            </div>}
          </div>
          <Link to={`/channel/${video.channelId}`} className="text-xs text-gray-600 dark:text-dark-text-secondary mt-1 hover:text-gray-900 dark:hover:text-white block">{video.channelName}</Link>
          <p className="text-xs text-gray-500 dark:text-dark-text-muted">
            {formatViews(video.views)} • {timeAgo(video.uploadDate)}
          </p>
        </div>
      </div>
    </div>
  );
}
