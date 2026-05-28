import { useParams } from 'react-router-dom';
import { useMemo, useState, useEffect } from 'react';
import useStore from '../store/useStore';
import InfiniteVideoGrid from '../components/InfiniteVideoGrid';
import Avatar from '../components/Avatar';
import PlaylistCard from '../components/PlaylistCard';
import { useLanguage } from '../i18n/LanguageContext';
import { Playlist } from '../store/useStore';
import { formatCount } from '../utils/format';

export default function ChannelPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const channels = useStore((s) => s.channels);
  const currentUser = useStore((s) => s.currentUser);
  const videos = useStore((s) => s.videos);
  const subscribedChannels = useStore((s) => s.subscribedChannels);
  const toggleSubscribe = useStore((s) => s.toggleSubscribe);

  const [activeTab, setActiveTab] = useState<'videos' | 'playlists' | 'about'>('videos');
  const [channelPlaylists, setChannelPlaylists] = useState<Playlist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);

  const isOwn = id === currentUser.id;
  const channel = isOwn ? currentUser : channels.find((c) => c.id === id);

  useEffect(() => {
    if (!channel) return;
    setLoadingPlaylists(true);
    import('../api/client').then(({ api }) => {
      api.getChannelPlaylists(channel.id)
        .then((res: any) => {
          if (Array.isArray(res)) {
            setChannelPlaylists(res);
          }
        })
        .catch((err: any) => console.error('Failed to load playlists:', err))
        .finally(() => setLoadingPlaylists(false));
    });
  }, [channel?.id]);

  if (!channel) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500 dark:text-dark-text-muted">
        <p className="text-lg">Channel not found</p>
      </div>
    );
  }

  const channelVideos = videos.filter((v) => 
    v.channelId === channel.id && (
      isOwn || 
      ['public', 'user', 'vip', 'vip+', 'vip++'].includes(v.visibility)
    )
  );
  const isSubscribed = subscribedChannels.includes(channel.id);
  const totalViews = channelVideos.reduce((a, v) => a + v.views, 0);

  const ROLE_LEVELS: Record<string, number> = { 'guest': -1, 'user': 0, 'vip': 1, 'vip+': 2, 'vip++': 3, 'admin': 4 };
  const VIS_LEVELS: Record<string, number> = { 'public': -1, 'unlisted': -1, 'user': 0, 'vip': 1, 'vip+': 2, 'vip++': 3, 'private': 100 };

  const viewerRole = currentUser.id ? currentUser.role : 'guest';
  const viewerLevel = ROLE_LEVELS[viewerRole] ?? -1;

  const allowedPlaylists = useMemo(() => {
    return channelPlaylists.filter((pl) => {
      const plVis = pl.visibility || 'public';
      if (plVis === 'private') {
        return isOwn || currentUser.role === 'admin';
      }
      const plLevel = VIS_LEVELS[plVis] ?? -1;
      return viewerLevel >= plLevel || isOwn || currentUser.role === 'admin';
    });
  }, [channelPlaylists, viewerLevel, isOwn, currentUser.role]);

  const fetchParams = useMemo(() => ({
    channelId: channel.id,
    limit: 12
  }), [channel.id]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      <div className="relative h-32 sm:h-44 lg:h-52 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl overflow-hidden -mx-3 sm:-mx-4 lg:-mx-6 mb-6 shadow-inner">
        {channel.bannerImage && <img src={channel.bannerImage} alt="Banner" className="w-full h-full object-cover" />}
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
        <Avatar name={channel.name} src={channel.avatar} size="xl" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{channel.name}</h1>
            {channel.role === 'vip' && <span className="text-yellow-500" title="VIP">⭐</span>}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-dark-text-muted mt-1 flex-wrap font-medium">
            <span>@{channel.name.toLowerCase().replace(/\s+/g, '')}</span>
            <span>•</span>
            <span>{formatCount(channel.subscriberCount)} {t('subscribers')}</span>
            <span>•</span>
            <span>{channelVideos.length} {t('videos')}</span>
          </div>
          {channel.description && <p className="text-sm text-gray-600 dark:text-dark-text-secondary mt-2 line-clamp-2 leading-relaxed">{channel.description}</p>}
          {!isOwn && (
            <button
              onClick={() => toggleSubscribe(channel.id)}
              className={`mt-4 px-6 py-2 rounded-full text-sm font-semibold transition shadow-sm ${
                isSubscribed
                  ? 'bg-gray-200 dark:bg-dark-card text-gray-700 dark:text-dark-text-secondary hover:bg-gray-300 dark:hover:bg-dark-hover'
                  : 'bg-red-600 dark:bg-dark-text text-white dark:text-dark-bg hover:bg-red-700 dark:hover:opacity-90'
              }`}
            >
              {isSubscribed ? t('unsubscribe') : t('subscribe')}
            </button>
          )}
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-gray-200 dark:border-dark-border mb-6">
        <button
          onClick={() => setActiveTab('videos')}
          className={`px-5 py-3 font-semibold text-sm border-b-2 transition-colors duration-200 -mb-px ${
            activeTab === 'videos'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-gray-500 dark:text-dark-text-muted hover:text-gray-700 dark:hover:text-dark-text'
          }`}
        >
          {t('videos' as any) || 'Videos'}
        </button>
        <button
          onClick={() => setActiveTab('playlists')}
          className={`px-5 py-3 font-semibold text-sm border-b-2 transition-colors duration-200 -mb-px ${
            activeTab === 'playlists'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-gray-500 dark:text-dark-text-muted hover:text-gray-700 dark:hover:text-dark-text'
          }`}
        >
          {t('playlists' as any) || 'Playlists'}
        </button>
        <button
          onClick={() => setActiveTab('about')}
          className={`px-5 py-3 font-semibold text-sm border-b-2 transition-colors duration-200 -mb-px ${
            activeTab === 'about'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-gray-500 dark:text-dark-text-muted hover:text-gray-700 dark:hover:text-dark-text'
          }`}
        >
          {t('about' as any) || 'About'}
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'videos' && (
        <InfiniteVideoGrid
          fetchParams={fetchParams}
          pageSize={12}
          emptyState={
            <div className="text-center py-16 text-gray-500 dark:text-dark-text-muted">
              <p>{t('noVideosUploaded')}</p>
            </div>
          }
        />
      )}

      {activeTab === 'playlists' && (
        <div>
          {loadingPlaylists ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : allowedPlaylists.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border-light rounded-2xl p-8">
              <p className="text-lg text-gray-500 dark:text-dark-text-muted font-semibold">No playlists available</p>
              <p className="text-sm text-gray-400 dark:text-dark-text-secondary mt-1">Playlists created by this user will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {allowedPlaylists.map((pl) => (
                <PlaylistCard key={pl.id} playlist={pl} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'about' && (
        <div className="max-w-3xl">
          <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border-light rounded-xl p-6 space-y-6 shadow-sm">
            <div>
              <h3 className="text-xs font-semibold text-gray-400 dark:text-dark-text-muted mb-2 tracking-wider uppercase">{t('description')}</h3>
              <p className="text-gray-700 dark:text-dark-text leading-relaxed whitespace-pre-wrap">{channel.description || 'No description provided.'}</p>
            </div>
            
            <div className="border-t border-gray-100 dark:border-dark-border pt-4">
              <h3 className="text-xs font-semibold text-gray-400 dark:text-dark-text-muted mb-4 tracking-wider uppercase">{t('stats')}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 dark:bg-dark-elevated rounded-xl p-4 text-center border border-gray-100 dark:border-dark-border-light shadow-sm">
                  <p className="text-2xl font-bold text-gray-900 dark:text-dark-text">{channelVideos.length}</p>
                  <p className="text-xs text-gray-500 dark:text-dark-text-muted mt-1 font-medium">{t('videos')}</p>
                </div>
                <div className="bg-gray-50 dark:bg-dark-elevated rounded-xl p-4 text-center border border-gray-100 dark:border-dark-border-light shadow-sm">
                  <p className="text-2xl font-bold text-gray-900 dark:text-dark-text">{formatCount(channel.subscriberCount)}</p>
                  <p className="text-xs text-gray-500 dark:text-dark-text-muted mt-1 font-medium">{t('subscribers')}</p>
                </div>
                <div className="bg-gray-50 dark:bg-dark-elevated rounded-xl p-4 text-center border border-gray-100 dark:border-dark-border-light shadow-sm">
                  <p className="text-2xl font-bold text-gray-900 dark:text-dark-text">{formatCount(totalViews)}</p>
                  <p className="text-xs text-gray-500 dark:text-dark-text-muted mt-1 font-medium">{t('totalViews')}</p>
                </div>
                <div className="bg-gray-50 dark:bg-dark-elevated rounded-xl p-4 text-center border border-gray-100 dark:border-dark-border-light shadow-sm">
                  <p className="text-2xl font-bold text-gray-900 dark:text-dark-text">{allowedPlaylists.length}</p>
                  <p className="text-xs text-gray-500 dark:text-dark-text-muted mt-1 font-medium">{t('playlists')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
