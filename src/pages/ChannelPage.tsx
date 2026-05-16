import { useParams } from 'react-router-dom';
import useStore from '../store/useStore';
import InfiniteVideoGrid from '../components/InfiniteVideoGrid';
import Avatar from '../components/Avatar';
import { useLanguage } from '../i18n/LanguageContext';
import { formatCount } from '../utils/format';

export default function ChannelPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const channels = useStore((s) => s.channels);
  const currentUser = useStore((s) => s.currentUser);
  const videos = useStore((s) => s.videos);
  const subscribedChannels = useStore((s) => s.subscribedChannels);
  const toggleSubscribe = useStore((s) => s.toggleSubscribe);

  const isOwn = id === currentUser.id;
  const channel = isOwn ? currentUser : channels.find((c) => c.id === id);

  if (!channel) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500 dark:text-dark-text-muted">
        <p className="text-lg">Channel not found</p>
      </div>
    );
  }

  const channelVideos = videos.filter((v) => v.channelId === channel.id && (isOwn || v.visibility === 'public'));
  const isSubscribed = subscribedChannels.includes(channel.id);
  const totalViews = channelVideos.reduce((a, v) => a + v.views, 0);

  return (
    <div>
      <div className="relative h-32 sm:h-44 lg:h-52 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl overflow-hidden -mx-3 sm:-mx-4 lg:-mx-6 mb-6">
        {channel.bannerImage && <img src={channel.bannerImage} alt="Banner" className="w-full h-full object-cover" />}
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
        <Avatar name={channel.name} src={channel.avatar} size="xl" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{channel.name}</h1>
            {channel.role === 'vip' && <span className="text-yellow-500" title="VIP">⭐</span>}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-dark-text-muted mt-1 flex-wrap">
            <span>@{channel.name.toLowerCase().replace(/\s+/g, '')}</span>
            <span>•</span>
            <span>{formatCount(channel.subscriberCount)} {t('subscribers')}</span>
            <span>•</span>
            <span>{channelVideos.length} {t('videos')}</span>
          </div>
          {channel.description && <p className="text-sm text-gray-600 dark:text-dark-text-secondary mt-2 line-clamp-2">{channel.description}</p>}
          {!isOwn && (
            <button
              onClick={() => toggleSubscribe(channel.id)}
              className={`mt-3 px-5 py-2 rounded-full text-sm font-medium transition ${
                isSubscribed
                  ? 'bg-gray-200 dark:bg-dark-card text-gray-700 dark:text-dark-text-secondary hover:bg-gray-300 dark:hover:bg-dark-hover'
                  : 'bg-white dark:bg-dark-text text-gray-900 dark:text-dark-bg hover:opacity-90'
              }`}
            >
              {isSubscribed ? t('subscribed') : t('subscribe')}
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-4 mb-6 overflow-x-auto pb-2">
        <div className="bg-gray-100 dark:bg-dark-card rounded-xl px-5 py-3 text-center flex-shrink-0">
          <p className="text-xl font-bold">{channelVideos.length}</p>
          <p className="text-xs text-gray-500 dark:text-dark-text-muted">{t('videos')}</p>
        </div>
        <div className="bg-gray-100 dark:bg-dark-card rounded-xl px-5 py-3 text-center flex-shrink-0">
          <p className="text-xl font-bold">{formatCount(channel.subscriberCount)}</p>
          <p className="text-xs text-gray-500 dark:text-dark-text-muted">{t('subscribers')}</p>
        </div>
        <div className="bg-gray-100 dark:bg-dark-card rounded-xl px-5 py-3 text-center flex-shrink-0">
          <p className="text-xl font-bold">{formatCount(totalViews)}</p>
          <p className="text-xs text-gray-500 dark:text-dark-text-muted">{t('totalViews')}</p>
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-4">{t('videos')}</h2>
      <InfiniteVideoGrid
        videos={channelVideos}
        pageSize={12}
        emptyState={
          <div className="text-center py-16 text-gray-500 dark:text-dark-text-muted">
            <p>{t('noVideosUploaded')}</p>
          </div>
        }
      />
    </div>
  );
}
